import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/entities/order.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';

const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_VARIANTS_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly ordersService: OrdersService,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
  ) {}

  async getSummary(requestUser: Pick<User, 'id' | 'role'>) {
    const orderStats = await this.ordersService.getStats(requestUser);
    const sales = await this.getSalesInsights(requestUser);

    if (!this.isAdminRole(requestUser.role)) {
      return {
        orderStats,
        sales,
        inventoryAlerts: null,
      };
    }

    const [outOfStockCount, lowStockCount, lowStockVariants] = await Promise.all([
      this.variantsRepository.count({
        where: {
          isActive: true,
          stock: LessThanOrEqual(0),
          product: { isActive: true },
        },
      }),
      this.variantsRepository.count({
        where: {
          isActive: true,
          stock: Between(1, LOW_STOCK_THRESHOLD),
          product: { isActive: true },
        },
      }),
      this.variantsRepository.find({
        where: {
          isActive: true,
          stock: Between(1, LOW_STOCK_THRESHOLD),
          product: { isActive: true },
        },
        relations: {
          product: true,
          size: true,
          color: true,
        },
        order: {
          stock: 'ASC',
          updatedAt: 'ASC',
        },
        take: LOW_STOCK_VARIANTS_LIMIT,
      }).then((variants) => variants.filter((variant) => variant.stock <= LOW_STOCK_THRESHOLD)),
    ]);

    return {
      orderStats,
      sales,
      inventoryAlerts: {
        threshold: LOW_STOCK_THRESHOLD,
        lowStockCount,
        outOfStockCount,
        lowStockVariants: lowStockVariants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          productName: variant.product.name,
          sizeName: variant.size.name,
          colorName: variant.color.name,
        })),
      },
    };
  }

  private isAdminRole(role: User['role']) {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  private async getSalesInsights(requestUser: Pick<User, 'id' | 'role'>) {
    const today = new Date();
    const trendStart = this.startOfDay(this.addDays(today, -6));
    const comparisonStart = this.startOfDay(this.addDays(today, -13));

    const where: FindOptionsWhere<Order> = this.isAdminRole(requestUser.role)
      ? { createdAt: MoreThanOrEqual(comparisonStart) }
      : {
          createdAt: MoreThanOrEqual(comparisonStart),
          user: { id: requestUser.id } as User,
        };

    const orders = await this.ordersRepository.find({
      where,
      select: {
        id: true,
        total: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
    });

    const pointsByDate = new Map<string, { orders: number; revenue: number }>();
    for (let i = 0; i < 14; i += 1) {
      const date = this.startOfDay(this.addDays(comparisonStart, i));
      pointsByDate.set(this.toDayKey(date), { orders: 0, revenue: 0 });
    }

    for (const order of orders) {
      const key = this.toDayKey(order.createdAt);
      const point = pointsByDate.get(key);
      if (!point) {
        continue;
      }
      point.orders += 1;
      point.revenue += Number(order.total);
    }

    const trendPoints = [] as Array<{
      date: string;
      label: string;
      orders: number;
      revenue: number;
    }>;

    let currentWeekRevenue = 0;
    let previousWeekRevenue = 0;

    for (let i = 0; i < 14; i += 1) {
      const date = this.startOfDay(this.addDays(comparisonStart, i));
      const key = this.toDayKey(date);
      const point = pointsByDate.get(key) ?? { orders: 0, revenue: 0 };

      if (i < 7) {
        previousWeekRevenue += point.revenue;
      } else {
        currentWeekRevenue += point.revenue;
      }

      if (date >= trendStart) {
        trendPoints.push({
          date: key,
          label: date.toLocaleDateString('es-AR', { weekday: 'short' }),
          orders: point.orders,
          revenue: Number(point.revenue.toFixed(2)),
        });
      }
    }

    const trendRevenue = trendPoints.reduce((sum, point) => sum + point.revenue, 0);
    const trendOrders = trendPoints.reduce((sum, point) => sum + point.orders, 0);

    const deltaPercent = previousWeekRevenue > 0
      ? Number((((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100).toFixed(2))
      : null;

    return {
      trendLast7Days: {
        totalOrders: trendOrders,
        totalRevenue: Number(trendRevenue.toFixed(2)),
        points: trendPoints,
      },
      weekComparison: {
        currentWeekRevenue: Number(currentWeekRevenue.toFixed(2)),
        previousWeekRevenue: Number(previousWeekRevenue.toFixed(2)),
        deltaPercent,
      },
    };
  }

  private toDayKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}