import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ShippingAddress } from './entities/shipping-address.entity';
import { OrderStatus } from './enums/order-status.enum';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryMovementType } from '../inventory/enums/inventory-movement-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { CurrenciesService } from '../currencies/currencies.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemsRepository: Repository<OrderItem>,
    @InjectRepository(ShippingAddress)
    private readonly addressesRepository: Repository<ShippingAddress>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsagesRepository: Repository<CouponUsage>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryRepository: Repository<InventoryMovement>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly couponsService: CouponsService,
    private readonly notificationsService: NotificationsService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const defaultCurrencyCode = await this.currenciesService.getDefaultCurrencyCode();
    const orderCurrency = await this.currenciesService.ensureActive(
      this.normalizeCurrencyCode(dto.currencyCode || defaultCurrencyCode),
    );

    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const item of dto.items) {
      const variant = await this.variantsRepository.findOne({
        where: { id: item.variantId },
        relations: { product: true },
      });

      if (!variant) {
        throw new NotFoundException(`Variant ${item.variantId} not found`);
      }

      if (variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for variant ${variant.sku}. Available: ${variant.stock}, requested: ${item.quantity}`,
        );
      }

      const baseUnitPrice = Number(variant.product.basePrice) + Number(variant.additionalPrice);
      const productCurrency = await this.currenciesService.ensureActive(
        this.normalizeCurrencyCode(variant.product.currencyCode || defaultCurrencyCode),
      );
      const unitPrice = await this.convertIfNeeded(
        baseUnitPrice,
        productCurrency.code,
        orderCurrency.code,
      );
      const itemSubtotal = unitPrice * item.quantity;

      subtotal += itemSubtotal;

      const orderItem = this.itemsRepository.create({
        variant,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: itemSubtotal.toFixed(2),
      });

      orderItems.push(orderItem);
    }

    let coupon: Coupon | null = null;
    let discount = 0;

    if (dto.couponCode) {
      const validation = await this.couponsService.validate(
        { code: dto.couponCode, orderAmount: subtotal, currencyCode: orderCurrency.code },
        userId,
      );

      coupon = await this.couponsRepository.findOne({
        where: { code: validation.coupon.code },
      });

      discount = validation.discount;

      if (coupon) {
        coupon.usageCount += 1;
        await this.couponsRepository.save(coupon);
      }
    }

    const total = subtotal - discount;

    const order = this.ordersRepository.create({
      user,
      status: OrderStatus.PENDING,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      total: total.toFixed(2),
      currencyCode: orderCurrency.code,
      exchangeRateToUsd: Number(orderCurrency.exchangeRateToUsd).toFixed(6),
      coupon: coupon ?? null,
      items: orderItems,
      notes: dto.notes ?? null,
    });

    if (dto.shippingAddress) {
      const address = this.addressesRepository.create({
        ...dto.shippingAddress,
      });

      order.shippingAddresses = [address];
    }

    const savedOrder = await this.ordersRepository.save(order);

    if (coupon) {
      await this.couponUsagesRepository.save(
        this.couponUsagesRepository.create({
          coupon,
          user,
          order: savedOrder,
        }),
      );
    }

    const persistedOrder = await this.findOne(savedOrder.id);
    await this.notificationsService.sendOrderConfirmation(persistedOrder);
    await this.notificationsService.notifyOrderCreated(persistedOrder);

    return persistedOrder;
  }

  async findAll(requestUser: Pick<User, 'id' | 'role'>, query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Order> = {};

    if (!this.isAdminRole(requestUser.role)) {
      where.user = { id: requestUser.id } as User;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.currencyCode) {
      where.currencyCode = this.normalizeCurrencyCode(query.currencyCode);
    }

    const [items, total] = await this.ordersRepository.findAndCount({
      where,
      relations: { user: true, coupon: true, items: { variant: { product: true, size: true, color: true } }, shippingAddresses: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: {
        user: true,
        coupon: true,
        items: { variant: { product: true, size: true, color: true } },
        shippingAddresses: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, actorUserId?: string) {
    const order = await this.findOne(id);
    const previousStatus = order.status;

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`,
      );
    }

    if (dto.status === OrderStatus.CONFIRMED) {
      await this.decrementInventory(order);
    }

    order.status = dto.status;
    const updatedOrder = await this.ordersRepository.save(order);
    await this.notificationsService.notifyOrderStatusChanged(
      updatedOrder,
      previousStatus,
      actorUserId,
    );

    return updatedOrder;
  }

  async getStats(requestUser: Pick<User, 'id' | 'role'>) {
    const where: FindOptionsWhere<Order> = this.isAdminRole(requestUser.role)
      ? {}
      : { user: { id: requestUser.id } as User };

    const orders = await this.ordersRepository.find({ where });

    const totalOrders = orders.length;
    const totalSpentUsd = orders.reduce((sum, order) => {
      const rate = Number(order.exchangeRateToUsd || 1);
      return sum + Number(order.total) / rate;
    }, 0);
    const averageOrderValueUsd = totalOrders > 0 ? totalSpentUsd / totalOrders : 0;

    const statusCounts = {
      [OrderStatus.PENDING]: 0,
      [OrderStatus.CONFIRMED]: 0,
      [OrderStatus.SHIPPED]: 0,
      [OrderStatus.DELIVERED]: 0,
      [OrderStatus.CANCELLED]: 0,
    };

    orders.forEach((order) => {
      statusCounts[order.status]++;
    });

    return {
      totalOrders,
      totalRevenue: Number(totalSpentUsd.toFixed(2)),
      pendingOrders: statusCounts[OrderStatus.PENDING],
      confirmedOrders: statusCounts[OrderStatus.CONFIRMED],
      shippedOrders: statusCounts[OrderStatus.SHIPPED],
      deliveredOrders: statusCounts[OrderStatus.DELIVERED],
      cancelledOrders: statusCounts[OrderStatus.CANCELLED],
      totalSpent: totalSpentUsd.toFixed(2),
      averageOrderValue: averageOrderValueUsd.toFixed(2),
      statusCounts,
    };
  }

  private normalizeCurrencyCode(code: string) {
    return code.trim().toUpperCase();
  }

  private async convertIfNeeded(amount: number, fromCode: string, toCode: string) {
    if (fromCode === toCode) {
      return Number(amount.toFixed(2));
    }

    return this.currenciesService.convertAmount(amount, fromCode, toCode);
  }

  private isAdminRole(role: Role): boolean {
    return [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.BOSS,
      Role.MARKETING,
      Role.SALES,
    ].includes(role);
  }

  private async decrementInventory(order: Order) {
    for (const item of order.items) {
      const variant = await this.variantsRepository.findOne({
        where: { id: item.variant.id },
      });

      if (variant) {
        variant.stock -= item.quantity;
        await this.variantsRepository.save(variant);

        await this.inventoryRepository.save(
          this.inventoryRepository.create({
            variant,
            quantityChange: -item.quantity,
            type: InventoryMovementType.SALE,
            reason: `Order ${order.id}`,
            createdBy: order.user,
          }),
        );
      }
    }
  }
}
