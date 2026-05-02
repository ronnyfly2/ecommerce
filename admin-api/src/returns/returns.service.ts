import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { User } from '../users/entities/user.entity';
import { AddReturnEventDto } from './dto/add-event.dto';
import { ApproveReturnDto } from './dto/approve-return.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { QueryReturnsDto } from './dto/query-returns.dto';
import { ReceiveReturnDto } from './dto/receive-return.dto';
import { RefundReturnDto } from './dto/refund-return.dto';
import { RejectReturnDto } from './dto/reject-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { ReturnEvent } from './entities/return-event.entity';
import { ReturnItem } from './entities/return-item.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { ReturnEventType } from './enums/return-event-type.enum';
import { ReturnStatus } from './enums/return-status.enum';

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

// Only orders that have reached these statuses are eligible for returns.
const RETURNABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @InjectRepository(ReturnRequest)
    private readonly returnsRepository: Repository<ReturnRequest>,
    @InjectRepository(ReturnItem)
    private readonly itemsRepository: Repository<ReturnItem>,
    @InjectRepository(ReturnEvent)
    private readonly eventsRepository: Repository<ReturnEvent>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ===== Queries =====

  async findAll(query: QueryReturnsDto, actor: ActorUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<ReturnRequest> = {};
    if (query.status) where.status = query.status;
    if (query.reason) where.reason = query.reason;
    if (query.orderId) where.order = { id: query.orderId } as Order;
    if (query.rmaNumber) where.rmaNumber = query.rmaNumber;
    if (this.isBackoffice(actor.role)) {
      if (query.userId) where.user = { id: query.userId } as User;
    } else {
      where.user = { id: actor.id } as User;
    }

    const [items, total] = await this.returnsRepository.findAndCount({
      where,
      relations: { order: true, user: true, reviewedBy: true },
      order: { requestedAt: 'DESC' },
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

  async findOne(id: string, actor: ActorUser): Promise<ReturnRequest> {
    const request = await this.findOneOrThrow(id);
    this.assertAccess(request, actor);
    return request;
  }

  async findByOrder(orderId: string, actor: ActorUser): Promise<ReturnRequest[]> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!this.isBackoffice(actor.role) && order.user?.id !== actor.id) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.returnsRepository.find({
      where: { order: { id: orderId } },
      relations: {
        user: true,
        items: { orderItem: true },
        reviewedBy: true,
      },
      order: { requestedAt: 'DESC' },
    });
  }

  async listEvents(id: string, actor: ActorUser): Promise<ReturnEvent[]> {
    const request = await this.findOneOrThrow(id);
    this.assertAccess(request, actor);
    return this.eventsRepository.find({
      where: { returnRequest: { id } },
      relations: { createdBy: true },
      order: { occurredAt: 'DESC' },
    });
  }

  // ===== Mutations =====

  async create(dto: CreateReturnDto, actor: ActorUser): Promise<ReturnRequest> {
    return this.dataSource
      .transaction(async (manager) => {
        const order = await manager.findOne(Order, {
          where: { id: dto.orderId },
          relations: { user: true, items: true },
        });
        if (!order) throw new NotFoundException('Order not found');

        if (!this.isBackoffice(actor.role) && order.user?.id !== actor.id) {
          throw new ForbiddenException('You cannot request a return on another customer order');
        }

        if (!RETURNABLE_ORDER_STATUSES.includes(order.status)) {
          throw new BadRequestException(
            `Returns are only allowed for orders in ${RETURNABLE_ORDER_STATUSES.join(', ')}`,
          );
        }

        await this.assertItemsAvailable(manager, order, dto.items);

        const request = manager.create(ReturnRequest, {
          rmaNumber: await this.generateRmaNumber(manager),
          order,
          user: order.user,
          status: ReturnStatus.PENDING,
          reason: dto.reason,
          description: dto.description ?? null,
          customerNotes: dto.customerNotes ?? null,
          currencyCode: order.currencyCode ?? 'USD',
          requestedAt: new Date(),
          metadata: {},
        });
        const saved = await manager.save(request);

        const items = dto.items.map((item) =>
          manager.create(ReturnItem, {
            returnRequest: saved,
            orderItem: { id: item.orderItemId } as OrderItem,
            quantity: item.quantity,
            reason: item.reason ?? null,
            conditionNotes: item.conditionNotes ?? null,
            restockable: item.restockable ?? true,
          }),
        );
        await manager.save(items);

        const event = manager.create(ReturnEvent, {
          returnRequest: saved,
          type: ReturnEventType.STATUS_CHANGE,
          status: ReturnStatus.PENDING,
          description: 'Devolucion solicitada',
          occurredAt: new Date(),
          createdBy: { id: actor.id } as User,
        });
        await manager.save(event);

        return this.loadWithRelations(manager.getRepository(ReturnRequest), saved.id);
      })
      .then(async (request) => {
        await this.sendEmailRequested(request).catch((error) => {
          this.logger.warn(
            `Return requested email failed for ${request.id}: ${(error as Error).message}`,
          );
        });
        return request;
      });
  }

  async update(id: string, dto: UpdateReturnDto, actor: ActorUser): Promise<ReturnRequest> {
    const request = await this.findOneOrThrow(id);
    const isStaff = this.isBackoffice(actor.role);
    const isOwner = request.user?.id === actor.id;

    if (!isStaff && !isOwner) {
      throw new ForbiddenException('You do not have access to this return');
    }

    if (request.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Only pending returns can be edited');
    }

    if (dto.reason !== undefined) request.reason = dto.reason;
    if (dto.description !== undefined) request.description = dto.description;
    if (dto.customerNotes !== undefined) request.customerNotes = dto.customerNotes;
    if (dto.internalNotes !== undefined) {
      if (!isStaff) {
        throw new ForbiddenException('Only staff can edit internal notes');
      }
      request.internalNotes = dto.internalNotes;
    }

    await this.returnsRepository.save(request);
    return this.findOneOrThrow(id);
  }

  async cancel(id: string, actor: ActorUser): Promise<ReturnRequest> {
    const request = await this.findOneOrThrow(id);
    const isStaff = this.isBackoffice(actor.role);
    const isOwner = request.user?.id === actor.id;

    if (!isStaff && !isOwner) {
      throw new ForbiddenException('You do not have access to this return');
    }

    if (
      request.status !== ReturnStatus.PENDING &&
      request.status !== ReturnStatus.APPROVED
    ) {
      throw new BadRequestException('Only pending or approved returns can be cancelled');
    }

    return this.transitionStatus(request, ReturnStatus.CANCELLED, actor, {
      description: 'Devolucion cancelada',
      stampField: 'cancelledAt',
    });
  }

  async approve(id: string, dto: ApproveReturnDto, actor: ActorUser): Promise<ReturnRequest> {
    this.assertBackoffice(actor);
    const request = await this.findOneOrThrow(id);

    if (request.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Only pending returns can be approved');
    }

    request.instructions = dto.instructions ?? request.instructions;
    if (dto.internalNotes !== undefined) request.internalNotes = dto.internalNotes;
    request.reviewedBy = { id: actor.id } as User;

    const updated = await this.transitionStatus(request, ReturnStatus.APPROVED, actor, {
      description: 'Devolucion aprobada',
      stampField: 'approvedAt',
    });

    await this.sendEmailApproved(updated).catch((error) => {
      this.logger.warn(
        `Return approved email failed for ${updated.id}: ${(error as Error).message}`,
      );
    });

    return updated;
  }

  async reject(id: string, dto: RejectReturnDto, actor: ActorUser): Promise<ReturnRequest> {
    this.assertBackoffice(actor);
    const request = await this.findOneOrThrow(id);

    if (request.status !== ReturnStatus.PENDING) {
      throw new BadRequestException('Only pending returns can be rejected');
    }

    request.rejectionReason = dto.rejectionReason;
    if (dto.internalNotes !== undefined) request.internalNotes = dto.internalNotes;
    request.reviewedBy = { id: actor.id } as User;

    const updated = await this.transitionStatus(request, ReturnStatus.REJECTED, actor, {
      description: `Devolucion rechazada: ${dto.rejectionReason}`,
      stampField: 'rejectedAt',
    });

    await this.sendEmailRejected(updated).catch((error) => {
      this.logger.warn(
        `Return rejected email failed for ${updated.id}: ${(error as Error).message}`,
      );
    });

    return updated;
  }

  async receive(id: string, dto: ReceiveReturnDto, actor: ActorUser): Promise<ReturnRequest> {
    this.assertBackoffice(actor);
    const request = await this.findOneOrThrow(id);

    if (request.status !== ReturnStatus.APPROVED) {
      throw new BadRequestException('Only approved returns can be received');
    }

    const itemMap = new Map(request.items.map((i) => [i.id, i]));
    for (const entry of dto.items) {
      const item = itemMap.get(entry.returnItemId);
      if (!item) {
        throw new BadRequestException(
          `Return item ${entry.returnItemId} does not belong to this return`,
        );
      }
      if (entry.receivedQuantity > item.quantity) {
        throw new BadRequestException(
          `Received quantity exceeds requested for item ${item.id}`,
        );
      }
    }

    return this.dataSource
      .transaction(async (manager) => {
        for (const entry of dto.items) {
          const item = itemMap.get(entry.returnItemId)!;
          item.receivedQuantity = entry.receivedQuantity;
          if (entry.restockable !== undefined) item.restockable = entry.restockable;
          if (entry.conditionNotes !== undefined) {
            item.conditionNotes = entry.conditionNotes;
          }
          await manager.save(item);
        }

        if (dto.internalNotes !== undefined) {
          request.internalNotes = dto.internalNotes;
        }
        request.status = ReturnStatus.RECEIVED;
        request.receivedAt = new Date();
        await manager.save(request);

        const event = manager.create(ReturnEvent, {
          returnRequest: request,
          type: ReturnEventType.STATUS_CHANGE,
          status: ReturnStatus.RECEIVED,
          description: 'Items recibidos en el almacen',
          occurredAt: new Date(),
          createdBy: { id: actor.id } as User,
        });
        await manager.save(event);

        return this.loadWithRelations(manager.getRepository(ReturnRequest), request.id);
      });
  }

  async refund(id: string, dto: RefundReturnDto, actor: ActorUser): Promise<ReturnRequest> {
    this.assertBackoffice(actor);
    const request = await this.findOneOrThrow(id);

    if (
      request.status !== ReturnStatus.RECEIVED &&
      request.status !== ReturnStatus.APPROVED
    ) {
      throw new BadRequestException('Refunds require the return to be approved or received');
    }

    request.refundAmount = dto.refundAmount;
    request.refundMethod = dto.refundMethod;
    request.refundReference = dto.refundReference ?? null;
    if (dto.currencyCode) request.currencyCode = dto.currencyCode;
    if (dto.internalNotes !== undefined) request.internalNotes = dto.internalNotes;

    const updated = await this.dataSource.transaction(async (manager) => {
      request.status = ReturnStatus.REFUNDED;
      request.refundedAt = new Date();
      await manager.save(request);

      const event = manager.create(ReturnEvent, {
        returnRequest: request,
        type: ReturnEventType.REFUND_ISSUED,
        status: ReturnStatus.REFUNDED,
        description: `Reembolso emitido (${dto.refundMethod}): ${dto.refundAmount} ${request.currencyCode}`,
        metadata: {
          refundAmount: dto.refundAmount,
          refundMethod: dto.refundMethod,
          refundReference: dto.refundReference ?? null,
        },
        occurredAt: new Date(),
        createdBy: { id: actor.id } as User,
      });
      await manager.save(event);

      return this.loadWithRelations(manager.getRepository(ReturnRequest), request.id);
    });

    await this.sendEmailRefunded(updated).catch((error) => {
      this.logger.warn(
        `Return refunded email failed for ${updated.id}: ${(error as Error).message}`,
      );
    });

    return updated;
  }

  async addEvent(id: string, dto: AddReturnEventDto, actor: ActorUser): Promise<ReturnEvent> {
    this.assertBackoffice(actor);
    const request = await this.findOneOrThrow(id);

    const event = this.eventsRepository.create({
      returnRequest: request,
      type: ReturnEventType.NOTE,
      description: dto.description,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      createdBy: { id: actor.id } as User,
    });
    return this.eventsRepository.save(event);
  }

  async remove(id: string, actor: ActorUser): Promise<void> {
    this.assertBackoffice(actor);
    const request = await this.findOneOrThrow(id);
    if (
      request.status !== ReturnStatus.PENDING &&
      request.status !== ReturnStatus.REJECTED &&
      request.status !== ReturnStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only pending, rejected or cancelled returns can be deleted',
      );
    }
    await this.returnsRepository.remove(request);
  }

  // ===== Helpers =====

  private async findOneOrThrow(id: string): Promise<ReturnRequest> {
    const request = await this.returnsRepository.findOne({
      where: { id },
      relations: {
        order: { user: true },
        user: true,
        reviewedBy: true,
        items: { orderItem: { variant: { product: true }, product: true } },
      },
    });
    if (!request) throw new NotFoundException('Return not found');
    return request;
  }

  private loadWithRelations(
    repo: Repository<ReturnRequest>,
    id: string,
  ): Promise<ReturnRequest> {
    return repo
      .findOne({
        where: { id },
        relations: {
          order: { user: true },
          user: true,
          reviewedBy: true,
          items: { orderItem: { variant: { product: true }, product: true } },
        },
      })
      .then((r) => {
        if (!r) throw new NotFoundException('Return not found after save');
        return r;
      });
  }

  private async assertItemsAvailable(
    manager: EntityManager,
    order: Order,
    items: CreateReturnDto['items'],
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
      .createQueryBuilder(ReturnItem, 'ri')
      .innerJoin('ri.returnRequest', 'r')
      .innerJoin('ri.orderItem', 'oi')
      .where('oi.id IN (:...ids)', { ids: items.map((i) => i.orderItemId) })
      .andWhere('r.order_id = :orderId', { orderId: order.id })
      .andWhere('r.status NOT IN (:...exclude)', {
        exclude: [ReturnStatus.CANCELLED, ReturnStatus.REJECTED],
      })
      .select(['oi.id AS "orderItemId"', 'ri.quantity AS "quantity"'])
      .getRawMany<{ orderItemId: string; quantity: number }>();

    const alreadyReturning = new Map<string, number>();
    for (const row of existingItems) {
      alreadyReturning.set(
        row.orderItemId,
        (alreadyReturning.get(row.orderItemId) ?? 0) + Number(row.quantity),
      );
    }

    for (const item of items) {
      const orderItem = orderItemMap.get(item.orderItemId);
      if (!orderItem) continue;
      const returning = alreadyReturning.get(item.orderItemId) ?? 0;
      const remaining = orderItem.quantity - returning;
      if (item.quantity > remaining) {
        throw new BadRequestException(
          `Item ${orderItem.snapshotProductName ?? item.orderItemId} only has ${remaining} unit(s) eligible for return`,
        );
      }
    }
  }

  private async transitionStatus(
    request: ReturnRequest,
    to: ReturnStatus,
    actor: ActorUser,
    opts: {
      description: string;
      stampField?:
        | 'approvedAt'
        | 'rejectedAt'
        | 'receivedAt'
        | 'refundedAt'
        | 'cancelledAt';
    },
  ): Promise<ReturnRequest> {
    return this.dataSource.transaction(async (manager) => {
      request.status = to;
      if (opts.stampField) {
        request[opts.stampField] = new Date();
      }
      await manager.save(request);

      const event = manager.create(ReturnEvent, {
        returnRequest: request,
        type: ReturnEventType.STATUS_CHANGE,
        status: to,
        description: opts.description,
        occurredAt: new Date(),
        createdBy: { id: actor.id } as User,
      });
      await manager.save(event);

      return this.loadWithRelations(manager.getRepository(ReturnRequest), request.id);
    });
  }

  private async generateRmaNumber(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `R${randomBytes(4).toString('hex').toUpperCase()}`;
      const clash = await manager.findOne(ReturnRequest, {
        where: { rmaNumber: code },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new Error('Unable to generate unique RMA number');
  }

  private async sendEmailRequested(request: ReturnRequest): Promise<void> {
    if (!request.order?.user?.email) return;
    await this.notificationsService.sendReturnRequested({
      order: request.order,
      rmaNumber: request.rmaNumber,
      reason: request.reason,
    });
  }

  private async sendEmailApproved(request: ReturnRequest): Promise<void> {
    if (!request.order?.user?.email) return;
    await this.notificationsService.sendReturnApproved({
      order: request.order,
      rmaNumber: request.rmaNumber,
      instructions: request.instructions ?? '',
    });
  }

  private async sendEmailRejected(request: ReturnRequest): Promise<void> {
    if (!request.order?.user?.email) return;
    await this.notificationsService.sendReturnRejected({
      order: request.order,
      rmaNumber: request.rmaNumber,
      rejectionReason: request.rejectionReason ?? '',
    });
  }

  private async sendEmailRefunded(request: ReturnRequest): Promise<void> {
    if (!request.order?.user?.email) return;
    await this.notificationsService.sendReturnRefunded({
      order: request.order,
      rmaNumber: request.rmaNumber,
      refundAmount: request.refundAmount ?? '0',
      currencyCode: request.currencyCode,
      refundMethod: request.refundMethod ?? '',
    });
  }

  private assertBackoffice(actor: ActorUser): void {
    if (!this.isBackoffice(actor.role)) {
      throw new ForbiddenException('Only backoffice can manage returns');
    }
  }

  private assertAccess(request: ReturnRequest, actor: ActorUser): void {
    if (this.isBackoffice(actor.role)) return;
    if (request.user?.id !== actor.id) {
      throw new ForbiddenException('You do not have access to this return');
    }
  }

  private isBackoffice(role: Role): boolean {
    return BACKOFFICE_ROLES.includes(role);
  }
}
