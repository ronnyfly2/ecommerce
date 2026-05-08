import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTemplateDto } from './dto/create-template.dto';
import { PublishTemplateDto } from './dto/publish-template.dto';
import { QueryAdminTemplatesDto } from './dto/query-admin-templates.dto';
import { QueryTemplateDto } from './dto/query-template.dto';
import { RollbackTemplateDto } from './dto/rollback-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Template } from './entities/template.entity';
import { TemplateChannel } from './enums/template-channel.enum';
import { TemplatePageType } from './enums/template-page-type.enum';
import { TemplateStatus } from './enums/template-status.enum';

type TemplateComponentKey =
  | 'hero'
  | 'banner'
  | 'product-grid'
  | 'rich-text'
  | 'cta'
  | 'category-strip'
  | 'flash-sale'
  | 'brand-carousel'
  | 'trust-badges'
  | 'promo-banners';

type TemplateSectionInput = {
  id: string;
  componentKey: TemplateComponentKey;
  props: Record<string, unknown>;
  layoutWidth?: 'basic' | 'wide' | 'full';
  spacingY?: 'default' | 'compact' | 'none';
  spacingX?: 'default' | 'compact' | 'none';
  dataSource?: Record<string, unknown> | null;
  visibilityRules?: Record<string, unknown> | null;
  order: number;
};

type TemplateDocumentInput = {
  meta: {
    templateKey: string;
    channel: TemplateChannel;
    pageType: TemplatePageType;
    schemaVersion: string;
  };
  sections: TemplateSectionInput[];
};

type TemplatePreviewTokenPayload = {
  templateId: string;
  purpose: 'template-preview';
  actorId?: string;
};

const TEMPLATE_PREVIEW_TOKEN_EXPIRES_IN = '15m';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templatesRepository: Repository<Template>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async findPublishedByTemplateKey(templateKey: string, query: QueryTemplateDto) {
    const where = {
      templateKey,
      channel: query.channel ?? TemplateChannel.WEB,
      status: TemplateStatus.PUBLISHED,
      ...(query.version ? { version: query.version } : {}),
    };

    const template = await this.templatesRepository.findOne({
      where,
      order: query.version ? undefined : { version: 'DESC' },
    });

    if (!template) {
      throw new NotFoundException('Template published not found');
    }

    return template;
  }

  async findPreviewByIdWithToken(id: string, token: string) {
    const payload = this.verifyPreviewToken(token);

    if (payload.templateId !== id) {
      throw new UnauthorizedException('Preview token does not match template');
    }

    return this.findById(id);
  }

  async createPreviewToken(id: string, userId?: string) {
    const template = await this.findById(id);
    const payload: TemplatePreviewTokenPayload = {
      templateId: template.id,
      purpose: 'template-preview',
      ...(userId ? { actorId: userId } : {}),
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: TEMPLATE_PREVIEW_TOKEN_EXPIRES_IN,
    });

    return {
      templateId: template.id,
      token,
      expiresIn: TEMPLATE_PREVIEW_TOKEN_EXPIRES_IN,
    };
  }

  async listForAdmin(query: QueryAdminTemplatesDto) {
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.templatesRepository.createQueryBuilder('t');

    if (query.templateKey) {
      qb.andWhere('t.template_key = :templateKey', { templateKey: query.templateKey });
    }

    if (query.channel) {
      qb.andWhere('t.channel = :channel', { channel: query.channel });
    }

    if (query.pageType) {
      qb.andWhere('t.page_type = :pageType', { pageType: query.pageType });
    }

    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }

    return qb
      .orderBy(`t.${sortBy}`, sortOrder)
      .addOrderBy('t.version', 'DESC')
      .getMany();
  }

  async findByIdForAdmin(id: string) {
    return this.findById(id);
  }

  async createDraft(dto: CreateTemplateDto, userId?: string) {
    const normalizedContent = this.validateAndNormalizeDocument(dto.content, {
      templateKey: dto.templateKey,
      channel: dto.channel,
      pageType: dto.pageType,
      schemaVersion: dto.schemaVersion,
    });

    const draft = this.templatesRepository.create({
      templateKey: dto.templateKey,
      channel: dto.channel,
      pageType: dto.pageType,
      schemaVersion: dto.schemaVersion,
      content: normalizedContent,
      status: TemplateStatus.DRAFT,
      version: 0,
      publishNote: null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });

    return this.templatesRepository.save(draft);
  }

  async updateDraft(id: string, dto: UpdateTemplateDto, userId?: string) {
    const template = await this.findById(id);

    if (template.status !== TemplateStatus.DRAFT) {
      throw new ConflictException('Only drafts can be updated');
    }

    const schemaVersion = dto.schemaVersion ?? template.schemaVersion;
    const content = dto.content ?? template.content;

    template.schemaVersion = schemaVersion;
    template.content = this.validateAndNormalizeDocument(content, {
      templateKey: template.templateKey,
      channel: template.channel,
      pageType: template.pageType,
      schemaVersion,
    });
    template.updatedBy = userId ?? template.updatedBy;

    return this.templatesRepository.save(template);
  }

  async publish(id: string, dto: PublishTemplateDto, userId?: string) {
    const draft = await this.findById(id);

    if (draft.status !== TemplateStatus.DRAFT) {
      throw new ConflictException('Only drafts can be published');
    }

    return this.templatesRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Template);

      const activePublished = await repo.findOne({
        where: {
          templateKey: draft.templateKey,
          channel: draft.channel,
          status: TemplateStatus.PUBLISHED,
        },
      });

      if (activePublished) {
        activePublished.status = TemplateStatus.DEPRECATED;
        activePublished.updatedBy = userId ?? activePublished.updatedBy;
        await repo.save(activePublished);
      }

      const nextVersion = await this.nextVersionForTemplate(
        repo,
        draft.templateKey,
        draft.channel,
      );

      draft.version = nextVersion;
      draft.status = TemplateStatus.PUBLISHED;
      draft.publishedAt = new Date();
      draft.publishedBy = userId ?? null;
      draft.publishNote = dto.publishNote ?? null;
      draft.updatedBy = userId ?? draft.updatedBy;

      return repo.save(draft);
    });
  }

  async deprecate(id: string, userId?: string) {
    const template = await this.findById(id);

    if (template.status !== TemplateStatus.PUBLISHED) {
      throw new ConflictException('Only published templates can be deprecated');
    }

    template.status = TemplateStatus.DEPRECATED;
    template.updatedBy = userId ?? template.updatedBy;

    return this.templatesRepository.save(template);
  }

  async remove(id: string) {
    const template = await this.findById(id);

    if (template.status === TemplateStatus.PUBLISHED) {
      throw new ConflictException('Cannot delete a published template. Deprecate it first.');
    }

    await this.templatesRepository.remove(template);
  }

  async rollback(id: string, dto: RollbackTemplateDto, userId?: string) {
    const anchor = await this.findById(id);

    const source = await this.templatesRepository.findOne({
      where: {
        templateKey: anchor.templateKey,
        channel: anchor.channel,
        version: dto.sourceVersion,
      },
    });

    if (!source) {
      throw new NotFoundException('Source version not found for rollback');
    }

    const draft = this.templatesRepository.create({
      templateKey: source.templateKey,
      channel: source.channel,
      pageType: source.pageType,
      schemaVersion: source.schemaVersion,
      content: source.content,
      status: TemplateStatus.DRAFT,
      version: 0,
      publishNote: `Rollback from version ${dto.sourceVersion}`,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
      publishedAt: null,
      publishedBy: null,
    });

    const createdDraft = await this.templatesRepository.save(draft);

    return this.publish(createdDraft.id, { publishNote: draft.publishNote ?? undefined }, userId);
  }

  private async findById(id: string) {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  private verifyPreviewToken(token: string): TemplatePreviewTokenPayload {
    let payload: TemplatePreviewTokenPayload;
    try {
      payload = this.jwtService.verify<TemplatePreviewTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired preview token');
    }

    if (payload.purpose !== 'template-preview' || !payload.templateId) {
      throw new UnauthorizedException('Invalid preview token payload');
    }

    return payload;
  }

  private async nextVersionForTemplate(
    repository: Repository<Template>,
    templateKey: string,
    channel: TemplateChannel,
  ): Promise<number> {
    const row = await repository
      .createQueryBuilder('t')
      .select('MAX(t.version)', 'maxVersion')
      .where('t.template_key = :templateKey', { templateKey })
      .andWhere('t.channel = :channel', { channel })
      .andWhere('t.version > 0')
      .getRawOne<{ maxVersion: string | null }>();

    const maxVersion = row?.maxVersion ? Number(row.maxVersion) : 0;
    return maxVersion + 1;
  }

  private validateAndNormalizeDocument(
    input: Record<string, unknown>,
    context: {
      templateKey: string;
      channel: TemplateChannel;
      pageType: TemplatePageType;
      schemaVersion: string;
    },
  ): TemplateDocumentInput {
    if (!this.isPlainObject(input)) {
      throw new BadRequestException('Template content must be an object');
    }

    const allowedTopLevelKeys = new Set(['meta', 'sections']);
    this.assertAllowedKeys(input, allowedTopLevelKeys, 'content');

    const rawSections = input.sections;
    if (!Array.isArray(rawSections)) {
      throw new BadRequestException('content.sections must be an array');
    }

    if (rawSections.length < 1 || rawSections.length > 20) {
      throw new BadRequestException('content.sections must contain between 1 and 20 items');
    }

    const usedOrders = new Set<number>();
    const sections = rawSections.map((section, index) =>
      this.validateAndNormalizeSection(section, index, usedOrders),
    );

    return {
      meta: {
        templateKey: context.templateKey,
        channel: context.channel,
        pageType: context.pageType,
        schemaVersion: context.schemaVersion,
      },
      sections,
    };
  }

  private validateAndNormalizeSection(
    section: unknown,
    index: number,
    usedOrders: Set<number>,
  ): TemplateSectionInput {
    if (!this.isPlainObject(section)) {
      throw new BadRequestException(`content.sections[${index}] must be an object`);
    }

    const allowedSectionKeys = new Set([
      'id',
      'componentKey',
      'props',
      'layoutWidth',
      'spacingY',
      'spacingX',
      'dataSource',
      'visibilityRules',
      'order',
    ]);
    this.assertAllowedKeys(section, allowedSectionKeys, `content.sections[${index}]`);

    const id = this.requireString(section.id, `content.sections[${index}].id`, 3, 64, /^[a-zA-Z0-9_-]+$/);
    const componentKey = this.requireEnum(
      section.componentKey,
      `content.sections[${index}].componentKey`,
      [
        'hero',
        'banner',
        'product-grid',
        'rich-text',
        'cta',
        'category-strip',
        'flash-sale',
        'brand-carousel',
        'trust-badges',
        'promo-banners',
      ],
    ) as TemplateComponentKey;

    if (!this.isPlainObject(section.props)) {
      throw new BadRequestException(`content.sections[${index}].props must be an object`);
    }

    const order = this.requireInteger(section.order, `content.sections[${index}].order`, 1, 100);
    if (usedOrders.has(order)) {
      throw new BadRequestException(`content.sections[${index}].order must be unique`);
    }
    usedOrders.add(order);

    const normalizedSection: TemplateSectionInput = {
      id,
      componentKey,
      props: this.validateProps(componentKey, section.props, index),
      order,
    };

    if (section.layoutWidth !== undefined) {
      normalizedSection.layoutWidth = this.requireEnum(
        section.layoutWidth,
        `content.sections[${index}].layoutWidth`,
        ['basic', 'wide', 'full'],
      ) as 'basic' | 'wide' | 'full';
    }

    if (section.spacingY !== undefined) {
      normalizedSection.spacingY = this.requireEnum(
        section.spacingY,
        `content.sections[${index}].spacingY`,
        ['default', 'compact', 'none'],
      ) as 'default' | 'compact' | 'none';
    }

    if (section.spacingX !== undefined) {
      normalizedSection.spacingX = this.requireEnum(
        section.spacingX,
        `content.sections[${index}].spacingX`,
        ['default', 'compact', 'none'],
      ) as 'default' | 'compact' | 'none';
    }

    if (section.dataSource !== undefined) {
      if (section.dataSource !== null && !this.isPlainObject(section.dataSource)) {
        throw new BadRequestException(`content.sections[${index}].dataSource must be object or null`);
      }
      normalizedSection.dataSource = section.dataSource as Record<string, unknown> | null;
    }

    if (section.visibilityRules !== undefined) {
      if (section.visibilityRules !== null && !this.isPlainObject(section.visibilityRules)) {
        throw new BadRequestException(`content.sections[${index}].visibilityRules must be object or null`);
      }
      normalizedSection.visibilityRules = section.visibilityRules as
        | Record<string, unknown>
        | null;
    }

    return normalizedSection;
  }

  private validateProps(
    componentKey: TemplateComponentKey,
    props: Record<string, unknown>,
    index: number,
  ): Record<string, unknown> {
    switch (componentKey) {
      case 'hero':
        return this.validateHeroProps(props, index);
      case 'banner':
        return this.validateBannerProps(props, index);
      case 'product-grid':
        return this.validateProductGridProps(props, index);
      case 'rich-text':
        return this.validateRichTextProps(props, index);
      case 'cta':
        return this.validateCtaProps(props, index);
      case 'category-strip':
        return this.validateCategoryStripProps(props, index);
      case 'flash-sale':
        return this.validateFlashSaleProps(props, index);
      case 'brand-carousel':
        return this.validateBrandCarouselProps(props, index);
      case 'trust-badges':
        return this.validateTrustBadgesProps(props, index);
      case 'promo-banners':
        return this.validatePromoBannersProps(props, index);
      default:
        throw new BadRequestException(`content.sections[${index}] has unsupported componentKey`);
    }
  }

  private validateHeroProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set([
      'title',
      'subtitle',
      'imageUrl',
      'ctaLabel',
      'ctaHref',
      'backgroundColor',
      'titleColor',
      'subtitleColor',
      'buttonBackgroundColor',
      'buttonTextColor',
      'slides',
      'autoPlay',
      'autoPlayIntervalMs',
      'showDots',
      'showArrows',
      'cardBorderRadius',
      'cardBorderVisible',
      'cardBorderColor',
      'cardBackgroundColor',
    ]);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    const normalized: Record<string, unknown> = {};

    if (Array.isArray(props.slides)) {
      if (props.slides.length < 1 || props.slides.length > 10) {
        throw new BadRequestException(`content.sections[${index}].props.slides must be an array with 1..10 items`);
      }

      normalized.slides = props.slides.map((slide, slideIndex) => {
        if (!this.isPlainObject(slide)) {
          throw new BadRequestException(`content.sections[${index}].props.slides[${slideIndex}] must be an object`);
        }

        const allowedSlideKeys = new Set([
          'title',
          'subtitle',
          'imageUrl',
          'ctaLabel',
          'ctaHref',
          'imageLayout',
          'imageWidth',
          'height',
          'sideImageHeight',
          'imageFocus',
          'imageZoom',
          'contentAlignment',
          'contentWidth',
          'overlayColor',
          'titleColor',
          'titleBackgroundColor',
          'titleBackgroundSize',
          'subtitleColor',
          'subtitleBackgroundColor',
          'subtitleBackgroundSize',
          'buttonBackgroundColor',
          'buttonTextColor',
          'buttonSize',
        ]);
        this.assertAllowedKeys(slide, allowedSlideKeys, `content.sections[${index}].props.slides[${slideIndex}]`);

        const normalizedSlide: Record<string, unknown> = {
          title: this.requireString(slide.title, `content.sections[${index}].props.slides[${slideIndex}].title`, 1, 120),
        };

        this.addOptionalString(normalizedSlide, 'subtitle', slide.subtitle, `content.sections[${index}].props.slides[${slideIndex}].subtitle`, 240);
        this.addOptionalUrl(normalizedSlide, 'imageUrl', slide.imageUrl, `content.sections[${index}].props.slides[${slideIndex}].imageUrl`);
        this.addOptionalString(normalizedSlide, 'ctaLabel', slide.ctaLabel, `content.sections[${index}].props.slides[${slideIndex}].ctaLabel`, 40);
        this.addOptionalUrl(normalizedSlide, 'ctaHref', slide.ctaHref, `content.sections[${index}].props.slides[${slideIndex}].ctaHref`);

        if (slide.imageLayout !== undefined) {
          normalizedSlide.imageLayout = this.requireEnum(
            slide.imageLayout,
            `content.sections[${index}].props.slides[${slideIndex}].imageLayout`,
            ['background', 'side-left', 'side-right'],
          );
        }

        if (slide.imageWidth !== undefined) {
          normalizedSlide.imageWidth = this.requireEnum(
            slide.imageWidth,
            `content.sections[${index}].props.slides[${slideIndex}].imageWidth`,
            ['quarter', 'half'],
          );
        }

        if (slide.height !== undefined) {
          normalizedSlide.height = this.requireEnum(
            slide.height,
            `content.sections[${index}].props.slides[${slideIndex}].height`,
            ['compact', 'tall', 'screen'],
          );
        }

        if (slide.sideImageHeight !== undefined) {
          normalizedSlide.sideImageHeight = this.requireEnum(
            slide.sideImageHeight,
            `content.sections[${index}].props.slides[${slideIndex}].sideImageHeight`,
            ['match', 'compact', 'tall', 'screen'],
          );
        }

        if (slide.imageFocus !== undefined) {
          normalizedSlide.imageFocus = this.requireEnum(
            slide.imageFocus,
            `content.sections[${index}].props.slides[${slideIndex}].imageFocus`,
            ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
          );
        }

        if (slide.imageZoom !== undefined) {
          normalizedSlide.imageZoom = this.requireInteger(
            slide.imageZoom,
            `content.sections[${index}].props.slides[${slideIndex}].imageZoom`,
            100,
            200,
          );
        }

        if (slide.contentAlignment !== undefined) {
          normalizedSlide.contentAlignment = this.requireEnum(
            slide.contentAlignment,
            `content.sections[${index}].props.slides[${slideIndex}].contentAlignment`,
            ['left', 'center', 'right'],
          );
        }

        if (slide.contentWidth !== undefined) {
          normalizedSlide.contentWidth = this.requireEnum(
            slide.contentWidth,
            `content.sections[${index}].props.slides[${slideIndex}].contentWidth`,
            ['narrow', 'regular', 'wide', 'full'],
          );
        }

        this.addOptionalColor(normalizedSlide, 'overlayColor', slide.overlayColor, `content.sections[${index}].props.slides[${slideIndex}].overlayColor`);
        this.addOptionalColor(normalizedSlide, 'titleColor', slide.titleColor, `content.sections[${index}].props.slides[${slideIndex}].titleColor`);
        this.addOptionalColor(normalizedSlide, 'titleBackgroundColor', slide.titleBackgroundColor, `content.sections[${index}].props.slides[${slideIndex}].titleBackgroundColor`);

        if (slide.titleBackgroundSize !== undefined) {
          normalizedSlide.titleBackgroundSize = this.requireEnum(
            slide.titleBackgroundSize,
            `content.sections[${index}].props.slides[${slideIndex}].titleBackgroundSize`,
            ['fit', 'wide', 'full'],
          );
        }

        this.addOptionalColor(normalizedSlide, 'subtitleColor', slide.subtitleColor, `content.sections[${index}].props.slides[${slideIndex}].subtitleColor`);
        this.addOptionalColor(normalizedSlide, 'subtitleBackgroundColor', slide.subtitleBackgroundColor, `content.sections[${index}].props.slides[${slideIndex}].subtitleBackgroundColor`);

        if (slide.subtitleBackgroundSize !== undefined) {
          normalizedSlide.subtitleBackgroundSize = this.requireEnum(
            slide.subtitleBackgroundSize,
            `content.sections[${index}].props.slides[${slideIndex}].subtitleBackgroundSize`,
            ['fit', 'wide', 'full'],
          );
        }

        this.addOptionalColor(normalizedSlide, 'buttonBackgroundColor', slide.buttonBackgroundColor, `content.sections[${index}].props.slides[${slideIndex}].buttonBackgroundColor`);
        this.addOptionalColor(normalizedSlide, 'buttonTextColor', slide.buttonTextColor, `content.sections[${index}].props.slides[${slideIndex}].buttonTextColor`);

        if (slide.buttonSize !== undefined) {
          normalizedSlide.buttonSize = this.requireEnum(
            slide.buttonSize,
            `content.sections[${index}].props.slides[${slideIndex}].buttonSize`,
            ['sm', 'md', 'lg'],
          );
        }

        return normalizedSlide;
      });
    }

    if (normalized.slides === undefined) {
      normalized.title = this.requireString(props.title, `content.sections[${index}].props.title`, 1, 120);
    } else {
      this.addOptionalString(normalized, 'title', props.title, `content.sections[${index}].props.title`, 120);
    }

    this.addOptionalString(normalized, 'subtitle', props.subtitle, `content.sections[${index}].props.subtitle`, 240);
    this.addOptionalUrl(normalized, 'imageUrl', props.imageUrl, `content.sections[${index}].props.imageUrl`);
    this.addOptionalString(normalized, 'ctaLabel', props.ctaLabel, `content.sections[${index}].props.ctaLabel`, 40);
    this.addOptionalUrl(normalized, 'ctaHref', props.ctaHref, `content.sections[${index}].props.ctaHref`);
    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'titleColor', props.titleColor, `content.sections[${index}].props.titleColor`);
    this.addOptionalColor(normalized, 'subtitleColor', props.subtitleColor, `content.sections[${index}].props.subtitleColor`);
    this.addOptionalColor(normalized, 'buttonBackgroundColor', props.buttonBackgroundColor, `content.sections[${index}].props.buttonBackgroundColor`);
    this.addOptionalColor(normalized, 'buttonTextColor', props.buttonTextColor, `content.sections[${index}].props.buttonTextColor`);

    if (props.autoPlay !== undefined) {
      if (typeof props.autoPlay !== 'boolean') {
        throw new BadRequestException(`content.sections[${index}].props.autoPlay must be boolean`);
      }
      normalized.autoPlay = props.autoPlay;
    }

    if (props.showDots !== undefined) {
      if (typeof props.showDots !== 'boolean') {
        throw new BadRequestException(`content.sections[${index}].props.showDots must be boolean`);
      }
      normalized.showDots = props.showDots;
    }

    if (props.showArrows !== undefined) {
      if (typeof props.showArrows !== 'boolean') {
        throw new BadRequestException(`content.sections[${index}].props.showArrows must be boolean`);
      }
      normalized.showArrows = props.showArrows;
    }

    if (props.autoPlayIntervalMs !== undefined) {
      normalized.autoPlayIntervalMs = this.requireInteger(
        props.autoPlayIntervalMs,
        `content.sections[${index}].props.autoPlayIntervalMs`,
        2000,
        15000,
      );
    }

    if (props.cardBorderRadius !== undefined) {
      normalized.cardBorderRadius = this.requireEnum(
        props.cardBorderRadius,
        `content.sections[${index}].props.cardBorderRadius`,
        ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'],
      );
    }

    if (props.cardBorderVisible !== undefined) {
      if (typeof props.cardBorderVisible !== 'boolean') {
        throw new BadRequestException(`content.sections[${index}].props.cardBorderVisible must be boolean`);
      }
      normalized.cardBorderVisible = props.cardBorderVisible;
    }

    this.addOptionalColor(normalized, 'cardBorderColor', props.cardBorderColor, `content.sections[${index}].props.cardBorderColor`);
    this.addOptionalColor(normalized, 'cardBackgroundColor', props.cardBackgroundColor, `content.sections[${index}].props.cardBackgroundColor`);

    return normalized;
  }

  private validateBannerProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set(['text', 'tone', 'dismissible']);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    const normalized: Record<string, unknown> = {
      text: this.requireString(props.text, `content.sections[${index}].props.text`, 1, 160),
    };

    if (props.tone !== undefined) {
      normalized.tone = this.requireEnum(props.tone, `content.sections[${index}].props.tone`, [
        'info',
        'success',
        'warning',
        'danger',
      ]);
    }

    if (props.dismissible !== undefined) {
      if (typeof props.dismissible !== 'boolean') {
        throw new BadRequestException(`content.sections[${index}].props.dismissible must be boolean`);
      }
      normalized.dismissible = props.dismissible;
    }

    return normalized;
  }

  private validateProductGridProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set([
      'title',
      'source',
      'categorySlug',
      'limit',
      'backgroundColor',
      'titleColor',
      'cardBackgroundColor',
      'cardBorderColor',
      'priceColor',
      'placeholderImageBaseUrl',
    ]);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    const source = this.requireEnum(props.source, `content.sections[${index}].props.source`, [
      'featured',
      'new_arrivals',
      'by_category',
    ]);

    const normalized: Record<string, unknown> = { source };

    this.addOptionalString(normalized, 'title', props.title, `content.sections[${index}].props.title`, 120);

    if (source === 'by_category') {
      normalized.categorySlug = this.requireString(
        props.categorySlug,
        `content.sections[${index}].props.categorySlug`,
        2,
        80,
        /^[a-z0-9-]+$/,
      );
    } else if (props.categorySlug !== undefined) {
      normalized.categorySlug = this.requireString(
        props.categorySlug,
        `content.sections[${index}].props.categorySlug`,
        2,
        80,
        /^[a-z0-9-]+$/,
      );
    }

    if (props.limit !== undefined) {
      normalized.limit = this.requireInteger(props.limit, `content.sections[${index}].props.limit`, 1, 24);
    }

    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'titleColor', props.titleColor, `content.sections[${index}].props.titleColor`);
    this.addOptionalColor(normalized, 'cardBackgroundColor', props.cardBackgroundColor, `content.sections[${index}].props.cardBackgroundColor`);
    this.addOptionalColor(normalized, 'cardBorderColor', props.cardBorderColor, `content.sections[${index}].props.cardBorderColor`);
    this.addOptionalColor(normalized, 'priceColor', props.priceColor, `content.sections[${index}].props.priceColor`);
    this.addOptionalUrl(normalized, 'placeholderImageBaseUrl', props.placeholderImageBaseUrl, `content.sections[${index}].props.placeholderImageBaseUrl`);

    return normalized;
  }

  private validateCategoryStripProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set([
      'title',
      'categories',
      'backgroundColor',
      'titleColor',
      'itemBackgroundColor',
      'itemTextColor',
      'itemBorderColor',
    ]);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    if (!Array.isArray(props.categories) || props.categories.length < 1 || props.categories.length > 20) {
      throw new BadRequestException(`content.sections[${index}].props.categories must be an array with 1..20 items`);
    }

    const categories = props.categories.map((category, categoryIndex) => {
      if (!this.isPlainObject(category)) {
        throw new BadRequestException(`content.sections[${index}].props.categories[${categoryIndex}] must be an object`);
      }

      const allowedCategoryKeys = new Set(['label', 'slug', 'imageUrl', 'icon']);
      this.assertAllowedKeys(category, allowedCategoryKeys, `content.sections[${index}].props.categories[${categoryIndex}]`);

      const normalizedCategory: Record<string, unknown> = {
        label: this.requireString(category.label, `content.sections[${index}].props.categories[${categoryIndex}].label`, 1, 40),
        slug: this.requireString(category.slug, `content.sections[${index}].props.categories[${categoryIndex}].slug`, 2, 80, /^[a-z0-9-]+$/),
      };

      this.addOptionalUrl(normalizedCategory, 'imageUrl', category.imageUrl, `content.sections[${index}].props.categories[${categoryIndex}].imageUrl`);
      this.addOptionalString(normalizedCategory, 'icon', category.icon, `content.sections[${index}].props.categories[${categoryIndex}].icon`, 12);

      return normalizedCategory;
    });

    const normalized: Record<string, unknown> = { categories };
    this.addOptionalString(normalized, 'title', props.title, `content.sections[${index}].props.title`, 120);
    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'titleColor', props.titleColor, `content.sections[${index}].props.titleColor`);
    this.addOptionalColor(normalized, 'itemBackgroundColor', props.itemBackgroundColor, `content.sections[${index}].props.itemBackgroundColor`);
    this.addOptionalColor(normalized, 'itemTextColor', props.itemTextColor, `content.sections[${index}].props.itemTextColor`);
    this.addOptionalColor(normalized, 'itemBorderColor', props.itemBorderColor, `content.sections[${index}].props.itemBorderColor`);

    return normalized;
  }

  private validateFlashSaleProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set([
      'title',
      'endTime',
      'source',
      'categorySlug',
      'limit',
      'backgroundColor',
      'titleColor',
      'timerBackgroundColor',
      'timerTextColor',
      'cardBackgroundColor',
      'cardBorderColor',
      'priceColor',
      'progressColor',
      'placeholderImageBaseUrl',
    ]);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    const source = this.requireEnum(props.source, `content.sections[${index}].props.source`, [
      'featured',
      'new_arrivals',
      'by_category',
    ]);

    const normalized: Record<string, unknown> = { source };

    this.addOptionalString(normalized, 'title', props.title, `content.sections[${index}].props.title`, 120);
    this.addOptionalString(normalized, 'endTime', props.endTime, `content.sections[${index}].props.endTime`, 64);
    this.addOptionalUrl(normalized, 'placeholderImageBaseUrl', props.placeholderImageBaseUrl, `content.sections[${index}].props.placeholderImageBaseUrl`);

    if (source === 'by_category') {
      normalized.categorySlug = this.requireString(
        props.categorySlug,
        `content.sections[${index}].props.categorySlug`,
        2,
        80,
        /^[a-z0-9-]+$/,
      );
    } else if (props.categorySlug !== undefined) {
      normalized.categorySlug = this.requireString(
        props.categorySlug,
        `content.sections[${index}].props.categorySlug`,
        2,
        80,
        /^[a-z0-9-]+$/,
      );
    }

    if (props.limit !== undefined) {
      normalized.limit = this.requireInteger(props.limit, `content.sections[${index}].props.limit`, 1, 24);
    }

    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'titleColor', props.titleColor, `content.sections[${index}].props.titleColor`);
    this.addOptionalColor(normalized, 'timerBackgroundColor', props.timerBackgroundColor, `content.sections[${index}].props.timerBackgroundColor`);
    this.addOptionalColor(normalized, 'timerTextColor', props.timerTextColor, `content.sections[${index}].props.timerTextColor`);
    this.addOptionalColor(normalized, 'cardBackgroundColor', props.cardBackgroundColor, `content.sections[${index}].props.cardBackgroundColor`);
    this.addOptionalColor(normalized, 'cardBorderColor', props.cardBorderColor, `content.sections[${index}].props.cardBorderColor`);
    this.addOptionalColor(normalized, 'priceColor', props.priceColor, `content.sections[${index}].props.priceColor`);
    this.addOptionalColor(normalized, 'progressColor', props.progressColor, `content.sections[${index}].props.progressColor`);

    return normalized;
  }

  private validateBrandCarouselProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set([
      'title',
      'brands',
      'backgroundColor',
      'titleColor',
      'cardBackgroundColor',
      'cardBorderColor',
    ]);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    if (!Array.isArray(props.brands) || props.brands.length < 1 || props.brands.length > 30) {
      throw new BadRequestException(`content.sections[${index}].props.brands must be an array with 1..30 items`);
    }

    const brands = props.brands.map((brand, brandIndex) => {
      if (!this.isPlainObject(brand)) {
        throw new BadRequestException(`content.sections[${index}].props.brands[${brandIndex}] must be an object`);
      }

      const allowedBrandKeys = new Set(['name', 'logoUrl', 'slug']);
      this.assertAllowedKeys(brand, allowedBrandKeys, `content.sections[${index}].props.brands[${brandIndex}]`);

      const normalizedBrand: Record<string, unknown> = {
        name: this.requireString(brand.name, `content.sections[${index}].props.brands[${brandIndex}].name`, 1, 80),
      };

      this.addOptionalUrl(normalizedBrand, 'logoUrl', brand.logoUrl, `content.sections[${index}].props.brands[${brandIndex}].logoUrl`);
      this.addOptionalString(normalizedBrand, 'slug', brand.slug, `content.sections[${index}].props.brands[${brandIndex}].slug`, 80);

      return normalizedBrand;
    });

    const normalized: Record<string, unknown> = { brands };
    this.addOptionalString(normalized, 'title', props.title, `content.sections[${index}].props.title`, 120);
    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'titleColor', props.titleColor, `content.sections[${index}].props.titleColor`);
    this.addOptionalColor(normalized, 'cardBackgroundColor', props.cardBackgroundColor, `content.sections[${index}].props.cardBackgroundColor`);
    this.addOptionalColor(normalized, 'cardBorderColor', props.cardBorderColor, `content.sections[${index}].props.cardBorderColor`);

    return normalized;
  }

  private validateTrustBadgesProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set(['badges', 'backgroundColor', 'titleColor', 'textColor']);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    if (!Array.isArray(props.badges) || props.badges.length < 1 || props.badges.length > 12) {
      throw new BadRequestException(`content.sections[${index}].props.badges must be an array with 1..12 items`);
    }

    const badges = props.badges.map((badge, badgeIndex) => {
      if (!this.isPlainObject(badge)) {
        throw new BadRequestException(`content.sections[${index}].props.badges[${badgeIndex}] must be an object`);
      }

      const allowedBadgeKeys = new Set(['icon', 'title', 'description']);
      this.assertAllowedKeys(badge, allowedBadgeKeys, `content.sections[${index}].props.badges[${badgeIndex}]`);

      const normalizedBadge: Record<string, unknown> = {
        title: this.requireString(badge.title, `content.sections[${index}].props.badges[${badgeIndex}].title`, 1, 120),
      };

      this.addOptionalString(normalizedBadge, 'icon', badge.icon, `content.sections[${index}].props.badges[${badgeIndex}].icon`, 16);
      this.addOptionalString(normalizedBadge, 'description', badge.description, `content.sections[${index}].props.badges[${badgeIndex}].description`, 240);

      return normalizedBadge;
    });

    const normalized: Record<string, unknown> = { badges };
    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'titleColor', props.titleColor, `content.sections[${index}].props.titleColor`);
    this.addOptionalColor(normalized, 'textColor', props.textColor, `content.sections[${index}].props.textColor`);

    return normalized;
  }

  private validatePromoBannersProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set(['banners', 'columns', 'backgroundColor', 'overlayColor']);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    if (!Array.isArray(props.banners) || props.banners.length < 1 || props.banners.length > 10) {
      throw new BadRequestException(`content.sections[${index}].props.banners must be an array with 1..10 items`);
    }

    const banners = props.banners.map((banner, bannerIndex) => {
      if (!this.isPlainObject(banner)) {
        throw new BadRequestException(`content.sections[${index}].props.banners[${bannerIndex}] must be an object`);
      }

      const allowedBannerKeys = new Set(['imageUrl', 'title', 'subtitle', 'href', 'textPosition']);
      this.assertAllowedKeys(banner, allowedBannerKeys, `content.sections[${index}].props.banners[${bannerIndex}]`);

      const normalizedBanner: Record<string, unknown> = {
        imageUrl: this.requireUrlOrPath(banner.imageUrl, `content.sections[${index}].props.banners[${bannerIndex}].imageUrl`),
      };

      this.addOptionalString(normalizedBanner, 'title', banner.title, `content.sections[${index}].props.banners[${bannerIndex}].title`, 120);
      this.addOptionalString(normalizedBanner, 'subtitle', banner.subtitle, `content.sections[${index}].props.banners[${bannerIndex}].subtitle`, 120);
      this.addOptionalUrl(normalizedBanner, 'href', banner.href, `content.sections[${index}].props.banners[${bannerIndex}].href`);

      if (banner.textPosition !== undefined) {
        normalizedBanner.textPosition = this.requireEnum(
          banner.textPosition,
          `content.sections[${index}].props.banners[${bannerIndex}].textPosition`,
          ['top-left', 'center', 'bottom-left', 'bottom-right'],
        );
      }

      return normalizedBanner;
    });

    const normalized: Record<string, unknown> = { banners };

    if (props.columns !== undefined) {
      normalized.columns = this.requireInteger(props.columns, `content.sections[${index}].props.columns`, 2, 3);
    }

    this.addOptionalColor(normalized, 'backgroundColor', props.backgroundColor, `content.sections[${index}].props.backgroundColor`);
    this.addOptionalColor(normalized, 'overlayColor', props.overlayColor, `content.sections[${index}].props.overlayColor`);

    return normalized;
  }

  private validateRichTextProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set(['title', 'body']);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    const normalized: Record<string, unknown> = {
      body: this.sanitizeRichText(
        this.requireString(props.body, `content.sections[${index}].props.body`, 1, 5000),
      ),
    };

    this.addOptionalString(normalized, 'title', props.title, `content.sections[${index}].props.title`, 120);

    return normalized;
  }

  private validateCtaProps(props: Record<string, unknown>, index: number) {
    const allowed = new Set(['title', 'description', 'buttonLabel', 'buttonHref']);
    this.assertAllowedKeys(props, allowed, `content.sections[${index}].props`);

    const normalized: Record<string, unknown> = {
      title: this.requireString(props.title, `content.sections[${index}].props.title`, 1, 120),
      buttonLabel: this.requireString(
        props.buttonLabel,
        `content.sections[${index}].props.buttonLabel`,
        1,
        40,
      ),
      buttonHref: this.requireUrlOrPath(
        props.buttonHref,
        `content.sections[${index}].props.buttonHref`,
      ),
    };

    this.addOptionalString(normalized, 'description', props.description, `content.sections[${index}].props.description`, 240);

    return normalized;
  }

  private sanitizeRichText(value: string): string {
    return value
      .replace(/<\s*script.*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  }

  private addOptionalString(
    target: Record<string, unknown>,
    key: string,
    value: unknown,
    path: string,
    maxLength: number,
  ) {
    if (value === undefined) {
      return;
    }

    target[key] = this.requireString(value, path, 0, maxLength);
  }

  private addOptionalUrl(
    target: Record<string, unknown>,
    key: string,
    value: unknown,
    path: string,
  ) {
    if (value === undefined) {
      return;
    }

    target[key] = this.requireUrlOrPath(value, path);
  }

  private addOptionalColor(
    target: Record<string, unknown>,
    key: string,
    value: unknown,
    path: string,
  ) {
    if (value === undefined) {
      return;
    }

    target[key] = this.requireColor(value, path);
  }

  private requireString(
    value: unknown,
    path: string,
    minLength: number,
    maxLength: number,
    pattern?: RegExp,
  ): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${path} must be a string`);
    }

    const normalized = value.trim();
    if (normalized.length < minLength || normalized.length > maxLength) {
      throw new BadRequestException(
        `${path} length must be between ${minLength} and ${maxLength}`,
      );
    }

    if (pattern && !pattern.test(normalized)) {
      throw new BadRequestException(`${path} has invalid format`);
    }

    return normalized;
  }

  private requireInteger(value: unknown, path: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new BadRequestException(`${path} must be an integer`);
    }

    if (value < min || value > max) {
      throw new BadRequestException(`${path} must be between ${min} and ${max}`);
    }

    return value;
  }

  private requireEnum(value: unknown, path: string, allowed: readonly string[]): string {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`${path} must be one of: ${allowed.join(', ')}`);
    }
    return value;
  }

  private requireUrlOrPath(value: unknown, path: string): string {
    const normalized = this.requireString(value, path, 1, 2048);
    if (!/^(https?:\/\/[^\s]+|\/[^\s]*)$/.test(normalized)) {
      throw new BadRequestException(`${path} must be a valid URL or internal path`);
    }
    return normalized;
  }

  private requireColor(value: unknown, path: string): string {
    const normalized = this.requireString(value, path, 4, 40);
    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized);
    const isRgb = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(normalized);
    if (!isHex && !isRgb) {
      throw new BadRequestException(`${path} must be a valid color (#hex, rgb, rgba)`);
    }
    return normalized;
  }

  private assertAllowedKeys(
    object: Record<string, unknown>,
    allowedKeys: Set<string>,
    path: string,
  ) {
    for (const key of Object.keys(object)) {
      if (!allowedKeys.has(key)) {
        throw new BadRequestException(`${path}.${key} is not allowed`);
      }
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
