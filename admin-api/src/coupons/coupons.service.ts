import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { CurrenciesService } from '../currencies/currencies.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { CouponType } from './enums/coupon-type.enum';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly usagesRepository: Repository<CouponUsage>,
    private readonly currenciesService: CurrenciesService,
  ) {}

  async create(dto: CreateCouponDto) {
    const codeUpper = dto.code.toUpperCase();

    const exists = await this.couponsRepository.findOne({
      where: { code: codeUpper },
    });

    if (exists) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = this.couponsRepository.create({
      code: codeUpper,
      type: dto.type,
      value: Number(dto.value).toFixed(2),
      minOrderAmount: dto.minOrderAmount ? Number(dto.minOrderAmount).toFixed(2) : '0',
      currencyCode: await this.resolveCurrencyCode(dto.currencyCode),
      maxUsage: dto.maxUsage ?? null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isActive: dto.isActive ?? true,
    });

    return this.couponsRepository.save(coupon);
  }

  async findAll() {
    return this.couponsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.findOne(id);

    if (dto.code && dto.code.toUpperCase() !== coupon.code) {
      const exists = await this.couponsRepository.findOne({
        where: { code: dto.code.toUpperCase() },
      });

      if (exists) {
        throw new ConflictException('Coupon code already exists');
      }

      coupon.code = dto.code.toUpperCase();
    }

    if (dto.type) coupon.type = dto.type;
    if (dto.value) coupon.value = Number(dto.value).toFixed(2);
    if (dto.minOrderAmount) coupon.minOrderAmount = Number(dto.minOrderAmount).toFixed(2);
    if (dto.currencyCode !== undefined) {
      coupon.currencyCode = await this.resolveCurrencyCode(dto.currencyCode);
    }
    if (dto.maxUsage !== undefined) coupon.maxUsage = dto.maxUsage;
    if (dto.startDate) coupon.startDate = new Date(dto.startDate);
    if (dto.endDate) coupon.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) coupon.isActive = dto.isActive;

    return this.couponsRepository.save(coupon);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.couponsRepository.delete(id);
    return { deleted: true };
  }

  async validate(dto: ValidateCouponDto, userId?: string) {
    const orderCurrencyCode = await this.resolveCurrencyCode(dto.currencyCode);
    const coupon = await this.couponsRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    const now = new Date();
    if (coupon.startDate && coupon.startDate > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    if (coupon.endDate && coupon.endDate < now) {
      throw new BadRequestException('Coupon has expired');
    }

    const minOrderInRequestCurrency = await this.convertIfNeeded(
      Number(coupon.minOrderAmount),
      coupon.currencyCode,
      orderCurrencyCode,
    );

    if (minOrderInRequestCurrency > dto.orderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ${minOrderInRequestCurrency.toFixed(2)} ${orderCurrencyCode}, your order is ${dto.orderAmount}`,
      );
    }

    if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    const discount = await this.calculateDiscount(coupon, dto.orderAmount, orderCurrencyCode);

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        currencyCode: coupon.currencyCode,
      },
      currencyCode: orderCurrencyCode,
      discount,
      finalAmount: dto.orderAmount - discount,
    };
  }

  private async calculateDiscount(coupon: Coupon, orderAmount: number, orderCurrencyCode: string): Promise<number> {
    if (coupon.type === CouponType.PERCENTAGE) {
      return Number((orderAmount * (Number(coupon.value) / 100)).toFixed(2));
    }

    const fixedAmount = await this.convertIfNeeded(
      Number(coupon.value),
      coupon.currencyCode,
      orderCurrencyCode,
    );

    return Math.min(fixedAmount, orderAmount);
  }

  private normalizeCurrencyCode(code: string) {
    return code.trim().toUpperCase();
  }

  private async resolveCurrencyCode(code?: string) {
    const fallbackCode = await this.currenciesService.getDefaultCurrencyCode();
    const normalized = this.normalizeCurrencyCode(code || fallbackCode);
    const currency = await this.currenciesService.ensureActive(normalized);
    return currency.code;
  }

  private async convertIfNeeded(amount: number, fromCode: string, toCode: string) {
    const from = this.normalizeCurrencyCode(fromCode);
    const to = this.normalizeCurrencyCode(toCode);
    if (from === to) {
      return Number(amount.toFixed(2));
    }

    return this.currenciesService.convertAmount(amount, from, to);
  }
}
