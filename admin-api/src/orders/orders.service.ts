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
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

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
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

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

      const unitPrice = Number(variant.product.basePrice) + Number(variant.additionalPrice);
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
        { code: dto.couponCode, orderAmount: subtotal },
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

    return this.findOne(savedOrder.id);
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

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

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
    return this.ordersRepository.save(order);
  }

  async getStats(requestUser: Pick<User, 'id' | 'role'>) {
    const where: FindOptionsWhere<Order> = this.isAdminRole(requestUser.role)
      ? {}
      : { user: { id: requestUser.id } as User };

    const orders = await this.ordersRepository.find({ where });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

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
      totalRevenue: Number(totalSpent.toFixed(2)),
      pendingOrders: statusCounts[OrderStatus.PENDING],
      confirmedOrders: statusCounts[OrderStatus.CONFIRMED],
      shippedOrders: statusCounts[OrderStatus.SHIPPED],
      deliveredOrders: statusCounts[OrderStatus.DELIVERED],
      cancelledOrders: statusCounts[OrderStatus.CANCELLED],
      totalSpent: totalSpent.toFixed(2),
      averageOrderValue: averageOrderValue.toFixed(2),
      statusCounts,
    };
  }

  private isAdminRole(role: Role): boolean {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
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
