import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryAttributeDefinition } from './entities/category.entity';

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
      supportsSizeColorVariants: dto.supportsSizeColorVariants ?? true,
      supportsDimensions: dto.supportsDimensions ?? false,
      supportsWeight: dto.supportsWeight ?? false,
      attributeDefinitions: this.normalizeAttributeDefinitions(dto.attributeDefinitions),
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

    if (dto.supportsSizeColorVariants !== undefined) {
      category.supportsSizeColorVariants = dto.supportsSizeColorVariants;
    }

    if (dto.supportsDimensions !== undefined) {
      category.supportsDimensions = dto.supportsDimensions;
    }

    if (dto.supportsWeight !== undefined) {
      category.supportsWeight = dto.supportsWeight;
    }

    if (dto.attributeDefinitions !== undefined) {
      category.attributeDefinitions = this.normalizeAttributeDefinitions(dto.attributeDefinitions);
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

  private normalizeAttributeDefinitions(
    definitions?: Array<{
      key: string;
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      unit?: string;
      required?: boolean;
      options?: string[];
      helpText?: string;
      displayOrder?: number;
      isActive?: boolean;
    }>,
  ): CategoryAttributeDefinition[] {
    if (!definitions || definitions.length === 0) {
      return [];
    }

    const normalized = definitions.map((definition, index) => {
      const key = this.slugify(definition.key || definition.label);
      if (!key) {
        throw new ConflictException('Each dynamic attribute must have a valid key or label');
      }

      const label = definition.label.trim();
      if (!label) {
        throw new ConflictException('Each dynamic attribute must have a label');
      }

      const options = (definition.options ?? [])
        .map((option) => option.trim())
        .filter(Boolean)
        .filter((option, optionIndex, items) => items.indexOf(option) === optionIndex);

      if (definition.type === 'select' && options.length === 0) {
        throw new ConflictException(`Attribute "${label}" requires at least one option`);
      }

      return {
        key,
        label,
        type: definition.type,
        unit: definition.unit?.trim() || null,
        required: definition.required ?? false,
        options: definition.type === 'select' ? options : [],
        helpText: definition.helpText?.trim() || null,
        displayOrder: definition.displayOrder ?? index,
        isActive: definition.isActive ?? true,
      } satisfies CategoryAttributeDefinition;
    });

    const duplicatedKeys = normalized
      .map((definition) => definition.key)
      .filter((key, index, items) => items.indexOf(key) !== index);

    if (duplicatedKeys.length > 0) {
      throw new ConflictException(`Dynamic attribute keys must be unique: ${[...new Set(duplicatedKeys)].join(', ')}`);
    }

    return normalized.sort((left, right) => left.displayOrder - right.displayOrder);
  }
}
