import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { QueryInventoryMovementsDto } from './dto/query-inventory-movements.dto';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly movementsRepository: Repository<InventoryMovement>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createMovement(
    dto: CreateInventoryAdjustmentDto,
    userId: string,
  ) {
    const variant = await this.variantsRepository.findOne({
      where: { id: dto.variantId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const movement = this.movementsRepository.create({
      variant,
      quantityChange: dto.quantityChange,
      type: dto.type,
      reason: dto.reason ?? null,
      createdBy: user,
    });

    return this.movementsRepository.save(movement);
  }

  async findMovements(query: QueryInventoryMovementsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<InventoryMovement> = {};
    if (query.variantId) {
      where.variant = { id: query.variantId } as ProductVariant;
    }

    const [items, total] = await this.movementsRepository.findAndCount({
      where,
      relations: { variant: { product: true, size: true, color: true }, createdBy: true },
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
}
