import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { Size } from '../sizes/entities/size.entity';
import { Color } from '../colors/entities/color.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Currency } from '../currencies/entities/currency.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity';
import { CouponType } from '../coupons/enums/coupon-type.enum';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ShippingAddress } from '../orders/entities/shipping-address.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Carrier } from '../shipments/entities/carrier.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ShipmentItem } from '../shipments/entities/shipment-item.entity';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { ShipmentStatus } from '../shipments/enums/shipment-status.enum';
import { ShipmentEventType } from '../shipments/enums/shipment-event-type.enum';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { CleanSeedDto, SeedCleanMode } from './dto/clean-seed.dto';
import { RunSeedDto, SeedRunTarget } from './dto/run-seed.dto';
import { SeedTarget } from './dto/seed-target.dto';
import { SavePdfDraftDto } from './dto/save-pdf-draft.dto';
import { PdfDraft } from './entities/pdf-draft.entity';

type MutationOutcome = 'created' | 'updated';
const SEED_SCOPE = 'catalog-flow-v2';
const SEED_NOTE_PREFIX = `[seed:${SEED_SCOPE}]`;
const SEED_REASON_PREFIX = `[seed:${SEED_SCOPE}]`;
const SEED_COUPON_CODES = ['WELCOME10', 'BULK15'] as const;
const SEED_PRODUCT_SKUS = ['APP-POLO-PIMA', 'HOME-TERMO-750', 'FOOD-CAFE-GEISHA-1KG'] as const;
const SEED_VARIANT_SKUS = [
  'APP-POLO-PIMA-BLK-M',
  'APP-POLO-PIMA-BLK-L',
  'APP-POLO-PIMA-WHT-M',
] as const;
const SEED_CARRIER_CODES = ['own-fleet', 'external-courier'] as const;

@Injectable()
export class AdminToolsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Size)
    private readonly sizeRepository: Repository<Size>,
    @InjectRepository(Color)
    private readonly colorRepository: Repository<Color>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsageRepository: Repository<CouponUsage>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Carrier)
    private readonly carrierRepository: Repository<Carrier>,
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(PdfDraft)
    private readonly pdfDraftRepository: Repository<PdfDraft>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async savePdfDraft(userId: string, dto: SavePdfDraftDto) {
    const documentKey = dto.documentKey.trim();
    const fileName = dto.fileName.trim();

    if (!documentKey) {
      throw new BadRequestException('documentKey is required');
    }

    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    let draft = await this.pdfDraftRepository.findOne({
      where: {
        userId,
        documentKey,
      },
    });

    if (!draft) {
      draft = this.pdfDraftRepository.create({
        userId,
        documentKey,
        fileName,
        totalPages: dto.totalPages,
        draft: dto.draft,
      });
    } else {
      draft.fileName = fileName;
      draft.totalPages = dto.totalPages;
      draft.draft = dto.draft;
    }

    const saved = await this.pdfDraftRepository.save(draft);

    return {
      id: saved.id,
      documentKey: saved.documentKey,
      fileName: saved.fileName,
      totalPages: saved.totalPages,
      draft: saved.draft,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async getPdfDraft(userId: string, documentKey: string) {
    const normalizedKey = documentKey.trim();
    if (!normalizedKey) {
      throw new BadRequestException('documentKey is required');
    }

    const draft = await this.pdfDraftRepository.findOne({
      where: {
        userId,
        documentKey: normalizedKey,
      },
    });

    if (!draft) {
      return null;
    }

    return {
      id: draft.id,
      documentKey: draft.documentKey,
      fileName: draft.fileName,
      totalPages: draft.totalPages,
      draft: draft.draft,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  async deletePdfDraft(userId: string, documentKey: string) {
    const normalizedKey = documentKey.trim();
    if (!normalizedKey) {
      throw new BadRequestException('documentKey is required');
    }

    const result = await this.pdfDraftRepository.delete({
      userId,
      documentKey: normalizedKey,
    });

    return {
      deleted: (result.affected ?? 0) > 0,
    };
  }

  private assertEnabled() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const enabledByEnv = this.configService.get<boolean>('SEED_API_ENABLED', false);

    if (isProduction || !enabledByEnv) {
      throw new ForbiddenException('Seed API is disabled');
    }
  }

  private assertDestructiveConfirmation(
    mode: SeedCleanMode,
    forceMode: boolean,
    confirmationPhrase?: string,
  ) {
    const isDestructiveMode =
      forceMode || mode === SeedCleanMode.USERS_ALL || mode === SeedCleanMode.ALL;

    if (!isDestructiveMode) {
      return;
    }

    const expectedPhrase =
      this.configService.get<string>('SEED_API_CONFIRMATION_PHRASE') ?? 'CONFIRMAR';

    if ((confirmationPhrase ?? '').trim() !== expectedPhrase) {
      throw new ForbiddenException('Destructive seed action requires valid confirmation phrase');
    }
  }

  private resolveRunTargets(requestedTargets?: SeedRunTarget[]) {
    const baseOrder = [
      SeedTarget.ACCESS,
      SeedTarget.SIZES,
      SeedTarget.COLORS,
      SeedTarget.CURRENCIES,
      SeedTarget.CATEGORIES,
      SeedTarget.TAGS,
      SeedTarget.PRODUCTS,
      SeedTarget.COUPONS,
      SeedTarget.ORDERS,
      SeedTarget.CARRIERS,
      SeedTarget.SHIPMENTS,
      SeedTarget.NOTIFICATIONS,
    ];

    const targets = new Set(
      requestedTargets && requestedTargets.length > 0 ? requestedTargets : baseOrder,
    );

    if (targets.has(SeedTarget.PRODUCTS)) {
      targets.add(SeedTarget.SIZES);
      targets.add(SeedTarget.COLORS);
      targets.add(SeedTarget.CURRENCIES);
      targets.add(SeedTarget.CATEGORIES);
      targets.add(SeedTarget.TAGS);
    }

    if (targets.has(SeedTarget.COUPONS)) {
      targets.add(SeedTarget.CURRENCIES);
    }

    if (targets.has(SeedTarget.ORDERS)) {
      targets.add(SeedTarget.ACCESS);
      targets.add(SeedTarget.PRODUCTS);
      targets.add(SeedTarget.COUPONS);
    }

    if (targets.has(SeedTarget.SHIPMENTS)) {
      targets.add(SeedTarget.ORDERS);
      targets.add(SeedTarget.CARRIERS);
    }

    if (targets.has(SeedTarget.NOTIFICATIONS)) {
      targets.add(SeedTarget.ACCESS);
      targets.add(SeedTarget.ORDERS);
    }

    return baseOrder.filter((target) => targets.has(target));
  }

  private async seedUsers() {
    const superAdminEmail =
      this.configService.get<string>('SEED_SUPER_ADMIN_EMAIL') ?? 'superadmin@local.dev';
    const superAdminRawPassword =
      this.configService.get<string>('SEED_SUPER_ADMIN_PASSWORD') ?? 'SuperAdmin2026!';
    const adminEmail = this.configService.get<string>('SEED_ADMIN_EMAIL') ?? 'admin@local.dev';
    const adminRawPassword =
      this.configService.get<string>('SEED_ADMIN_PASSWORD') ?? 'Admin2026!';
    const customerPassword =
      this.configService.get<string>('SEED_CUSTOMER_PASSWORD') ?? 'Customer2026!';

    const upsertSeedUser = async (params: {
      email: string;
      rawPassword: string;
      firstName: string;
      lastName: string;
      role: Role;
    }): Promise<MutationOutcome> => {
      const existingUser = await this.userRepository.findOne({
        where: { email: params.email },
      });

      const passwordHash = await bcrypt.hash(params.rawPassword, 10);

      if (!existingUser) {
        await this.userRepository.save(
          this.userRepository.create({
            email: params.email,
            passwordHash,
            firstName: params.firstName,
            lastName: params.lastName,
            role: params.role,
            isActive: true,
          }),
        );
        return 'created';
      }

      existingUser.passwordHash = passwordHash;
      existingUser.firstName = params.firstName;
      existingUser.lastName = params.lastName;
      existingUser.role = params.role;
      existingUser.isActive = true;
      await this.userRepository.save(existingUser);
      return 'updated';
    };

    const seedUsers = [
      { email: superAdminEmail, rawPassword: superAdminRawPassword, firstName: 'Super', lastName: 'Admin', role: Role.SUPER_ADMIN },
      { email: 'superadmin2@local.dev', rawPassword: superAdminRawPassword, firstName: 'Platform', lastName: 'Owner', role: Role.SUPER_ADMIN },
      { email: adminEmail, rawPassword: adminRawPassword, firstName: 'Admin', lastName: 'User', role: Role.ADMIN },
      { email: 'admin2@local.dev', rawPassword: adminRawPassword, firstName: 'Store', lastName: 'Manager', role: Role.ADMIN },
      { email: 'admin3@local.dev', rawPassword: adminRawPassword, firstName: 'Ops', lastName: 'Manager', role: Role.ADMIN },
      { email: 'boss@local.dev', rawPassword: adminRawPassword, firstName: 'Boss', lastName: 'User', role: Role.BOSS },
      { email: 'marketing@local.dev', rawPassword: adminRawPassword, firstName: 'Marketing', lastName: 'Lead', role: Role.MARKETING },
      { email: 'sales@local.dev', rawPassword: adminRawPassword, firstName: 'Sales', lastName: 'Lead', role: Role.SALES },
      { email: 'customer1@local.dev', rawPassword: customerPassword, firstName: 'Ana', lastName: 'Cliente', role: Role.CUSTOMER },
      { email: 'customer2@local.dev', rawPassword: customerPassword, firstName: 'Luis', lastName: 'Cliente', role: Role.CUSTOMER },
      { email: 'customer3@local.dev', rawPassword: customerPassword, firstName: 'Carla', lastName: 'Cliente', role: Role.CUSTOMER },
    ];

    let created = 0;
    let updated = 0;
    const roles: Record<string, number> = {};

    for (const userData of seedUsers) {
      const outcome = await upsertSeedUser(userData);
      if (outcome === 'created') created += 1;
      if (outcome === 'updated') updated += 1;
      roles[userData.role] = (roles[userData.role] ?? 0) + 1;
    }

    return {
      created,
      updated,
      roles,
      credentials: {
        superAdmin: {
          password: superAdminRawPassword,
          emails: [superAdminEmail, 'superadmin2@local.dev'],
        },
        admin: {
          password: adminRawPassword,
          emails: [adminEmail, 'admin2@local.dev', 'admin3@local.dev'],
        },
        customer: {
          password: customerPassword,
          emails: ['customer1@local.dev', 'customer2@local.dev', 'customer3@local.dev'],
        },
      },
    };
  }

  private async seedSizes() {
    const seedSizes = [
      { name: 'Extra Small', abbreviation: 'XS', displayOrder: 1 },
      { name: 'Small', abbreviation: 'S', displayOrder: 2 },
      { name: 'Medium', abbreviation: 'M', displayOrder: 3 },
      { name: 'Large', abbreviation: 'L', displayOrder: 4 },
      { name: 'Extra Large', abbreviation: 'XL', displayOrder: 5 },
      { name: 'XXL', abbreviation: 'XXL', displayOrder: 6 },
    ];

    let created = 0;
    let updated = 0;
    for (const sizeData of seedSizes) {
      const existingSize = await this.sizeRepository.findOne({
        where: { abbreviation: sizeData.abbreviation },
      });
      if (!existingSize) {
        await this.sizeRepository.save(this.sizeRepository.create(sizeData));
        created += 1;
        continue;
      }

      existingSize.name = sizeData.name;
      existingSize.displayOrder = sizeData.displayOrder;
      await this.sizeRepository.save(existingSize);
      updated += 1;
    }

    return { created, updated };
  }

  private async seedColors() {
    const seedColors = [
      { name: 'Black', hexCode: '#000000' },
      { name: 'White', hexCode: '#FFFFFF' },
      { name: 'Red', hexCode: '#FF0000' },
      { name: 'Blue', hexCode: '#0000FF' },
      { name: 'Green', hexCode: '#00FF00' },
      { name: 'Yellow', hexCode: '#FFFF00' },
      { name: 'Gray', hexCode: '#808080' },
      { name: 'Navy', hexCode: '#000080' },
    ];

    let created = 0;
    let updated = 0;
    for (const colorData of seedColors) {
      const existingColor = await this.colorRepository.findOne({
        where: { name: colorData.name },
      });
      if (!existingColor) {
        await this.colorRepository.save(this.colorRepository.create(colorData));
        created += 1;
        continue;
      }

      existingColor.hexCode = colorData.hexCode;
      await this.colorRepository.save(existingColor);
      updated += 1;
    }

    return { created, updated };
  }

  private async seedCurrencies() {
    const seedCurrencies = [
      { code: 'USD', name: 'Dolares estadounidenses', symbol: '$', exchangeRateToUsd: '1.000000', isActive: true, isDefault: true },
      { code: 'PEN', name: 'Soles peruanos', symbol: 'S/', exchangeRateToUsd: '3.750000', isActive: true, isDefault: false },
      { code: 'MXN', name: 'Pesos mexicanos', symbol: '$', exchangeRateToUsd: '17.000000', isActive: true, isDefault: false },
      { code: 'COP', name: 'Pesos colombianos', symbol: '$', exchangeRateToUsd: '3900.000000', isActive: true, isDefault: false },
      { code: 'CLP', name: 'Pesos chilenos', symbol: '$', exchangeRateToUsd: '950.000000', isActive: true, isDefault: false },
    ];

    let created = 0;
    let updated = 0;
    for (const currencyData of seedCurrencies) {
      const existingCurrency = await this.currencyRepository.findOne({
        where: { code: currencyData.code },
      });

      if (!existingCurrency) {
        await this.currencyRepository.save(this.currencyRepository.create(currencyData));
        created += 1;
        continue;
      }

      existingCurrency.name = currencyData.name;
      existingCurrency.symbol = currencyData.symbol;
      existingCurrency.exchangeRateToUsd = currencyData.exchangeRateToUsd;
      existingCurrency.isActive = currencyData.isActive;
      existingCurrency.isDefault = currencyData.isDefault;
      await this.currencyRepository.save(existingCurrency);
      updated += 1;
    }

    await this.currencyRepository
      .createQueryBuilder()
      .update(Currency)
      .set({ isDefault: false })
      .where('code <> :defaultCode', { defaultCode: 'USD' })
      .execute();

    return { created, updated, defaultCurrency: 'USD' };
  }

  private async seedTags() {
    const seedTags = [
      { name: 'Nuevo', slug: 'nuevo', isActive: true },
      { name: 'Destacado', slug: 'destacado', isActive: true },
      { name: 'Outdoor', slug: 'outdoor', isActive: true },
      { name: 'Cafe especialidad', slug: 'cafe-especialidad', isActive: true },
    ];

    let created = 0;
    let updated = 0;
    for (const tagData of seedTags) {
      const existingTag = await this.tagRepository.findOne({ where: { slug: tagData.slug } });
      if (!existingTag) {
        await this.tagRepository.save(this.tagRepository.create(tagData));
        created += 1;
        continue;
      }

      existingTag.name = tagData.name;
      existingTag.isActive = tagData.isActive;
      await this.tagRepository.save(existingTag);
      updated += 1;
    }

    return { created, updated };
  }

  private async seedCategories() {
    const upsertCategory = async (data: {
      name: string;
      slug: string;
      description?: string;
      displayOrder: number;
      parent?: Category | null;
      supportsSizeColorVariants?: boolean;
      supportsDimensions?: boolean;
      supportsWeight?: boolean;
      attributeDefinitions?: Category['attributeDefinitions'];
    }): Promise<MutationOutcome> => {
      const existing = await this.categoryRepository.findOne({ where: { slug: data.slug } });
      if (existing) {
        existing.name = data.name;
        existing.description = data.description ?? null;
        existing.displayOrder = data.displayOrder;
        existing.parent = data.parent ?? null;
        existing.isActive = true;
        existing.supportsSizeColorVariants = data.supportsSizeColorVariants ?? false;
        existing.supportsDimensions = data.supportsDimensions ?? false;
        existing.supportsWeight = data.supportsWeight ?? false;
        existing.attributeDefinitions = data.attributeDefinitions ?? [];
        await this.categoryRepository.save(existing);
        return 'updated';
      }

      await this.categoryRepository.save(
        this.categoryRepository.create({
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          displayOrder: data.displayOrder,
          parent: data.parent ?? null,
          isActive: true,
          supportsSizeColorVariants: data.supportsSizeColorVariants ?? false,
          supportsDimensions: data.supportsDimensions ?? false,
          supportsWeight: data.supportsWeight ?? false,
          attributeDefinitions: data.attributeDefinitions ?? [],
        }),
      );
      return 'created';
    };

    let created = 0;
    let updated = 0;
    const trackOutcome = (outcome: MutationOutcome) => {
      if (outcome === 'created') created += 1;
      if (outcome === 'updated') updated += 1;
    };

    trackOutcome(await upsertCategory({
      name: 'Indumentaria',
      slug: 'indumentaria',
      description: 'Catalogo textil con productos que pueden trabajar con variantes.',
      displayOrder: 1,
    }));
    trackOutcome(await upsertCategory({
      name: 'Hidratacion',
      slug: 'hidratacion',
      description: 'Botellas, termos y productos fisicos con medidas y peso.',
      displayOrder: 2,
    }));
    trackOutcome(await upsertCategory({
      name: 'Alimentos',
      slug: 'alimentos',
      description: 'Productos consumibles con peso y atributos tecnicos.',
      displayOrder: 3,
    }));

    const indumentaria = await this.categoryRepository.findOne({ where: { slug: 'indumentaria' } });
    const hidratacion = await this.categoryRepository.findOne({ where: { slug: 'hidratacion' } });
    const alimentos = await this.categoryRepository.findOne({ where: { slug: 'alimentos' } });

    if (!indumentaria || !hidratacion || !alimentos) {
      throw new BadRequestException('Unable to resolve root categories for segmented seed');
    }

    trackOutcome(await upsertCategory({
      name: 'Polos premium',
      slug: 'polos-premium',
      description: 'Prendas con tallas y colores, pensadas para el flujo legacy compatible.',
      displayOrder: 1,
      parent: indumentaria,
      supportsSizeColorVariants: true,
      supportsDimensions: false,
      supportsWeight: false,
      attributeDefinitions: [
        {
          key: 'material',
          label: 'Material',
          type: 'select',
          unit: null,
          required: true,
          options: ['Algodon', 'Pima', 'Blend'],
          helpText: 'Composicion principal de la prenda.',
          displayOrder: 1,
          isActive: true,
        },
        {
          key: 'fit',
          label: 'Fit',
          type: 'select',
          unit: null,
          required: true,
          options: ['Regular', 'Oversized'],
          helpText: 'Corte principal del producto.',
          displayOrder: 2,
          isActive: true,
        },
      ],
    }));
    trackOutcome(await upsertCategory({
      name: 'Termos termicos',
      slug: 'termos-termicos',
      description: 'Productos sin variantes de talla/color y con perfil logistico completo.',
      displayOrder: 1,
      parent: hidratacion,
      supportsSizeColorVariants: false,
      supportsDimensions: true,
      supportsWeight: true,
      attributeDefinitions: [
        {
          key: 'capacity_ml',
          label: 'Capacidad',
          type: 'number',
          unit: 'ml',
          required: true,
          options: [],
          helpText: 'Capacidad nominal del termo.',
          displayOrder: 1,
          isActive: true,
        },
        {
          key: 'thermal_hours',
          label: 'Retencion termica',
          type: 'number',
          unit: 'h',
          required: true,
          options: [],
          helpText: 'Horas aproximadas de conservacion.',
          displayOrder: 2,
          isActive: true,
        },
      ],
    }));
    trackOutcome(await upsertCategory({
      name: 'Cafe de especialidad',
      slug: 'cafe-especialidad',
      description: 'Cafe en grano o molido con atributos tecnicos por origen y tueste.',
      displayOrder: 1,
      parent: alimentos,
      supportsSizeColorVariants: false,
      supportsDimensions: false,
      supportsWeight: true,
      attributeDefinitions: [
        {
          key: 'origin',
          label: 'Origen',
          type: 'text',
          unit: null,
          required: true,
          options: [],
          helpText: 'Zona o finca de origen del cafe.',
          displayOrder: 1,
          isActive: true,
        },
        {
          key: 'roast',
          label: 'Tueste',
          type: 'select',
          unit: null,
          required: true,
          options: ['Claro', 'Medio', 'Oscuro'],
          helpText: 'Perfil de tueste del lote.',
          displayOrder: 2,
          isActive: true,
        },
      ],
    }));

    return {
      created,
      updated,
      slugs: ['indumentaria', 'hidratacion', 'alimentos', 'polos-premium', 'termos-termicos', 'cafe-especialidad'],
    };
  }

  private async seedProducts() {
    const [poloCategory, termoCategory, cafeCategory] = await Promise.all([
      this.categoryRepository.findOne({ where: { slug: 'polos-premium' } }),
      this.categoryRepository.findOne({ where: { slug: 'termos-termicos' } }),
      this.categoryRepository.findOne({ where: { slug: 'cafe-especialidad' } }),
    ]);
    const tags = await this.tagRepository.find({
      where: { slug: In(['nuevo', 'destacado', 'outdoor', 'cafe-especialidad']) },
    });
    const sizes = await this.sizeRepository.find({ where: { abbreviation: In(['M', 'L']) } });
    const colors = await this.colorRepository.find({ where: { name: In(['Black', 'White']) } });

    if (!poloCategory || !termoCategory || !cafeCategory) {
      throw new BadRequestException('Products target requires seeded categories');
    }

    const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag]));
    const sizeByAbbreviation = new Map(sizes.map((size) => [size.abbreviation, size]));
    const colorByName = new Map(colors.map((color) => [color.name, color]));

    const upsertProduct = async (data: {
      name: string;
      sku: string;
      slug: string;
      description: string;
      basePrice: string;
      currencyCode: string;
      stock: number;
      category: Category;
      tags: Tag[];
      weightValue?: string | null;
      weightUnit?: string | null;
      lengthValue?: string | null;
      widthValue?: string | null;
      heightValue?: string | null;
      dimensionUnit?: string | null;
      attributeValues?: Product['attributeValues'];
      isFeatured?: boolean;
      hasOffer?: boolean;
      offerPrice?: string | null;
      offerPercentage?: string | null;
      images?: Array<{ url: string; altText: string | null; displayOrder: number; isMain: boolean }>;
    }) => {
      const existing = await this.productRepository.findOne({ where: { sku: data.sku } });
      const target = existing ?? this.productRepository.create();

      target.name = data.name;
      target.sku = data.sku;
      target.slug = data.slug;
      target.description = data.description;
      target.basePrice = data.basePrice;
      target.currencyCode = data.currencyCode;
      target.stock = data.stock;
      target.category = data.category;
      target.tags = data.tags;
      target.weightValue = data.weightValue ?? null;
      target.weightUnit = data.weightUnit ?? null;
      target.lengthValue = data.lengthValue ?? null;
      target.widthValue = data.widthValue ?? null;
      target.heightValue = data.heightValue ?? null;
      target.dimensionUnit = data.dimensionUnit ?? null;
      target.attributeValues = data.attributeValues ?? [];
      target.isActive = true;
      target.isFeatured = data.isFeatured ?? false;
      target.hasOffer = data.hasOffer ?? false;
      target.offerPrice = data.offerPrice ?? null;
      target.offerPercentage = data.offerPercentage ?? null;

      const savedProduct = await this.productRepository.save(target);
      await this.productImageRepository
        .createQueryBuilder()
        .delete()
        .from(ProductImage)
        .where('product_id = :productId', { productId: savedProduct.id })
        .execute();

      if (data.images?.length) {
        await this.productImageRepository.save(
          data.images.map((image) =>
            this.productImageRepository.create({
              product: savedProduct,
              url: image.url,
              altText: image.altText,
              displayOrder: image.displayOrder,
              isMain: image.isMain,
            }),
          ),
        );
      }

      return {
        product: savedProduct,
        outcome: existing ? ('updated' as MutationOutcome) : ('created' as MutationOutcome),
      };
    };

    const upsertVariant = async (data: {
      sku: string;
      product: Product;
      size: Size;
      color: Color;
      stock: number;
      additionalPrice: string;
    }): Promise<MutationOutcome> => {
      const existingVariant = await this.variantRepository.findOne({ where: { sku: data.sku } });
      const variant = existingVariant ?? this.variantRepository.create();
      variant.sku = data.sku;
      variant.product = data.product;
      variant.size = data.size;
      variant.color = data.color;
      variant.stock = data.stock;
      variant.additionalPrice = data.additionalPrice;
      variant.isActive = true;
      await this.variantRepository.save(variant);
      return existingVariant ? 'updated' : 'created';
    };

    let createdProducts = 0;
    let updatedProducts = 0;
    let createdVariants = 0;
    let updatedVariants = 0;

    const poloResult = await upsertProduct({
      name: 'Polo Pima Signature',
      sku: 'APP-POLO-PIMA',
      slug: 'polo-pima-signature',
      description: 'Polo premium para probar el flujo con variantes de talla y color.',
      basePrice: '79.90',
      currencyCode: 'USD',
      stock: 18,
      category: poloCategory,
      tags: [tagBySlug.get('nuevo'), tagBySlug.get('destacado')].filter(Boolean) as Tag[],
      attributeValues: [
        { key: 'material', label: 'Material', type: 'select', unit: null, value: 'Pima' },
        { key: 'fit', label: 'Fit', type: 'select', unit: null, value: 'Regular' },
      ],
      isFeatured: true,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
          altText: 'Polo premium en percha',
          displayOrder: 1,
          isMain: true,
        },
      ],
    });
    if (poloResult.outcome === 'created') createdProducts += 1;
    if (poloResult.outcome === 'updated') updatedProducts += 1;

    const termoResult = await upsertProduct({
      name: 'Termo Expedition 750 ml',
      sku: 'HOME-TERMO-750',
      slug: 'termo-expedition-750',
      description: 'Termo sin variantes con medidas, peso y atributos dinamicos.',
      basePrice: '34.50',
      currencyCode: 'USD',
      stock: 32,
      category: termoCategory,
      tags: [tagBySlug.get('destacado'), tagBySlug.get('outdoor')].filter(Boolean) as Tag[],
      weightValue: '0.620',
      weightUnit: 'kg',
      lengthValue: '8.00',
      widthValue: '8.00',
      heightValue: '29.00',
      dimensionUnit: 'cm',
      attributeValues: [
        { key: 'capacity_ml', label: 'Capacidad', type: 'number', unit: 'ml', value: 750 },
        { key: 'thermal_hours', label: 'Retencion termica', type: 'number', unit: 'h', value: 12 },
      ],
      isFeatured: true,
      hasOffer: true,
      offerPrice: '29.90',
      offerPercentage: '13.33',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80',
          altText: 'Termo metalico sobre mesa',
          displayOrder: 1,
          isMain: true,
        },
      ],
    });
    if (termoResult.outcome === 'created') createdProducts += 1;
    if (termoResult.outcome === 'updated') updatedProducts += 1;

    const cafeResult = await upsertProduct({
      name: 'Cafe Geisha 1 kg',
      sku: 'FOOD-CAFE-GEISHA-1KG',
      slug: 'cafe-geisha-1kg',
      description: 'Producto sin variantes con atributos por origen, proceso y molienda.',
      basePrice: '28.00',
      currencyCode: 'USD',
      stock: 18,
      category: cafeCategory,
      tags: [tagBySlug.get('nuevo'), tagBySlug.get('cafe-especialidad')].filter(Boolean) as Tag[],
      weightValue: '1.000',
      weightUnit: 'kg',
      attributeValues: [
        { key: 'origin', label: 'Origen', type: 'text', unit: null, value: 'Jaen, Peru' },
        { key: 'roast', label: 'Tueste', type: 'select', unit: null, value: 'Medio' },
      ],
      images: [
        {
          url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
          altText: 'Cafe en grano servido en taza',
          displayOrder: 1,
          isMain: true,
        },
      ],
    });
    if (cafeResult.outcome === 'created') createdProducts += 1;
    if (cafeResult.outcome === 'updated') updatedProducts += 1;

    const variantInputs = [
      {
        sku: 'APP-POLO-PIMA-BLK-M',
        product: poloResult.product,
        size: sizeByAbbreviation.get('M'),
        color: colorByName.get('Black'),
        stock: 8,
        additionalPrice: '0.00',
      },
      {
        sku: 'APP-POLO-PIMA-BLK-L',
        product: poloResult.product,
        size: sizeByAbbreviation.get('L'),
        color: colorByName.get('Black'),
        stock: 6,
        additionalPrice: '2.00',
      },
      {
        sku: 'APP-POLO-PIMA-WHT-M',
        product: poloResult.product,
        size: sizeByAbbreviation.get('M'),
        color: colorByName.get('White'),
        stock: 4,
        additionalPrice: '0.00',
      },
    ];

    for (const variantInput of variantInputs) {
      if (!variantInput.size || !variantInput.color) {
        throw new BadRequestException('Products target requires seeded sizes and colors');
      }
      const outcome = await upsertVariant({
        sku: variantInput.sku,
        product: variantInput.product,
        size: variantInput.size,
        color: variantInput.color,
        stock: variantInput.stock,
        additionalPrice: variantInput.additionalPrice,
      });
      if (outcome === 'created') createdVariants += 1;
      if (outcome === 'updated') updatedVariants += 1;
    }

    return {
      createdProducts,
      updatedProducts,
      createdVariants,
      updatedVariants,
      skus: ['APP-POLO-PIMA', 'HOME-TERMO-750', 'FOOD-CAFE-GEISHA-1KG'],
    };
  }

  private async seedCoupons() {
    const upsertCoupon = async (data: {
      code: string;
      type: CouponType;
      value: string;
      currencyCode: string;
      minOrderAmount: string;
      maxUsage: number | null;
      isActive: boolean;
    }) => {
      const existingCoupon = await this.couponRepository.findOne({ where: { code: data.code } });
      if (!existingCoupon) {
        await this.couponRepository.save(
          this.couponRepository.create({
            ...data,
            usageCount: 0,
            startDate: null,
            endDate: null,
          }),
        );
        return 'created' as MutationOutcome;
      }

      existingCoupon.type = data.type;
      existingCoupon.value = data.value;
      existingCoupon.currencyCode = data.currencyCode;
      existingCoupon.minOrderAmount = data.minOrderAmount;
      existingCoupon.maxUsage = data.maxUsage;
      existingCoupon.isActive = data.isActive;
      existingCoupon.usageCount = 0;
      existingCoupon.startDate = null;
      existingCoupon.endDate = null;
      await this.couponRepository.save(existingCoupon);
      return 'updated' as MutationOutcome;
    };

    let created = 0;
    let updated = 0;

    const welcomeOutcome = await upsertCoupon({
      code: 'WELCOME10',
      type: CouponType.PERCENTAGE,
      value: '10.00',
      currencyCode: 'USD',
      minOrderAmount: '50.00',
      maxUsage: 100,
      isActive: true,
    });
    const bulkOutcome = await upsertCoupon({
      code: 'BULK15',
      type: CouponType.FIXED_AMOUNT,
      value: '15.00',
      currencyCode: 'USD',
      minOrderAmount: '120.00',
      maxUsage: null,
      isActive: true,
    });

    if (welcomeOutcome === 'created') created += 1;
    if (welcomeOutcome === 'updated') updated += 1;
    if (bulkOutcome === 'created') created += 1;
    if (bulkOutcome === 'updated') updated += 1;

    return { created, updated, codes: SEED_COUPON_CODES };
  }

  private async cleanupOrderDependencies(orderIds: string[]) {
    if (orderIds.length === 0) {
      return {
        deletedShipmentItems: 0,
        deletedShipments: 0,
      };
    }

    const deletedShipmentItems = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('shipment_items')
      .where('order_item_id IN (SELECT id FROM order_items WHERE order_id IN (:...orderIds))', {
        orderIds,
      })
      .execute();

    const deletedShipments = await this.shipmentRepository
      .createQueryBuilder()
      .delete()
      .from(Shipment)
      .where('order_id IN (:...orderIds)', { orderIds })
      .execute();

    return {
      deletedShipmentItems: deletedShipmentItems.affected ?? 0,
      deletedShipments: deletedShipments.affected ?? 0,
    };
  }

  private async seedOrders() {
    const users = await this.userRepository.find({
      where: { email: In(['customer1@local.dev', 'customer2@local.dev', 'customer3@local.dev']) },
    });
    const products = await this.productRepository.find({ where: { sku: In(SEED_PRODUCT_SKUS as unknown as string[]) } });
    const variants = await this.variantRepository.find({ where: { sku: In(SEED_VARIANT_SKUS as unknown as string[]) } });
    const coupons = await this.couponRepository.find({ where: { code: In(SEED_COUPON_CODES as unknown as string[]) } });

    const userByEmail = new Map(users.map((user) => [user.email, user]));
    const productBySku = new Map(products.map((product) => [product.sku, product]));
    const variantBySku = new Map(variants.map((variant) => [variant.sku, variant]));
    const couponByCode = new Map(coupons.map((coupon) => [coupon.code, coupon]));

    const customer1 = userByEmail.get('customer1@local.dev');
    const customer2 = userByEmail.get('customer2@local.dev');
    const customer3 = userByEmail.get('customer3@local.dev');
    const polo = productBySku.get('APP-POLO-PIMA');
    const termo = productBySku.get('HOME-TERMO-750');
    const cafe = productBySku.get('FOOD-CAFE-GEISHA-1KG');
    const poloBlackM = variantBySku.get('APP-POLO-PIMA-BLK-M');
    const poloBlackL = variantBySku.get('APP-POLO-PIMA-BLK-L');

    if (!customer1 || !customer2 || !customer3 || !polo || !termo || !cafe || !poloBlackM || !poloBlackL) {
      throw new BadRequestException('Orders target requires seeded users/products/variants/coupons');
    }

    const existingSeedOrderIds = (
      await this.orderRepository
        .createQueryBuilder('order')
        .select('order.id', 'id')
        .where('order.notes LIKE :notePrefix', { notePrefix: `${SEED_NOTE_PREFIX}%` })
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);

    let deletedShipmentItems = 0;
    let deletedShipments = 0;
    if (existingSeedOrderIds.length > 0) {
      const dependencyCleanup = await this.cleanupOrderDependencies(existingSeedOrderIds);
      deletedShipmentItems = dependencyCleanup.deletedShipmentItems;
      deletedShipments = dependencyCleanup.deletedShipments;

      await this.couponUsageRepository
        .createQueryBuilder()
        .delete()
        .from(CouponUsage)
        .where('order_id IN (:...orderIds)', { orderIds: existingSeedOrderIds })
        .execute();

      await this.orderRepository
        .createQueryBuilder()
        .delete()
        .from(Order)
        .where('id IN (:...orderIds)', { orderIds: existingSeedOrderIds })
        .execute();
    }

    const confirmedVariantOrder = this.orderRepository.create({
      user: customer1,
      status: OrderStatus.CONFIRMED,
      subtotal: '241.70',
      discount: '0.00',
      total: '241.70',
      currencyCode: 'USD',
      exchangeRateToUsd: '1.000000',
      coupon: null,
      notes: `${SEED_NOTE_PREFIX} orden variante confirmada`,
      items: [new OrderItem(), new OrderItem()],
      shippingAddresses: [new ShippingAddress()],
    });

    confirmedVariantOrder.items[0].product = polo;
    confirmedVariantOrder.items[0].variant = poloBlackM;
    confirmedVariantOrder.items[0].snapshotProductName = polo.name;
    confirmedVariantOrder.items[0].snapshotSku = poloBlackM.sku;
    confirmedVariantOrder.items[0].snapshotDescriptor = 'Medium / Black';
    confirmedVariantOrder.items[0].quantity = 2;
    confirmedVariantOrder.items[0].unitPrice = '79.90';
    confirmedVariantOrder.items[0].subtotal = '159.80';
    confirmedVariantOrder.items[1].product = polo;
    confirmedVariantOrder.items[1].variant = poloBlackL;
    confirmedVariantOrder.items[1].snapshotProductName = polo.name;
    confirmedVariantOrder.items[1].snapshotSku = poloBlackL.sku;
    confirmedVariantOrder.items[1].snapshotDescriptor = 'Large / Black';
    confirmedVariantOrder.items[1].quantity = 1;
    confirmedVariantOrder.items[1].unitPrice = '81.90';
    confirmedVariantOrder.items[1].subtotal = '81.90';
    confirmedVariantOrder.shippingAddresses[0].firstName = 'Ana';
    confirmedVariantOrder.shippingAddresses[0].lastName = 'Cliente';
    confirmedVariantOrder.shippingAddresses[0].street = 'Av. Primavera 123';
    confirmedVariantOrder.shippingAddresses[0].city = 'Lima';
    confirmedVariantOrder.shippingAddresses[0].state = 'Lima';
    confirmedVariantOrder.shippingAddresses[0].postalCode = '15046';
    confirmedVariantOrder.shippingAddresses[0].country = 'PE';
    confirmedVariantOrder.shippingAddresses[0].phoneNumber = '999111222';
    confirmedVariantOrder.shippingAddresses[0].isDefault = true;

    const pendingMixedOrder = this.orderRepository.create({
      user: customer2,
      status: OrderStatus.PENDING,
      subtotal: '97.00',
      discount: '9.70',
      total: '87.30',
      currencyCode: 'USD',
      exchangeRateToUsd: '1.000000',
      coupon: couponByCode.get('WELCOME10') ?? null,
      notes: `${SEED_NOTE_PREFIX} orden producto pendiente`,
      items: [new OrderItem(), new OrderItem()],
      shippingAddresses: [new ShippingAddress()],
    });

    pendingMixedOrder.items[0].product = termo;
    pendingMixedOrder.items[0].variant = null;
    pendingMixedOrder.items[0].snapshotProductName = termo.name;
    pendingMixedOrder.items[0].snapshotSku = termo.sku;
    pendingMixedOrder.items[0].snapshotDescriptor = '750 ml';
    pendingMixedOrder.items[0].quantity = 2;
    pendingMixedOrder.items[0].unitPrice = '34.50';
    pendingMixedOrder.items[0].subtotal = '69.00';
    pendingMixedOrder.items[1].product = cafe;
    pendingMixedOrder.items[1].variant = null;
    pendingMixedOrder.items[1].snapshotProductName = cafe.name;
    pendingMixedOrder.items[1].snapshotSku = cafe.sku;
    pendingMixedOrder.items[1].snapshotDescriptor = '1 kg';
    pendingMixedOrder.items[1].quantity = 1;
    pendingMixedOrder.items[1].unitPrice = '28.00';
    pendingMixedOrder.items[1].subtotal = '28.00';
    pendingMixedOrder.shippingAddresses[0].firstName = 'Luis';
    pendingMixedOrder.shippingAddresses[0].lastName = 'Cliente';
    pendingMixedOrder.shippingAddresses[0].street = 'Calle Comercio 456';
    pendingMixedOrder.shippingAddresses[0].city = 'Cusco';
    pendingMixedOrder.shippingAddresses[0].state = 'Cusco';
    pendingMixedOrder.shippingAddresses[0].postalCode = '08002';
    pendingMixedOrder.shippingAddresses[0].country = 'PE';
    pendingMixedOrder.shippingAddresses[0].phoneNumber = '988777666';
    pendingMixedOrder.shippingAddresses[0].isDefault = true;

    const deliveredCoffeeOrder = this.orderRepository.create({
      user: customer3,
      status: OrderStatus.DELIVERED,
      subtotal: '56.00',
      discount: '0.00',
      total: '56.00',
      currencyCode: 'USD',
      exchangeRateToUsd: '1.000000',
      coupon: null,
      notes: `${SEED_NOTE_PREFIX} orden producto entregada`,
      items: [new OrderItem()],
      shippingAddresses: [new ShippingAddress()],
    });

    deliveredCoffeeOrder.items[0].product = cafe;
    deliveredCoffeeOrder.items[0].variant = null;
    deliveredCoffeeOrder.items[0].snapshotProductName = cafe.name;
    deliveredCoffeeOrder.items[0].snapshotSku = cafe.sku;
    deliveredCoffeeOrder.items[0].snapshotDescriptor = '2 bolsas x 1 kg';
    deliveredCoffeeOrder.items[0].quantity = 2;
    deliveredCoffeeOrder.items[0].unitPrice = '28.00';
    deliveredCoffeeOrder.items[0].subtotal = '56.00';
    deliveredCoffeeOrder.shippingAddresses[0].firstName = 'Carla';
    deliveredCoffeeOrder.shippingAddresses[0].lastName = 'Cliente';
    deliveredCoffeeOrder.shippingAddresses[0].street = 'Jr. Central 789';
    deliveredCoffeeOrder.shippingAddresses[0].city = 'Arequipa';
    deliveredCoffeeOrder.shippingAddresses[0].state = 'Arequipa';
    deliveredCoffeeOrder.shippingAddresses[0].postalCode = '04001';
    deliveredCoffeeOrder.shippingAddresses[0].country = 'PE';
    deliveredCoffeeOrder.shippingAddresses[0].phoneNumber = '977555444';
    deliveredCoffeeOrder.shippingAddresses[0].isDefault = true;

    const savedOrders = await this.orderRepository.save([
      confirmedVariantOrder,
      pendingMixedOrder,
      deliveredCoffeeOrder,
    ]);

    return {
      deletedPreviousSeedOrders: existingSeedOrderIds.length,
      deletedPreviousSeedShipments: deletedShipments,
      deletedPreviousSeedShipmentItems: deletedShipmentItems,
      createdOrders: savedOrders.length,
      orderIds: savedOrders.map((order) => order.id),
    };
  }

  private async seedCarriers() {
    const upsertCarrier = async (data: {
      code: string;
      label: string;
      description: string;
      trackingUrlTemplate: string | null;
      displayOrder: number;
      config: Record<string, unknown>;
    }) => {
      const existing = await this.carrierRepository.findOne({ where: { code: data.code } });
      if (!existing) {
        await this.carrierRepository.save(
          this.carrierRepository.create({
            ...data,
            isEnabled: true,
            logoUrl: null,
          }),
        );
        return 'created' as MutationOutcome;
      }

      existing.label = data.label;
      existing.description = data.description;
      existing.trackingUrlTemplate = data.trackingUrlTemplate;
      existing.isEnabled = true;
      existing.displayOrder = data.displayOrder;
      existing.config = data.config;
      await this.carrierRepository.save(existing);
      return 'updated' as MutationOutcome;
    };

    let created = 0;
    let updated = 0;

    const ownFleetOutcome = await upsertCarrier({
      code: 'own-fleet',
      label: 'Transporte propio',
      description: 'Flota interna para envios urbanos (seed)',
      trackingUrlTemplate: null,
      displayOrder: 0,
      config: {
        operational: {
          operationMode: 'OWN_FLEET',
          mapProvider: 'OPENSTREETMAP',
          supportsRealtimeTracking: true,
          coverageRadiusKm: 30,
        },
        seedScope: SEED_SCOPE,
      },
    });
    const externalOutcome = await upsertCarrier({
      code: 'external-courier',
      label: 'Courier externo',
      description: 'Proveedor externo de respaldo (seed)',
      trackingUrlTemplate: 'https://tracking.local/{{trackingNumber}}',
      displayOrder: 1,
      config: {
        operational: {
          operationMode: 'EXTERNAL',
          supportsRealtimeTracking: false,
        },
        seedScope: SEED_SCOPE,
      },
    });

    if (ownFleetOutcome === 'created') created += 1;
    if (ownFleetOutcome === 'updated') updated += 1;
    if (externalOutcome === 'created') created += 1;
    if (externalOutcome === 'updated') updated += 1;

    return { created, updated, codes: SEED_CARRIER_CODES };
  }

  private async seedShipments() {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.shippingAddresses', 'shippingAddresses')
      .where('order.notes LIKE :notePrefix', { notePrefix: `${SEED_NOTE_PREFIX}%` })
      .getMany();

    const carriers = await this.carrierRepository.find({ where: { code: In(SEED_CARRIER_CODES as unknown as string[]) } });
    const carrierByCode = new Map(carriers.map((carrier) => [carrier.code, carrier]));

    if (orders.length === 0) {
      throw new BadRequestException('Shipments target requires seeded orders');
    }

    await this.shipmentRepository
      .createQueryBuilder()
      .delete()
      .where("metadata ->> 'seedScope' = :seedScope", { seedScope: SEED_SCOPE })
      .execute();

    let createdShipments = 0;
    let createdEvents = 0;
    let createdItems = 0;

    for (const [index, order] of orders.entries()) {
      const address = order.shippingAddresses[0];
      const selectedCarrier = index % 2 === 0
        ? (carrierByCode.get('own-fleet') ?? null)
        : (carrierByCode.get('external-courier') ?? null);

      const shipment = this.shipmentRepository.create({
        order,
        carrier: selectedCarrier,
        status: index % 2 === 0 ? ShipmentStatus.IN_TRANSIT : ShipmentStatus.PENDING,
        trackingNumber: `SEED-${order.id.slice(0, 8).toUpperCase()}`,
        trackingUrl: selectedCarrier?.trackingUrlTemplate
          ? selectedCarrier.trackingUrlTemplate.replace('{{trackingNumber}}', `SEED-${order.id.slice(0, 8).toUpperCase()}`)
          : null,
        shippingCost: '12.50',
        currencyCode: 'USD',
        shipToName: address ? `${address.firstName} ${address.lastName}` : null,
        shipToStreet: address?.street ?? null,
        shipToCity: address?.city ?? null,
        shipToState: address?.state ?? null,
        shipToPostalCode: address?.postalCode ?? null,
        shipToCountry: address?.country ?? null,
        shipToPhone: address?.phoneNumber ?? null,
        notes: `${SEED_NOTE_PREFIX} shipment`,
        metadata: {
          seedScope: SEED_SCOPE,
        },
        items: (order.items ?? []).map((orderItem) => {
          const item = new ShipmentItem();
          item.orderItem = orderItem;
          item.quantity = orderItem.quantity;
          return item;
        }),
        events: [
          {
            type: ShipmentEventType.NOTE,
            status: index % 2 === 0 ? ShipmentStatus.IN_TRANSIT : ShipmentStatus.PENDING,
            location: address?.city ?? 'Lima',
            lat: null,
            lng: null,
            description: `${SEED_NOTE_PREFIX} evento inicial`,
            occurredAt: new Date(),
            createdBy: order.user,
          } as ShipmentEvent,
        ],
      });

      const saved = await this.shipmentRepository.save(shipment);
      createdShipments += 1;
      createdItems += saved.items?.length ?? 0;
      createdEvents += saved.events?.length ?? 0;
    }

    return {
      createdShipments,
      createdItems,
      createdEvents,
      basedOnOrders: orders.length,
    };
  }

  private async seedNotifications() {
    const users = await this.userRepository.find({
      where: {
        email: In([
          'admin@local.dev',
          'boss@local.dev',
          'marketing@local.dev',
          'sales@local.dev',
        ]),
      },
    });
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.notes LIKE :notePrefix', { notePrefix: `${SEED_NOTE_PREFIX}%` })
      .getMany();

    if (users.length === 0) {
      throw new BadRequestException('Notifications target requires seeded admin users');
    }

    await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where("metadata ->> 'seedScope' = :seedScope", { seedScope: SEED_SCOPE })
      .execute();

    const actor = users[0] ?? null;
    const notifications = users.map((recipient, index) =>
      this.notificationRepository.create({
        recipientUser: recipient,
        actorUser: actor,
        type: index % 2 === 0 ? NotificationType.ORDER_CREATED : NotificationType.ORDER_STATUS_CHANGED,
        title: index % 2 === 0 ? 'Nueva orden seed' : 'Cambio de estado seed',
        message:
          index % 2 === 0
            ? 'Se registró una orden de prueba segmentada.'
            : 'Una orden de prueba cambió de estado.',
        link: orders[0] ? `/orders/${orders[0].id}` : '/orders',
        metadata: {
          seedScope: SEED_SCOPE,
          source: 'admin-tools-segmented',
        },
        isRead: false,
        readAt: null,
      }),
    );

    const saved = await this.notificationRepository.save(notifications);
    return {
      created: saved.length,
      recipients: saved.map((notification) => notification.recipientUser.id),
    };
  }

  private getDefaultCleanTargets(): SeedTarget[] {
    return [
      SeedTarget.NOTIFICATIONS,
      SeedTarget.SHIPMENTS,
      SeedTarget.ORDERS,
      SeedTarget.COUPONS,
      SeedTarget.PRODUCTS,
      SeedTarget.TAGS,
      SeedTarget.CATEGORIES,
      SeedTarget.CURRENCIES,
      SeedTarget.COLORS,
      SeedTarget.SIZES,
      SeedTarget.CARRIERS,
      SeedTarget.ACCESS,
    ];
  }

  private async cleanAccessTarget() {
    const seedUserEmails = [
      this.configService.get<string>('SEED_SUPER_ADMIN_EMAIL') ?? 'superadmin@local.dev',
      'superadmin2@local.dev',
      this.configService.get<string>('SEED_ADMIN_EMAIL') ?? 'admin@local.dev',
      'admin2@local.dev',
      'admin3@local.dev',
      'customer1@local.dev',
      'customer2@local.dev',
      'customer3@local.dev',
      'boss@local.dev',
      'marketing@local.dev',
      'sales@local.dev',
    ];

    const usersToDelete = await this.userRepository.find({ where: { email: In(seedUserEmails) } });
    if (usersToDelete.length === 0) {
      return { deletedUsers: 0 };
    }

    await this.userRepository.remove(usersToDelete);
    return { deletedUsers: usersToDelete.length };
  }

  private async cleanSizesTarget() {
    const seedSizeAbbreviations = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const sizesToDelete = await this.sizeRepository.find({ where: { abbreviation: In(seedSizeAbbreviations) } });
    const seedSizeIds = sizesToDelete.map((size) => size.id);
    const blockedCount = seedSizeIds.length
      ? await this.variantRepository
          .createQueryBuilder('variant')
          .where('variant.size_id IN (:...sizeIds)', { sizeIds: seedSizeIds })
          .getCount()
      : 0;

    if (sizesToDelete.length > 0 && blockedCount === 0) {
      await this.sizeRepository.remove(sizesToDelete);
    }

    return {
      deletedSizes: blockedCount === 0 ? sizesToDelete.length : 0,
      blockedSizeCount: blockedCount,
    };
  }

  private async cleanColorsTarget() {
    const seedColorNames = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Gray', 'Navy'];
    const colorsToDelete = await this.colorRepository.find({ where: { name: In(seedColorNames) } });
    const seedColorIds = colorsToDelete.map((color) => color.id);
    const blockedCount = seedColorIds.length
      ? await this.variantRepository
          .createQueryBuilder('variant')
          .where('variant.color_id IN (:...colorIds)', { colorIds: seedColorIds })
          .getCount()
      : 0;

    if (colorsToDelete.length > 0 && blockedCount === 0) {
      await this.colorRepository.remove(colorsToDelete);
    }

    return {
      deletedColors: blockedCount === 0 ? colorsToDelete.length : 0,
      blockedColorCount: blockedCount,
    };
  }

  private async cleanCurrenciesTarget() {
    const seedCurrencyCodes = ['USD', 'PEN', 'MXN', 'COP', 'CLP'];
    const currencyCodesInProducts = (
      await this.productRepository
        .createQueryBuilder('product')
        .select('DISTINCT product.currency_code', 'currencyCode')
        .where('product.currency_code IN (:...codes)', { codes: seedCurrencyCodes })
        .getRawMany<{ currencyCode: string }>()
    ).map((row) => row.currencyCode);

    const currencyCodesInOrders = (
      await this.orderRepository
        .createQueryBuilder('order')
        .select('DISTINCT order.currency_code', 'currencyCode')
        .where('order.currency_code IN (:...codes)', { codes: seedCurrencyCodes })
        .getRawMany<{ currencyCode: string }>()
    ).map((row) => row.currencyCode);

    const blockedCodes = Array.from(new Set([...currencyCodesInProducts, ...currencyCodesInOrders]));
    const deletableCodes = seedCurrencyCodes.filter((code) => code !== 'USD' && !blockedCodes.includes(code));

    const deleted = deletableCodes.length
      ? await this.currencyRepository.delete({ code: In(deletableCodes) })
      : { affected: 0 };

    return {
      deletedCurrencies: deleted.affected ?? 0,
      blockedCurrencyCodes: blockedCodes,
      skippedDefaultCurrency: 'USD',
    };
  }

  private async cleanCategoriesTarget() {
    const slugs = ['polos-premium', 'termos-termicos', 'cafe-especialidad', 'indumentaria', 'hidratacion', 'alimentos'];
    const categories = await this.categoryRepository.find({ where: { slug: In(slugs) } });
    const categoryIds = categories.map((category) => category.id);

    const blockedCount = categoryIds.length
      ? await this.productRepository
          .createQueryBuilder('product')
          .where('product.category_id IN (:...categoryIds)', { categoryIds })
          .getCount()
      : 0;

    if (categories.length > 0 && blockedCount === 0) {
      await this.categoryRepository.remove(categories);
    }

    return {
      deletedCategories: blockedCount === 0 ? categories.length : 0,
      blockedCategoryCount: blockedCount,
    };
  }

  private async cleanTagsTarget() {
    const tagSlugs = ['nuevo', 'destacado', 'outdoor', 'cafe-especialidad'];
    const tags = await this.tagRepository.find({ where: { slug: In(tagSlugs) } });
    const tagIds = tags.map((tag) => tag.id);

    const blockedCount = tagIds.length
      ? await this.productRepository
          .createQueryBuilder('product')
          .leftJoin('product.tags', 'tag')
          .where('tag.id IN (:...tagIds)', { tagIds })
          .getCount()
      : 0;

    if (tags.length > 0 && blockedCount === 0) {
      await this.tagRepository.remove(tags);
    }

    return {
      deletedTags: blockedCount === 0 ? tags.length : 0,
      blockedTagCount: blockedCount,
    };
  }

  private async cleanProductsTarget() {
    const products = await this.productRepository.find({ where: { sku: In(SEED_PRODUCT_SKUS as unknown as string[]) } });
    const productIds = products.map((product) => product.id);
    if (productIds.length === 0) {
      return { deletedProducts: 0, deletedVariants: 0, deletedImages: 0 };
    }

    const deletedImages = await this.productImageRepository
      .createQueryBuilder()
      .delete()
      .from(ProductImage)
      .where('product_id IN (:...productIds)', { productIds })
      .execute();

    const deletedVariants = await this.variantRepository
      .createQueryBuilder()
      .delete()
      .from(ProductVariant)
      .where('product_id IN (:...productIds)', { productIds })
      .execute();

    const deletedProducts = await this.productRepository
      .createQueryBuilder()
      .delete()
      .from(Product)
      .where('id IN (:...productIds)', { productIds })
      .execute();

    return {
      deletedProducts: deletedProducts.affected ?? 0,
      deletedVariants: deletedVariants.affected ?? 0,
      deletedImages: deletedImages.affected ?? 0,
    };
  }

  private async cleanCouponsTarget() {
    const coupons = await this.couponRepository.find({ where: { code: In(SEED_COUPON_CODES as unknown as string[]) } });
    const couponIds = coupons.map((coupon) => coupon.id);
    if (couponIds.length === 0) {
      return { deletedCoupons: 0, deletedCouponUsages: 0 };
    }

    const deletedUsages = await this.couponUsageRepository
      .createQueryBuilder()
      .delete()
      .from(CouponUsage)
      .where('coupon_id IN (:...couponIds)', { couponIds })
      .execute();

    const deletedCoupons = await this.couponRepository
      .createQueryBuilder()
      .delete()
      .from(Coupon)
      .where('id IN (:...couponIds)', { couponIds })
      .execute();

    return {
      deletedCoupons: deletedCoupons.affected ?? 0,
      deletedCouponUsages: deletedUsages.affected ?? 0,
    };
  }

  private async cleanOrdersTarget() {
    const seedOrderIds = (
      await this.orderRepository
        .createQueryBuilder('order')
        .select('order.id', 'id')
        .where('order.notes LIKE :notePrefix', { notePrefix: `${SEED_NOTE_PREFIX}%` })
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);

    if (seedOrderIds.length === 0) {
      return { deletedOrders: 0, deletedCouponUsages: 0 };
    }

    const dependencyCleanup = await this.cleanupOrderDependencies(seedOrderIds);

    const deletedUsages = await this.couponUsageRepository
      .createQueryBuilder()
      .delete()
      .from(CouponUsage)
      .where('order_id IN (:...orderIds)', { orderIds: seedOrderIds })
      .execute();

    const deletedOrders = await this.orderRepository
      .createQueryBuilder()
      .delete()
      .from(Order)
      .where('id IN (:...orderIds)', { orderIds: seedOrderIds })
      .execute();

    return {
      deletedOrders: deletedOrders.affected ?? 0,
      deletedCouponUsages: deletedUsages.affected ?? 0,
      deletedShipments: dependencyCleanup.deletedShipments,
      deletedShipmentItems: dependencyCleanup.deletedShipmentItems,
    };
  }

  private async cleanCarriersTarget() {
    const carriers = await this.carrierRepository.find({ where: { code: In(SEED_CARRIER_CODES as unknown as string[]) } });
    const carrierIds = carriers.map((carrier) => carrier.id);

    const blockedCount = carrierIds.length
      ? await this.shipmentRepository
          .createQueryBuilder('shipment')
          .where('shipment.carrier_id IN (:...carrierIds)', { carrierIds })
          .getCount()
      : 0;

    if (blockedCount === 0 && carrierIds.length > 0) {
      await this.carrierRepository
        .createQueryBuilder()
        .delete()
        .from(Carrier)
        .where('id IN (:...carrierIds)', { carrierIds })
        .execute();
    }

    return {
      deletedCarriers: blockedCount === 0 ? carrierIds.length : 0,
      blockedCarrierCount: blockedCount,
    };
  }

  private async cleanShipmentsTarget() {
    const deletedShipments = await this.shipmentRepository
      .createQueryBuilder()
      .delete()
      .from(Shipment)
      .where("metadata ->> 'seedScope' = :seedScope", { seedScope: SEED_SCOPE })
      .execute();

    return {
      deletedShipments: deletedShipments.affected ?? 0,
    };
  }

  private async cleanNotificationsTarget() {
    const deletedNotifications = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where("metadata ->> 'seedScope' = :seedScope", { seedScope: SEED_SCOPE })
      .execute();

    return {
      deletedNotifications: deletedNotifications.affected ?? 0,
    };
  }

  async runSeed(dto: RunSeedDto = {}) {
    this.assertEnabled();

    const targets = this.resolveRunTargets(dto.targets);
    const executed: Record<string, unknown> = {};

    for (const target of targets) {
      if (target === SeedRunTarget.ACCESS) {
        executed[target] = await this.seedUsers();
        continue;
      }
      if (target === SeedRunTarget.SIZES) {
        executed[target] = await this.seedSizes();
        continue;
      }
      if (target === SeedRunTarget.COLORS) {
        executed[target] = await this.seedColors();
        continue;
      }
      if (target === SeedRunTarget.CURRENCIES) {
        executed[target] = await this.seedCurrencies();
        continue;
      }
      if (target === SeedRunTarget.CATEGORIES) {
        executed[target] = await this.seedCategories();
        continue;
      }
      if (target === SeedRunTarget.TAGS) {
        executed[target] = await this.seedTags();
        continue;
      }
      if (target === SeedRunTarget.PRODUCTS) {
        executed[target] = await this.seedProducts();
        continue;
      }
      if (target === SeedRunTarget.COUPONS) {
        executed[target] = await this.seedCoupons();
        continue;
      }
      if (target === SeedRunTarget.ORDERS) {
        executed[target] = await this.seedOrders();
        continue;
      }
      if (target === SeedRunTarget.CARRIERS) {
        executed[target] = await this.seedCarriers();
        continue;
      }
      if (target === SeedRunTarget.SHIPMENTS) {
        executed[target] = await this.seedShipments();
        continue;
      }
      if (target === SeedRunTarget.NOTIFICATIONS) {
        executed[target] = await this.seedNotifications();
      }
    }

    return {
      mode: 'seed-run',
      segmented: true,
      targetsExecuted: targets,
      results: executed,
      credentials:
        SeedRunTarget.ACCESS in executed
          ? (executed[SeedRunTarget.ACCESS] as { credentials: Record<string, unknown> }).credentials
          : undefined,
    };
  }

  async cleanSeed(dto: CleanSeedDto, confirmationPhrase?: string) {
    this.assertEnabled();

    const startedAt = new Date();
    const startTimeMs = Date.now();

    const mode = dto.mode ?? SeedCleanMode.SEED;
    const forceMode = dto.force ?? false;
    this.assertDestructiveConfirmation(mode, forceMode, confirmationPhrase);

    if (mode === SeedCleanMode.ALL) {
      const userTableName = this.userRepository.metadata.tableName;
      const superAdminsBefore = await this.userRepository.find({
        where: { role: Role.SUPER_ADMIN },
        select: ['id', 'email'],
      });

      if (superAdminsBefore.length === 0) {
        throw new BadRequestException(
          'Cannot run full cleanup because no SUPER_ADMIN user exists to preserve',
        );
      }

      const tables: Array<{ tablename: string }> = await this.dataSource.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'migrations'
          AND tablename <> '${userTableName}'
      `);

      const tableNames = tables.map((table) => table.tablename);
      if (tableNames.length > 0) {
        const quotedTables = tableNames
          .map((tableName) => `"public"."${tableName}"`)
          .join(', ');
        await this.dataSource.query(
          `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
        );
      }

      const deletedNonSuperAdmins = await this.userRepository
        .createQueryBuilder()
        .delete()
        .where('role <> :superAdminRole', { superAdminRole: Role.SUPER_ADMIN })
        .execute();

      const superAdminsAfter = await this.userRepository.find({
        where: { role: Role.SUPER_ADMIN },
        select: ['email'],
      });

      const finishedAt = new Date();

      return {
        mode,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Date.now() - startTimeMs,
        tablesTruncated: tableNames.length,
        skippedTables: ['migrations', userTableName],
        deletedNonSuperAdmins: deletedNonSuperAdmins.affected ?? 0,
        preservedSuperAdmins: superAdminsAfter.map((user) => user.email),
        truncatedTables: tableNames.sort((a, b) => a.localeCompare(b)),
      };
    }

    if (mode === SeedCleanMode.USERS_ALL) {
      const userTableName = this.userRepository.metadata.tableName;
      await this.dataSource.query(
        `TRUNCATE TABLE "public"."${userTableName}" RESTART IDENTITY CASCADE`,
      );

      return {
        mode,
        usersTruncated: true,
      };
    }

    if (mode !== SeedCleanMode.SEED) {
      throw new BadRequestException('Invalid cleanup mode');
    }

    const targets = dto.targets && dto.targets.length > 0 ? dto.targets : this.getDefaultCleanTargets();
    const results: Record<string, unknown> = {};

    for (const target of targets) {
      if (target === SeedTarget.ACCESS) {
        results[target] = await this.cleanAccessTarget();
        continue;
      }
      if (target === SeedTarget.SIZES) {
        results[target] = await this.cleanSizesTarget();
        continue;
      }
      if (target === SeedTarget.COLORS) {
        results[target] = await this.cleanColorsTarget();
        continue;
      }
      if (target === SeedTarget.CURRENCIES) {
        results[target] = await this.cleanCurrenciesTarget();
        continue;
      }
      if (target === SeedTarget.CATEGORIES) {
        results[target] = await this.cleanCategoriesTarget();
        continue;
      }
      if (target === SeedTarget.TAGS) {
        results[target] = await this.cleanTagsTarget();
        continue;
      }
      if (target === SeedTarget.PRODUCTS) {
        results[target] = await this.cleanProductsTarget();
        continue;
      }
      if (target === SeedTarget.COUPONS) {
        results[target] = await this.cleanCouponsTarget();
        continue;
      }
      if (target === SeedTarget.ORDERS) {
        results[target] = await this.cleanOrdersTarget();
        continue;
      }
      if (target === SeedTarget.CARRIERS) {
        results[target] = await this.cleanCarriersTarget();
        continue;
      }
      if (target === SeedTarget.SHIPMENTS) {
        results[target] = await this.cleanShipmentsTarget();
        continue;
      }
      if (target === SeedTarget.NOTIFICATIONS) {
        results[target] = await this.cleanNotificationsTarget();
      }
    }

    return {
      mode: forceMode ? 'seed-force' : 'seed-safe',
      segmented: true,
      targetsExecuted: targets,
      results,
    };
  }
}
