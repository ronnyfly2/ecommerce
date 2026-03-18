import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { Color } from './entities/color.entity';

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color)
    private readonly colorsRepository: Repository<Color>,
  ) {}

  async create(dto: CreateColorDto) {
    const exists = await this.colorsRepository.findOne({
      where: [{ name: dto.name }, { hexCode: dto.hexCode }],
    });

    if (exists) {
      throw new ConflictException('Color name or hexCode already exists');
    }

    const color = this.colorsRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });

    return this.colorsRepository.save(color);
  }

  findAll() {
    return this.colorsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const color = await this.colorsRepository.findOne({ where: { id } });
    if (!color) {
      throw new NotFoundException('Color not found');
    }
    return color;
  }

  async update(id: string, dto: UpdateColorDto) {
    const color = await this.findOne(id);

    if (dto.name || dto.hexCode) {
      const exists = await this.colorsRepository.findOne({
        where: [
          ...(dto.name ? [{ name: dto.name }] : []),
          ...(dto.hexCode ? [{ hexCode: dto.hexCode }] : []),
        ],
      });

      if (exists && exists.id !== id) {
        throw new ConflictException('Color name or hexCode already exists');
      }
    }

    const merged = this.colorsRepository.merge(color, dto);
    return this.colorsRepository.save(merged);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.colorsRepository.delete(id);
    return { deleted: true };
  }
}
