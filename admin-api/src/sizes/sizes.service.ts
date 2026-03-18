import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { Size } from './entities/size.entity';

@Injectable()
export class SizesService {
  constructor(
    @InjectRepository(Size)
    private readonly sizesRepository: Repository<Size>,
  ) {}

  async create(dto: CreateSizeDto) {
    const exists = await this.sizesRepository.findOne({
      where: [{ name: dto.name }, { abbreviation: dto.abbreviation }],
    });

    if (exists) {
      throw new ConflictException('Size name or abbreviation already exists');
    }

    const size = this.sizesRepository.create(dto);
    return this.sizesRepository.save(size);
  }

  findAll() {
    return this.sizesRepository.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const size = await this.sizesRepository.findOne({ where: { id } });
    if (!size) {
      throw new NotFoundException('Size not found');
    }
    return size;
  }

  async update(id: string, dto: UpdateSizeDto) {
    const size = await this.findOne(id);

    if (dto.name || dto.abbreviation) {
      const exists = await this.sizesRepository.findOne({
        where: [
          ...(dto.name ? [{ name: dto.name }] : []),
          ...(dto.abbreviation ? [{ abbreviation: dto.abbreviation }] : []),
        ],
      });

      if (exists && exists.id !== id) {
        throw new ConflictException('Size name or abbreviation already exists');
      }
    }

    const merged = this.sizesRepository.merge(size, dto);
    return this.sizesRepository.save(merged);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.sizesRepository.delete(id);
    return { deleted: true };
  }
}
