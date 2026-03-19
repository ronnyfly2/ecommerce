import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

// Typed tree node structure for categories
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    let parent: Category | null = null;
    if (dto.parentId) {
      parent = await this.categoriesRepository.findOne({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const category = this.categoriesRepository.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      image: dto.image ?? null,
      isActive: dto.isActive ?? true,
      displayOrder: dto.displayOrder ?? 0,
      parent,
    });

    return this.categoriesRepository.save(category);
  }

  findAll() {
    return this.categoriesRepository.find({
      relations: { parent: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findTree(): Promise<CategoryTreeNode[]> {
    const categories = await this.categoriesRepository.find({
      relations: { parent: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });

    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of categories) {
      map.set(category.id, { ...category, children: [] });
    }

    for (const category of categories) {
      const node = map.get(category.id);
      if (!node) continue;
      
      if (category.parent?.id && map.has(category.parent.id)) {
        const parentNode = map.get(category.parent.id);
        if (parentNode) {
          parentNode.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findOne(id: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: { parent: true, children: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      category.name = dto.name;
      category.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new ConflictException('Category cannot be parent of itself');
      }

      const parent = await this.categoriesRepository.findOne({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      category.parent = parent;
    }

    if (dto.description !== undefined) {
      category.description = dto.description ?? null;
    }

    if (dto.image !== undefined) {
      category.image = dto.image ?? null;
    }

    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    if (dto.displayOrder !== undefined) {
      category.displayOrder = dto.displayOrder;
    }

    return this.categoriesRepository.save(category);
  }

  async remove(id: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: { children: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.children.length > 0) {
      throw new ConflictException('Cannot delete category with children');
    }

    await this.categoriesRepository.delete(id);
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
    const category = await this.categoriesRepository.findOne({ where: { slug } });
    if (!category) {
      return false;
    }

    if (ignoreId && category.id === ignoreId) {
      return false;
    }

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
