import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { Currency } from './entities/currency.entity';

@Injectable()
export class CurrenciesService {
  constructor(
    @InjectRepository(Currency)
    private readonly currenciesRepository: Repository<Currency>,
  ) {}

  async create(dto: CreateCurrencyDto) {
    const code = this.normalizeCode(dto.code);

    const exists = await this.currenciesRepository.findOne({ where: { code } });
    if (exists) {
      throw new ConflictException('Currency code already exists');
    }

    const normalizedRate = this.normalizeRate(code, dto.exchangeRateToUsd);

    const currency = this.currenciesRepository.create({
      code,
      name: dto.name.trim(),
      symbol: dto.symbol.trim(),
      exchangeRateToUsd: normalizedRate.toFixed(6),
      isActive: dto.isActive ?? true,
      isDefault: dto.isDefault ?? false,
    });

    if (currency.isDefault) {
      await this.clearDefaultCurrency();
    }

    return this.currenciesRepository.save(currency);
  }

  async findAll() {
    return this.currenciesRepository.find({
      order: {
        isDefault: 'DESC',
        code: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const currency = await this.currenciesRepository.findOne({ where: { id } });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }
    return currency;
  }

  async findByCode(code: string) {
    const normalized = this.normalizeCode(code);
    const currency = await this.currenciesRepository.findOne({ where: { code: normalized } });
    if (!currency) {
      throw new NotFoundException(`Currency ${normalized} not found`);
    }
    return currency;
  }

  async getDefaultCurrency() {
    const currency = await this.currenciesRepository.findOne({ where: { isDefault: true } });
    if (currency) {
      return currency;
    }

    const usd = await this.currenciesRepository.findOne({ where: { code: 'USD' } });
    if (!usd) {
      throw new NotFoundException('Default currency not configured');
    }

    return usd;
  }

  async getDefaultCurrencyCode() {
    const currency = await this.getDefaultCurrency();
    return currency.code;
  }

  async ensureActive(code: string) {
    const currency = await this.findByCode(code);
    if (!currency.isActive) {
      throw new BadRequestException(`Currency ${currency.code} is inactive`);
    }
    return currency;
  }

  async update(id: string, dto: UpdateCurrencyDto) {
    const currency = await this.findOne(id);

    if (dto.isActive === false && currency.isDefault) {
      throw new BadRequestException('Default currency must remain active');
    }

    if (dto.isDefault === false && currency.isDefault) {
      throw new BadRequestException('Select another default currency before unsetting this one');
    }

    if (dto.code && this.normalizeCode(dto.code) !== currency.code) {
      const code = this.normalizeCode(dto.code);
      const exists = await this.currenciesRepository.findOne({ where: { code } });
      if (exists && exists.id !== id) {
        throw new ConflictException('Currency code already exists');
      }
      currency.code = code;
    }

    if (dto.name !== undefined) {
      currency.name = dto.name.trim();
    }

    if (dto.symbol !== undefined) {
      currency.symbol = dto.symbol.trim();
    }

    if (dto.exchangeRateToUsd !== undefined) {
      const normalizedRate = this.normalizeRate(currency.code, dto.exchangeRateToUsd);
      currency.exchangeRateToUsd = normalizedRate.toFixed(6);
    }

    if (dto.isActive !== undefined) {
      currency.isActive = dto.isActive;
    }

    if (dto.isDefault !== undefined) {
      currency.isDefault = dto.isDefault;
      if (dto.isDefault) {
        await this.clearDefaultCurrency(id);
      }
    }

    return this.currenciesRepository.save(currency);
  }

  async remove(id: string) {
    const currency = await this.findOne(id);
    if (currency.isDefault) {
      throw new BadRequestException('Default currency cannot be removed. Select another default currency first');
    }
    if (currency.code === 'USD') {
      throw new BadRequestException('USD cannot be removed');
    }

    await this.currenciesRepository.delete(id);
    return { deleted: true };
  }

  async convertAmount(amount: number, fromCode: string, toCode: string) {
    const from = await this.ensureActive(fromCode);
    const to = await this.ensureActive(toCode);

    const fromRate = Number(from.exchangeRateToUsd);
    const toRate = Number(to.exchangeRateToUsd);

    const amountInUsd = amount / fromRate;
    const converted = amountInUsd * toRate;

    return Number(converted.toFixed(2));
  }

  async convertAmountToUsd(amount: number, fromCode: string) {
    const from = await this.ensureActive(fromCode);
    const fromRate = Number(from.exchangeRateToUsd);
    return Number((amount / fromRate).toFixed(2));
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private normalizeRate(code: string, exchangeRateToUsd: number) {
    if (!Number.isFinite(exchangeRateToUsd) || exchangeRateToUsd <= 0) {
      throw new BadRequestException('Exchange rate must be greater than 0');
    }

    if (code === 'USD') {
      return 1;
    }

    return exchangeRateToUsd;
  }

  private async clearDefaultCurrency(ignoreId?: string) {
    const defaults = await this.currenciesRepository.find({ where: { isDefault: true } });
    for (const item of defaults) {
      if (ignoreId && item.id === ignoreId) {
        continue;
      }
      item.isDefault = false;
      await this.currenciesRepository.save(item);
    }
  }
}
