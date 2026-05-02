import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ShippingAddress } from '../orders/entities/shipping-address.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AddShipmentEventDto } from './dto/add-event.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QueryShipmentsDto } from './dto/query-shipments.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-status.dto';
import { UpsertCarrierDto } from './dto/upsert-carrier.dto';
import { Carrier } from './entities/carrier.entity';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { ShipmentEventType } from './enums/shipment-event-type.enum';
import { ShipmentStatus } from './enums/shipment-status.enum';

interface ActorUser {
  id: string;
  role: Role;
}

const BACKOFFICE_ROLES: readonly Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.BOSS,
  Role.MARKETING,
  Role.SALES,
];

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentsRepository: Repository<Shipment>,
    @InjectRepository(ShipmentItem)
    private readonly itemsRepository: Repository<ShipmentItem>,
    @InjectRepository(ShipmentEvent)
    private readonly eventsRepository: Repository<ShipmentEvent>,
    @InjectRepository(Carrier)
    private readonly carriersRepository: Repository<Carrier>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ===== Queries =====

  async findAll(query: QueryShipmentsDto, actor: ActorUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Shipment> = {};
    if (query.status) where.status = query.status;
    if (query.orderId) where.order = { id: query.orderId } as Order;
    if (query.carrierId) where.carrier = { id: query.carrierId } as Carrier;
    if (query.trackingNumber) where.trackingNumber = query.trackingNumber;

    if (!this.isBackoffice(actor.role)) {
      where.order = { ...(where.order as object), user: { id: actor.id } } as Order;
    }

    const [items, total] = await this.shipmentsRepository.findAndCount({
      where,
      relations: { order: { user: true }, carrier: true },
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

  async findOne(id: string, actor: ActorUser): Promise<Shipment> {
    const shipment = await this.findOneOrThrow(id);
    this.assertOrderAccess(shipment.order, actor);
    return shipment;
  }

  async findByOrder(orderId: string, actor: ActorUser): Promise<Shipment[]> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    this.assertOrderAccess(order, actor);

    return this.shipmentsRepository.find({
      where: { order: { id: orderId } },
      relations: { carrier: true, items: { orderItem: true } },
      order: { createdAt: 'ASC' },
    });
  }

  // ===== Mutations =====

  async create(dto: CreateShipmentDto, actor: ActorUser): Promise<Shipment> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId },
        relations: { user: true, items: true, shippingAddresses: true },
      });
      if (!order) throw new NotFoundException('Order not found');

      const carrier = dto.carrierId
        ? await manager.findOne(Carrier, { where: { id: dto.carrierId } })
        : null;
      if (dto.carrierId && !carrier) {
        throw new NotFoundException('Carrier not found');
      }

      await this.assertItemsAvailable(manager, order, dto.items);

      const primaryAddress =
        order.shippingAddresses?.find((a) => a.isDefault) ?? order.shippingAddresses?.[0] ?? null;

      const shipment = manager.create(Shipment, {
        order,
        carrier,
        status: ShipmentStatus.PENDING,
        trackingNumber: dto.trackingNumber ?? null,
        trackingUrl: this.buildTrackingUrl(carrier, dto.trackingNumber ?? null, dto.trackingUrl ?? null),
        shippingCost: dto.shippingCost ?? '0',
        currencyCode: dto.currencyCode ?? order.currencyCode ?? 'USD',
        shipToName: dto.shipToName ?? this.formatAddressName(primaryAddress) ?? null,
        shipToStreet: dto.shipToStreet ?? primaryAddress?.street ?? null,
        shipToCity: dto.shipToCity ?? primaryAddress?.city ?? null,
        shipToState: dto.shipToState ?? primaryAddress?.state ?? null,
        shipToPostalCode: dto.shipToPostalCode ?? primaryAddress?.postalCode ?? null,
        shipToCountry: dto.shipToCountry ?? primaryAddress?.country ?? null,
        shipToPhone: dto.shipToPhone ?? primaryAddress?.phoneNumber ?? null,
        shipToLat: dto.shipToLat != null ? String(dto.shipToLat) : null,
        shipToLng: dto.shipToLng != null ? String(dto.shipToLng) : null,
        estimatedDeliveryAt: dto.estimatedDeliveryAt ? new Date(dto.estimatedDeliveryAt) : null,
        notes: dto.notes ?? null,
        metadata: {},
      });
      const savedShipment = await manager.save(shipment);

      const items = dto.items.map((item) =>
        manager.create(ShipmentItem, {
          shipment: savedShipment,
          orderItem: { id: item.orderItemId } as OrderItem,
          quantity: item.quantity,
        }),
      );
      await manager.save(items);

      const event = manager.create(ShipmentEvent, {
        shipment: savedShipment,
        type: ShipmentEventType.STATUS_CHANGE,
        status: ShipmentStatus.PENDING,
        description: 'Envio creado',
        occurredAt: new Date(),
        createdBy: { id: actor.id } as User,
      });
      await manager.save(event);

      return this.loadWithRelations(manager.getRepository(Shipment), savedShipment.id);
    }).then(async (shipment) => {
      await this.sendEmailForStatus(shipment).catch((error) => {
        this.logger.warn(
          `Shipment created email failed for ${shipment.id}: ${(error as Error).message}`,
        );
      });
      return shipment;
    });
  }

  async update(id: string, dto: UpdateShipmentDto, actor: ActorUser): Promise<Shipment> {
    const shipment = await this.findOneOrThrow(id);
    this.assertBackoffice(actor);

    if (dto.carrierId !== undefined) {
      if (dto.carrierId === null) {
        shipment.carrier = null;
      } else {
        const carrier = await this.carriersRepository.findOne({ where: { id: dto.carrierId } });
        if (!carrier) throw new NotFoundException('Carrier not found');
        shipment.carrier = carrier;
      }
    }
    if (dto.trackingNumber !== undefined) shipment.trackingNumber = dto.trackingNumber;
    if (dto.trackingUrl !== undefined) shipment.trackingUrl = dto.trackingUrl;
    // Rebuild tracking URL from template when number changes and no override provided
    if (
      dto.trackingNumber !== undefined &&
      dto.trackingUrl === undefined &&
      shipment.carrier?.trackingUrlTemplate
    ) {
      shipment.trackingUrl = this.buildTrackingUrl(
        shipment.carrier,
        shipment.trackingNumber,
        null,
      );
    }
    if (dto.shippingCost !== undefined) shipment.shippingCost = dto.shippingCost;
    if (dto.currencyCode !== undefined) shipment.currencyCode = dto.currencyCode;
    if (dto.shipToName !== undefined) shipment.shipToName = dto.shipToName;
    if (dto.shipToStreet !== undefined) shipment.shipToStreet = dto.shipToStreet;
    if (dto.shipToCity !== undefined) shipment.shipToCity = dto.shipToCity;
    if (dto.shipToState !== undefined) shipment.shipToState = dto.shipToState;
    if (dto.shipToPostalCode !== undefined) shipment.shipToPostalCode = dto.shipToPostalCode;
    if (dto.shipToCountry !== undefined) shipment.shipToCountry = dto.shipToCountry;
    if (dto.shipToPhone !== undefined) shipment.shipToPhone = dto.shipToPhone;
    if (dto.shipToLat !== undefined) {
      shipment.shipToLat = dto.shipToLat == null ? null : String(dto.shipToLat);
    }
    if (dto.shipToLng !== undefined) {
      shipment.shipToLng = dto.shipToLng == null ? null : String(dto.shipToLng);
    }
    if (dto.estimatedDeliveryAt !== undefined) {
      shipment.estimatedDeliveryAt = dto.estimatedDeliveryAt
        ? new Date(dto.estimatedDeliveryAt)
        : null;
    }
    if (dto.notes !== undefined) shipment.notes = dto.notes;

    return this.shipmentsRepository.save(shipment);
  }

  async updateStatus(
    id: string,
    dto: UpdateShipmentStatusDto,
    actor: ActorUser,
  ): Promise<Shipment> {
    this.assertBackoffice(actor);
    const shipment = await this.findOneOrThrow(id);

    if (!this.isValidTransition(shipment.status, dto.status)) {
      throw new BadRequestException(
        `Invalid transition from ${shipment.status} to ${dto.status}`,
      );
    }

    const previousStatus = shipment.status;
    shipment.status = dto.status;
    const now = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    if (dto.status === ShipmentStatus.IN_TRANSIT && !shipment.shippedAt) {
      shipment.shippedAt = now;
    }
    if (dto.status === ShipmentStatus.DELIVERED && !shipment.deliveredAt) {
      shipment.deliveredAt = now;
    }

    const event = this.eventsRepository.create({
      shipment,
      type: ShipmentEventType.STATUS_CHANGE,
      status: dto.status,
      location: dto.location ?? null,
      description: dto.note ?? null,
      occurredAt: now,
      createdBy: { id: actor.id } as User,
    });

    await this.shipmentsRepository.save(shipment);
    await this.eventsRepository.save(event);

    const refreshed = await this.findOneOrThrow(id);

    if (previousStatus !== refreshed.status) {
      await this.sendEmailForStatus(refreshed).catch((error) => {
        this.logger.warn(
          `Shipment status email failed for ${refreshed.id}: ${(error as Error).message}`,
        );
      });
    }

    return refreshed;
  }

  async addEvent(id: string, dto: AddShipmentEventDto, actor: ActorUser): Promise<ShipmentEvent> {
    this.assertBackoffice(actor);
    const shipment = await this.findOneOrThrow(id);

    const event = this.eventsRepository.create({
      shipment,
      type: dto.type ?? ShipmentEventType.NOTE,
      status: dto.status ?? null,
      location: dto.location ?? null,
      lat: dto.lat != null ? String(dto.lat) : null,
      lng: dto.lng != null ? String(dto.lng) : null,
      description: dto.description ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      createdBy: { id: actor.id } as User,
    });
    return this.eventsRepository.save(event);
  }

  async listEvents(id: string, actor: ActorUser): Promise<ShipmentEvent[]> {
    const shipment = await this.findOneOrThrow(id);
    this.assertOrderAccess(shipment.order, actor);
    return this.eventsRepository.find({
      where: { shipment: { id } },
      relations: { createdBy: true },
      order: { occurredAt: 'DESC' },
    });
  }

  async remove(id: string, actor: ActorUser): Promise<void> {
    this.assertBackoffice(actor);
    const shipment = await this.findOneOrThrow(id);
    if (
      shipment.status !== ShipmentStatus.PENDING &&
      shipment.status !== ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only pending or cancelled shipments can be deleted. Cancel it first.',
      );
    }
    await this.shipmentsRepository.remove(shipment);
  }

  // ===== Carriers CRUD =====

  listCarriers(onlyEnabled = false): Promise<Carrier[]> {
    return this.carriersRepository.find({
      where: onlyEnabled ? { isEnabled: true } : {},
      order: { displayOrder: 'ASC', label: 'ASC' },
    });
  }

  async getCarrier(id: string): Promise<Carrier> {
    const carrier = await this.carriersRepository.findOne({ where: { id } });
    if (!carrier) throw new NotFoundException('Carrier not found');
    return carrier;
  }

  async createCarrier(dto: UpsertCarrierDto): Promise<Carrier> {
    const existing = await this.carriersRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Code "${dto.code}" already exists`);
    const carrier = this.carriersRepository.create({
      code: dto.code,
      label: dto.label,
      description: dto.description ?? null,
      trackingUrlTemplate: dto.trackingUrlTemplate ?? null,
      logoUrl: dto.logoUrl ?? null,
      isEnabled: dto.isEnabled ?? true,
      displayOrder: dto.displayOrder ?? 0,
      config: dto.config ?? {},
    });
    return this.carriersRepository.save(carrier);
  }

  async updateCarrier(id: string, dto: UpsertCarrierDto): Promise<Carrier> {
    const carrier = await this.getCarrier(id);
    if (dto.code && dto.code !== carrier.code) {
      const clash = await this.carriersRepository.findOne({ where: { code: dto.code } });
      if (clash) throw new BadRequestException(`Code "${dto.code}" already exists`);
      carrier.code = dto.code;
    }
    carrier.label = dto.label;
    carrier.description = dto.description ?? null;
    carrier.trackingUrlTemplate = dto.trackingUrlTemplate ?? null;
    carrier.logoUrl = dto.logoUrl ?? null;
    carrier.isEnabled = dto.isEnabled ?? carrier.isEnabled;
    carrier.displayOrder = dto.displayOrder ?? carrier.displayOrder;
    carrier.config = dto.config ?? {};
    return this.carriersRepository.save(carrier);
  }

  async deleteCarrier(id: string): Promise<void> {
    const carrier = await this.getCarrier(id);
    const inUse = await this.shipmentsRepository.count({
      where: { carrier: { id: carrier.id } },
    });
    if (inUse > 0) {
      throw new BadRequestException('Cannot delete a carrier with existing shipments');
    }
    await this.carriersRepository.remove(carrier);
  }

  // ===== Helpers =====

  private async findOneOrThrow(id: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id },
      relations: {
        order: { user: true },
        carrier: true,
        items: { orderItem: { variant: { product: true }, product: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  private loadWithRelations(repo: Repository<Shipment>, id: string): Promise<Shipment> {
    return repo
      .findOne({
        where: { id },
        relations: {
          order: { user: true },
          carrier: true,
          items: { orderItem: { variant: { product: true }, product: true } },
        },
      })
      .then((s) => {
        if (!s) throw new NotFoundException('Shipment not found after save');
        return s;
      });
  }

  private async assertItemsAvailable(
    manager: import('typeorm').EntityManager,
    order: Order,
    items: CreateShipmentDto['items'],
  ): Promise<void> {
    const allowedItemIds = new Set((order.items ?? []).map((i) => i.id));
    const orderItemMap = new Map((order.items ?? []).map((i) => [i.id, i]));

    for (const item of items) {
      if (!allowedItemIds.has(item.orderItemId)) {
        throw new BadRequestException(
          `Order item ${item.orderItemId} does not belong to order ${order.id}`,
        );
      }
    }

    const existingItems = await manager
      .createQueryBuilder(ShipmentItem, 'si')
      .innerJoin('si.shipment', 's')
      .innerJoin('si.orderItem', 'oi')
      .where('oi.id IN (:...ids)', { ids: items.map((i) => i.orderItemId) })
      .andWhere('s.order_id = :orderId', { orderId: order.id })
      .andWhere('s.status != :cancelled', { cancelled: ShipmentStatus.CANCELLED })
      .select(['oi.id AS "orderItemId"', 'si.quantity AS "quantity"'])
      .getRawMany<{ orderItemId: string; quantity: number }>();

    const alreadyShipped = new Map<string, number>();
    for (const row of existingItems) {
      alreadyShipped.set(
        row.orderItemId,
        (alreadyShipped.get(row.orderItemId) ?? 0) + Number(row.quantity),
      );
    }

    for (const item of items) {
      const orderItem = orderItemMap.get(item.orderItemId);
      if (!orderItem) continue;
      const shipped = alreadyShipped.get(item.orderItemId) ?? 0;
      const remaining = orderItem.quantity - shipped;
      if (item.quantity > remaining) {
        throw new BadRequestException(
          `Item ${orderItem.snapshotProductName ?? item.orderItemId} only has ${remaining} unit(s) remaining to ship`,
        );
      }
    }
  }

  private buildTrackingUrl(
    carrier: Carrier | null,
    trackingNumber: string | null,
    override: string | null,
  ): string | null {
    if (override) return override;
    if (!carrier?.trackingUrlTemplate || !trackingNumber) return null;
    return carrier.trackingUrlTemplate.replace(/\{tracking\}/gi, encodeURIComponent(trackingNumber));
  }

  private formatAddressName(address: ShippingAddress | null): string | null {
    if (!address) return null;
    return [address.firstName, address.lastName].filter(Boolean).join(' ').trim() || null;
  }

  private isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
    if (from === to) return true;
    const allowed: Record<ShipmentStatus, ShipmentStatus[]> = {
      [ShipmentStatus.PENDING]: [
        ShipmentStatus.READY_TO_SHIP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.READY_TO_SHIP]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.IN_TRANSIT]: [
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
        ShipmentStatus.RETURNED,
      ],
      [ShipmentStatus.OUT_FOR_DELIVERY]: [
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
        ShipmentStatus.RETURNED,
      ],
      [ShipmentStatus.DELIVERED]: [ShipmentStatus.RETURNED],
      [ShipmentStatus.FAILED]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.CANCELLED,
      ],
      [ShipmentStatus.RETURNED]: [],
      [ShipmentStatus.CANCELLED]: [],
    };
    return allowed[from]?.includes(to) ?? false;
  }

  private async sendEmailForStatus(shipment: Shipment): Promise<void> {
    if (!shipment.order?.user?.email) return;
    const payload = {
      order: shipment.order,
      carrier: shipment.carrier?.label ?? 'Envio manual',
      trackingNumber: shipment.trackingNumber ?? '',
      trackingUrl: shipment.trackingUrl ?? '',
      estimatedDelivery: shipment.estimatedDeliveryAt?.toISOString() ?? '',
      deliveredAt: shipment.deliveredAt?.toISOString() ?? '',
    };
    if (shipment.status === ShipmentStatus.PENDING) {
      await this.notificationsService.sendShipmentCreated(payload);
    } else if (
      shipment.status === ShipmentStatus.IN_TRANSIT ||
      shipment.status === ShipmentStatus.OUT_FOR_DELIVERY
    ) {
      await this.notificationsService.sendShipmentInTransit(payload);
    } else if (shipment.status === ShipmentStatus.DELIVERED) {
      await this.notificationsService.sendShipmentDelivered(payload);
    }
  }

  private assertBackoffice(actor: ActorUser): void {
    if (!this.isBackoffice(actor.role)) {
      throw new ForbiddenException('Only backoffice can manage shipments');
    }
  }

  private assertOrderAccess(order: Order, actor: ActorUser): void {
    if (this.isBackoffice(actor.role)) return;
    if (order.user?.id !== actor.id) {
      throw new ForbiddenException('You do not have access to this shipment');
    }
  }

  private isBackoffice(role: Role): boolean {
    return BACKOFFICE_ROLES.includes(role);
  }
}
