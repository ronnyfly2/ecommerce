import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  async create(dto: CreateTagDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    const existing = await this.tagsRepository.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Tag name already exists');
    }

    const tag = this.tagsRepository.create({
      name: dto.name,
      slug,
      isActive: dto.isActive ?? true,
    });

    return this.tagsRepository.save(tag);
  }

  findAll() {
    return this.tagsRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const tag = await this.tagsRepository.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }

  async update(id: string, dto: UpdateTagDto) {
    const tag = await this.findOne(id);

    if (dto.name && dto.name !== tag.name) {
      const existing = await this.tagsRepository.findOne({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Tag name already exists');
      }
      tag.name = dto.name;
      tag.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.isActive !== undefined) {
      tag.isActive = dto.isActive;
    }

    return this.tagsRepository.save(tag);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tagsRepository.delete(id);
    return { deleted: true };
  }

  private async generateUniqueSlug(name: string, ignoreId?: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    while (await this.slugExists(slug, ignoreId)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async slugExists(slug: string, ignoreId?: string): Promise<boolean> {
    const tag = await this.tagsRepository.findOne({ where: { slug } });
    if (!tag) return false;
    if (ignoreId && tag.id === ignoreId) return false;
    return true;
  }

  private slugify(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
