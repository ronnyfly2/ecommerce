import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { DashboardSalesPreset, DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_VARIANTS_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly ordersService: OrdersService,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async getSummary(
    requestUser: Pick<User, 'id' | 'role'>,
    query: DashboardSummaryQueryDto = {},
  ) {
    const orderStats = await this.ordersService.getStats(requestUser);
    const sales = await this.getSalesInsights(requestUser, query);

    if (!this.isAdminRole(requestUser.role)) {
      return {
        orderStats,
        sales,
        inventoryAlerts: null,
      };
    }

    const [outOfStockCount, lowStockCount, lowStockVariants] = await Promise.all([
      this.productsRepository.count({
        where: {
          isActive: true,
          stock: LessThanOrEqual(0),
        },
      }),
      this.productsRepository.count({
        where: {
          isActive: true,
          stock: Between(1, LOW_STOCK_THRESHOLD),
        },
      }),
      this.productsRepository.find({
        where: {
          isActive: true,
          stock: Between(1, LOW_STOCK_THRESHOLD),
        },
        relations: {
          category: true,
        },
        order: {
          stock: 'ASC',
          updatedAt: 'ASC',
        },
        take: LOW_STOCK_VARIANTS_LIMIT,
      }).then((products) => products.filter((product) => product.stock <= LOW_STOCK_THRESHOLD)),
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
          productName: variant.name,
          categoryName: variant.category?.name ?? null,
          descriptor: this.buildInventoryDescriptor(variant),
        })),
      },
    };
  }

  private isAdminRole(role: User['role']) {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  private async getSalesInsights(
    requestUser: Pick<User, 'id' | 'role'>,
    query: DashboardSummaryQueryDto,
  ) {
    const window = this.resolveSalesWindow(query);

    const where: FindOptionsWhere<Order> = this.isAdminRole(requestUser.role)
      ? { createdAt: MoreThanOrEqual(window.previousStart) }
      : {
          createdAt: MoreThanOrEqual(window.previousStart),
          user: { id: requestUser.id } as User,
        };

    const orders = await this.ordersRepository.find({
      where,
      select: {
        id: true,
        total: true,
        exchangeRateToUsd: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
    });

    const totalTrackedDays = window.days * 2;
    const pointsByDate = new Map<string, { orders: number; revenue: number }>();
    for (let i = 0; i < totalTrackedDays; i += 1) {
      const date = this.startOfDay(this.addDays(window.previousStart, i));
      pointsByDate.set(this.toDayKey(date), { orders: 0, revenue: 0 });
    }

    for (const order of orders) {
      const key = this.toDayKey(order.createdAt);
      const point = pointsByDate.get(key);
      if (!point) {
        continue;
      }
      point.orders += 1;
      const rate = Number(order.exchangeRateToUsd || 1);
      point.revenue += Number(order.total) / rate;
    }

    const trendPoints = [] as Array<{
      date: string;
      label: string;
      orders: number;
      revenue: number;
    }>;

    let currentPeriodRevenue = 0;
    let previousPeriodRevenue = 0;

    for (let i = 0; i < totalTrackedDays; i += 1) {
      const date = this.startOfDay(this.addDays(window.previousStart, i));
      const key = this.toDayKey(date);
      const point = pointsByDate.get(key) ?? { orders: 0, revenue: 0 };

      if (i < window.days) {
        previousPeriodRevenue += point.revenue;
      } else {
        currentPeriodRevenue += point.revenue;
      }

      if (date >= window.currentStart) {
        const label = window.days > 14
          ? date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
          : date.toLocaleDateString('es-AR', { weekday: 'short' });

        trendPoints.push({
          date: key,
          label,
          orders: point.orders,
          revenue: Number(point.revenue.toFixed(2)),
        });
      }
    }

    const trendRevenue = trendPoints.reduce((sum, point) => sum + point.revenue, 0);
    const trendOrders = trendPoints.reduce((sum, point) => sum + point.orders, 0);

    const deltaPercent = previousPeriodRevenue > 0
      ? Number((((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100).toFixed(2))
      : null;

    return {
      period: {
        preset: window.preset,
        label: window.label,
        from: this.toDayKey(window.currentStart),
        to: this.toDayKey(window.currentEnd),
        days: window.days,
      },
      trend: {
        totalOrders: trendOrders,
        totalRevenue: Number(trendRevenue.toFixed(2)),
        points: trendPoints,
      },
      comparison: {
        currentRevenue: Number(currentPeriodRevenue.toFixed(2)),
        previousRevenue: Number(previousPeriodRevenue.toFixed(2)),
        deltaPercent,
      },
    };
  }

  private resolveSalesWindow(query: DashboardSummaryQueryDto) {
    const today = this.startOfDay(new Date());
    const preset = query.salesPreset ?? '7d';

    if (preset === 'custom') {
      if (!query.from || !query.to) {
        throw new BadRequestException('Custom sales range requires both from and to dates');
      }

      const currentStart = this.startOfDay(new Date(query.from));
      const currentEnd = this.startOfDay(new Date(query.to));

      if (Number.isNaN(currentStart.getTime()) || Number.isNaN(currentEnd.getTime())) {
        throw new BadRequestException('Invalid custom sales range dates');
      }
      if (currentStart > currentEnd) {
        throw new BadRequestException('Custom sales range from must be before or equal to to');
      }

      const days = this.diffDaysInclusive(currentStart, currentEnd);

      const previousEnd = this.addDays(currentStart, -1);
      const previousStart = this.addDays(previousEnd, -(days - 1));

      return {
        preset,
        label: `${this.toDayKey(currentStart)} a ${this.toDayKey(currentEnd)}`,
        days,
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      };
    }

    if (preset === 'month') {
      const reference = query.month ? this.parseMonth(query.month) : today;
      const currentStart = this.startOfDay(new Date(reference.getFullYear(), reference.getMonth(), 1));
      const currentEnd = this.startOfDay(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
      const days = this.diffDaysInclusive(currentStart, currentEnd);
      const previousEnd = this.addDays(currentStart, -1);
      const previousStart = this.addDays(previousEnd, -(days - 1));

      return {
        preset,
        label: reference.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
        days,
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      };
    }

    const days = preset === '30d' ? 30 : 7;
    const currentEnd = today;
    const currentStart = this.addDays(currentEnd, -(days - 1));
    const previousEnd = this.addDays(currentStart, -1);
    const previousStart = this.addDays(previousEnd, -(days - 1));

    return {
      preset,
      label: `Ultimos ${days} dias`,
      days,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
  }

  private parseMonth(value: string) {
    const [yearRaw, monthRaw] = value.split('-');
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;

    const parsed = new Date(Date.UTC(year, monthIndex, 1));
    if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== monthIndex) {
      throw new BadRequestException('Invalid month format, expected YYYY-MM');
    }

    return parsed;
  }

  private diffDaysInclusive(start: Date, end: Date) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
  }

  private toDayKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Returns midnight UTC for the given date, so that toDayKey(startOfDay(d)) === toDayKey(d)
   * regardless of the server's local timezone.
   */
  private startOfDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private addDays(date: Date, days: number) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 0, 0, 0, 0));
  }

  private buildInventoryDescriptor(product: Product) {
    const parts: string[] = [];

    if (product.weightValue && product.weightUnit) {
      parts.push(`${product.weightValue} ${product.weightUnit}`);
    }

    if (product.lengthValue || product.widthValue || product.heightValue) {
      parts.push(
        `${product.lengthValue ?? 0} x ${product.widthValue ?? 0} x ${product.heightValue ?? 0} ${product.dimensionUnit ?? 'cm'}`,
      );
    }

    if (product.attributeValues?.length) {
      parts.push(`${product.attributeValues.length} atributo(s)`);
    }

    return parts.join(' · ') || null;
  }
}