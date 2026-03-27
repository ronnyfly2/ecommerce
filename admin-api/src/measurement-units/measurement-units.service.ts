import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import { MeasurementUnit } from './entities/measurement-unit.entity';

@Injectable()
export class MeasurementUnitsService {
  constructor(
    @InjectRepository(MeasurementUnit)
    private readonly measurementUnitsRepository: Repository<MeasurementUnit>,
  ) {}

  async create(dto: CreateMeasurementUnitDto) {
    const normalizedCode = dto.code.trim().toLowerCase();
    const normalizedLabel = dto.label.trim();

    const exists = await this.measurementUnitsRepository.findOne({
      where: [{ code: normalizedCode }],
    });

    if (exists) {
      throw new ConflictException('Measurement unit code already exists');
    }

    const measurementUnit = this.measurementUnitsRepository.create({
      code: normalizedCode,
      label: normalizedLabel,
      family: dto.family,
      isActive: dto.isActive ?? true,
      displayOrder: dto.displayOrder ?? 0,
    });

    return this.measurementUnitsRepository.save(measurementUnit);
  }

  findAll() {
    return this.measurementUnitsRepository.find({
      order: { family: 'ASC', displayOrder: 'ASC', label: 'ASC' },
    });
  }

  async findOne(id: string) {
    const measurementUnit = await this.measurementUnitsRepository.findOne({ where: { id } });
    if (!measurementUnit) {
      throw new NotFoundException('Measurement unit not found');
    }
    return measurementUnit;
  }

  async update(id: string, dto: UpdateMeasurementUnitDto) {
    const measurementUnit = await this.findOne(id);

    if (dto.code) {
      const normalizedCode = dto.code.trim().toLowerCase();
      const exists = await this.measurementUnitsRepository.findOne({ where: { code: normalizedCode } });
      if (exists && exists.id !== id) {
        throw new ConflictException('Measurement unit code already exists');
      }
      measurementUnit.code = normalizedCode;
    }

    if (dto.label !== undefined) {
      measurementUnit.label = dto.label.trim();
    }

    if (dto.family !== undefined) {
      measurementUnit.family = dto.family;
    }

    if (dto.isActive !== undefined) {
      measurementUnit.isActive = dto.isActive;
    }

    if (dto.displayOrder !== undefined) {
      measurementUnit.displayOrder = dto.displayOrder;
    }

    return this.measurementUnitsRepository.save(measurementUnit);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.measurementUnitsRepository.delete(id);
    return { deleted: true };
  }
}
