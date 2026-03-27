import * as bcrypt from 'bcrypt';
import { In } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { Category } from '../src/categories/entities/category.entity';
import { Color } from '../src/colors/entities/color.entity';
import { Coupon } from '../src/coupons/entities/coupon.entity';
import { CouponUsage } from '../src/coupons/entities/coupon-usage.entity';
import { CouponType } from '../src/coupons/enums/coupon-type.enum';
import { Currency } from '../src/currencies/entities/currency.entity';
import { InventoryMovement } from '../src/inventory/entities/inventory-movement.entity';
import { InventoryMovementType } from '../src/inventory/enums/inventory-movement-type.enum';
import { Notification } from '../src/notifications/entities/notification.entity';
import { NotificationType } from '../src/notifications/enums/notification-type.enum';
import { Order } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { ShippingAddress } from '../src/orders/entities/shipping-address.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { Product } from '../src/products/entities/product.entity';
import { ProductImage } from '../src/products/entities/product-image.entity';
import { ProductVariant } from '../src/products/entities/product-variant.entity';
import { Size } from '../src/sizes/entities/size.entity';
import { Tag } from '../src/tags/entities/tag.entity';
import { Role } from '../src/common/enums/role.enum';
import { User } from '../src/users/entities/user.entity';
import {
  resolveSeedUserEmails,
  SEED_CATEGORY_SLUGS,
  SEED_COUPON_CODES,
  SEED_NOTE_PREFIX,
  SEED_PRODUCT_SKUS,
  SEED_REASON_PREFIX,
  SEED_SCOPE,
  SEED_SIZE_ABBREVIATIONS,
  SEED_COLOR_NAMES,
  SEED_TAG_SLUGS,
  SEED_VARIANT_SKUS,
} from './seed-data';

function money(value: number): string {
  return value.toFixed(2);
}

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('✓ Database connected');

    const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@local.dev';
    const superAdminRawPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin2026!';
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@local.dev';
    const adminRawPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin2026!';
    const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer2026!';

    const userRepository = AppDataSource.getRepository(User);
    const sizeRepository = AppDataSource.getRepository(Size);
    const colorRepository = AppDataSource.getRepository(Color);
    const categoryRepository = AppDataSource.getRepository(Category);
    const currencyRepository = AppDataSource.getRepository(Currency);
    const tagRepository = AppDataSource.getRepository(Tag);
    const couponRepository = AppDataSource.getRepository(Coupon);
    const couponUsageRepository = AppDataSource.getRepository(CouponUsage);
    const productRepository = AppDataSource.getRepository(Product);
    const productImageRepository = AppDataSource.getRepository(ProductImage);
    const variantRepository = AppDataSource.getRepository(ProductVariant);
    const inventoryRepository = AppDataSource.getRepository(InventoryMovement);
    const orderRepository = AppDataSource.getRepository(Order);
    const notificationRepository = AppDataSource.getRepository(Notification);

    const upsertSeedUser = async (params: {
      email: string;
      rawPassword: string;
      firstName: string;
      lastName: string;
      role: Role;
      label: string;
    }) => {
      const existingUser = await userRepository.findOne({
        where: { email: params.email },
      });

      const passwordHash = await bcrypt.hash(params.rawPassword, 10);

      if (!existingUser) {
        const newUser = userRepository.create({
          email: params.email,
          passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          role: params.role,
          isActive: true,
        });
        await userRepository.save(newUser);
        console.log(`✓ ${params.label} created`);
        return newUser;
      }

      existingUser.passwordHash = passwordHash;
      existingUser.firstName = params.firstName;
      existingUser.lastName = params.lastName;
      existingUser.role = params.role;
      existingUser.isActive = true;
      await userRepository.save(existingUser);
      console.log(`✓ ${params.label} updated`);
      return existingUser;
    };

    const seedUsers = [
      { email: superAdminEmail, rawPassword: superAdminRawPassword, firstName: 'Super', lastName: 'Admin', role: Role.SUPER_ADMIN, label: 'SUPER_ADMIN' },
      { email: 'superadmin2@local.dev', rawPassword: superAdminRawPassword, firstName: 'Platform', lastName: 'Owner', role: Role.SUPER_ADMIN, label: 'SUPER_ADMIN' },
      { email: adminEmail, rawPassword: adminRawPassword, firstName: 'Admin', lastName: 'User', role: Role.ADMIN, label: 'ADMIN' },
      { email: 'admin2@local.dev', rawPassword: adminRawPassword, firstName: 'Store', lastName: 'Manager', role: Role.ADMIN, label: 'ADMIN' },
      { email: 'admin3@local.dev', rawPassword: adminRawPassword, firstName: 'Ops', lastName: 'Manager', role: Role.ADMIN, label: 'ADMIN' },
      { email: 'boss@local.dev', rawPassword: adminRawPassword, firstName: 'Boss', lastName: 'User', role: Role.BOSS, label: 'BOSS' },
      { email: 'marketing@local.dev', rawPassword: adminRawPassword, firstName: 'Marketing', lastName: 'Lead', role: Role.MARKETING, label: 'MARKETING' },
      { email: 'sales@local.dev', rawPassword: adminRawPassword, firstName: 'Sales', lastName: 'Lead', role: Role.SALES, label: 'SALES' },
      { email: 'customer1@local.dev', rawPassword: customerPassword, firstName: 'Ana', lastName: 'Cliente', role: Role.CUSTOMER, label: 'CUSTOMER' },
      { email: 'customer2@local.dev', rawPassword: customerPassword, firstName: 'Luis', lastName: 'Cliente', role: Role.CUSTOMER, label: 'CUSTOMER' },
      { email: 'customer3@local.dev', rawPassword: customerPassword, firstName: 'Carla', lastName: 'Cliente', role: Role.CUSTOMER, label: 'CUSTOMER' },
    ];

    for (const seedUser of seedUsers) {
      await upsertSeedUser(seedUser);
    }

    const seedCurrencies = [
      { code: 'USD', name: 'Dolares estadounidenses', symbol: '$', exchangeRateToUsd: '1.000000', isActive: true, isDefault: true },
      { code: 'PEN', name: 'Soles peruanos', symbol: 'S/', exchangeRateToUsd: '3.750000', isActive: true, isDefault: false },
      { code: 'MXN', name: 'Pesos mexicanos', symbol: '$', exchangeRateToUsd: '17.000000', isActive: true, isDefault: false },
      { code: 'COP', name: 'Pesos colombianos', symbol: '$', exchangeRateToUsd: '3900.000000', isActive: true, isDefault: false },
      { code: 'CLP', name: 'Pesos chilenos', symbol: '$', exchangeRateToUsd: '950.000000', isActive: true, isDefault: false },
    ];

    for (const currencyData of seedCurrencies) {
      const existingCurrency = await currencyRepository.findOne({ where: { code: currencyData.code } });
      if (!existingCurrency) {
        await currencyRepository.save(currencyRepository.create(currencyData));
        console.log(`✓ Currency created: ${currencyData.code}`);
        continue;
      }

      existingCurrency.name = currencyData.name;
      existingCurrency.symbol = currencyData.symbol;
      existingCurrency.exchangeRateToUsd = currencyData.exchangeRateToUsd;
      existingCurrency.isActive = currencyData.isActive;
      existingCurrency.isDefault = currencyData.isDefault;
      await currencyRepository.save(existingCurrency);
      console.log(`~ Currency updated: ${currencyData.code}`);
    }

    await currencyRepository.createQueryBuilder().update(Currency).set({ isDefault: false }).where('code <> :defaultCode', { defaultCode: 'USD' }).execute();

    const sizeNames = [
      { name: 'Extra Small', abbreviation: 'XS', displayOrder: 1 },
      { name: 'Small', abbreviation: 'S', displayOrder: 2 },
      { name: 'Medium', abbreviation: 'M', displayOrder: 3 },
      { name: 'Large', abbreviation: 'L', displayOrder: 4 },
      { name: 'Extra Large', abbreviation: 'XL', displayOrder: 5 },
      { name: 'XXL', abbreviation: 'XXL', displayOrder: 6 },
    ];

    for (const sizeData of sizeNames) {
      const existingSize = await sizeRepository.findOne({ where: { abbreviation: sizeData.abbreviation } });
      if (!existingSize) {
        await sizeRepository.save(sizeRepository.create(sizeData));
        console.log(`✓ Size created: ${sizeData.name} (${sizeData.abbreviation})`);
        continue;
      }

      existingSize.name = sizeData.name;
      existingSize.displayOrder = sizeData.displayOrder;
      await sizeRepository.save(existingSize);
    }

    const colorData = [
      { name: 'Black', hexCode: '#000000' },
      { name: 'White', hexCode: '#FFFFFF' },
      { name: 'Red', hexCode: '#FF0000' },
      { name: 'Blue', hexCode: '#0000FF' },
      { name: 'Green', hexCode: '#00FF00' },
      { name: 'Yellow', hexCode: '#FFFF00' },
      { name: 'Gray', hexCode: '#808080' },
      { name: 'Navy', hexCode: '#000080' },
    ];

    for (const color of colorData) {
      const existingColor = await colorRepository.findOne({ where: { name: color.name } });
      if (!existingColor) {
        await colorRepository.save(colorRepository.create(color));
        console.log(`✓ Color created: ${color.name} (${color.hexCode})`);
        continue;
      }

      existingColor.hexCode = color.hexCode;
      await colorRepository.save(existingColor);
    }

    const tagData = [
      { name: 'Nuevo', slug: 'nuevo', isActive: true },
      { name: 'Destacado', slug: 'destacado', isActive: true },
      { name: 'Outdoor', slug: 'outdoor', isActive: true },
      { name: 'Cafe especialidad', slug: 'cafe-especialidad', isActive: true },
    ];

    for (const tagDataItem of tagData) {
      const existingTag = await tagRepository.findOne({ where: { slug: tagDataItem.slug } });
      if (!existingTag) {
        await tagRepository.save(tagRepository.create(tagDataItem));
        console.log(`✓ Tag created: ${tagDataItem.slug}`);
        continue;
      }

      existingTag.name = tagDataItem.name;
      existingTag.isActive = tagDataItem.isActive;
      await tagRepository.save(existingTag);
      console.log(`~ Tag updated: ${tagDataItem.slug}`);
    }

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
    }): Promise<Category> => {
      const existing = await categoryRepository.findOne({ where: { slug: data.slug } });
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
        await categoryRepository.save(existing);
        console.log(`~ Category updated: ${data.slug}`);
        return existing;
      }

      const category = categoryRepository.create({
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
      });
      await categoryRepository.save(category);
      console.log(`✓ Category created: ${data.slug}`);
      return category;
    };

    const indumentaria = await upsertCategory({ name: 'Indumentaria', slug: 'indumentaria', description: 'Catalogo textil con productos que pueden trabajar con variantes.', displayOrder: 1 });
    const hidratacion = await upsertCategory({ name: 'Hidratacion', slug: 'hidratacion', description: 'Botellas, termos y productos fisicos con medidas y peso.', displayOrder: 2 });
    const alimentos = await upsertCategory({ name: 'Alimentos', slug: 'alimentos', description: 'Productos consumibles con peso y atributos tecnicos.', displayOrder: 3 });

    const polosPremium = await upsertCategory({
      name: 'Polos premium',
      slug: 'polos-premium',
      description: 'Prendas con tallas y colores, pensadas para el flujo legacy compatible.',
      displayOrder: 1,
      parent: indumentaria,
      supportsSizeColorVariants: true,
      supportsDimensions: false,
      supportsWeight: false,
      attributeDefinitions: [
        { key: 'material', label: 'Material', type: 'select', unit: null, required: true, options: ['Algodon', 'Pima', 'Blend'], helpText: 'Composicion principal de la prenda.', displayOrder: 1, isActive: true },
        { key: 'fit', label: 'Fit', type: 'select', unit: null, required: true, options: ['Regular', 'Oversized'], helpText: 'Corte principal del producto.', displayOrder: 2, isActive: true },
      ],
    });

    const termosTermicos = await upsertCategory({
      name: 'Termos termicos',
      slug: 'termos-termicos',
      description: 'Productos sin variantes de talla/color y con perfil logistico completo.',
      displayOrder: 1,
      parent: hidratacion,
      supportsSizeColorVariants: false,
      supportsDimensions: true,
      supportsWeight: true,
      attributeDefinitions: [
        { key: 'capacity_ml', label: 'Capacidad', type: 'number', unit: 'ml', required: true, options: [], helpText: 'Capacidad nominal del termo.', displayOrder: 1, isActive: true },
        { key: 'thermal_hours', label: 'Retencion termica', type: 'number', unit: 'h', required: true, options: [], helpText: 'Horas aproximadas de conservacion.', displayOrder: 2, isActive: true },
        { key: 'material', label: 'Material', type: 'select', unit: null, required: true, options: ['Acero 304', 'Acero 316'], helpText: 'Material interior del termo.', displayOrder: 3, isActive: true },
        { key: 'dishwasher_safe', label: 'Apto lavavajillas', type: 'boolean', unit: null, required: false, options: [], helpText: 'Indica si se puede lavar en maquina.', displayOrder: 4, isActive: true },
      ],
    });

    const cafeEspecialidad = await upsertCategory({
      name: 'Cafe de especialidad',
      slug: 'cafe-especialidad',
      description: 'Cafe en grano o molido con atributos tecnicos por origen y tueste.',
      displayOrder: 1,
      parent: alimentos,
      supportsSizeColorVariants: false,
      supportsDimensions: false,
      supportsWeight: true,
      attributeDefinitions: [
        { key: 'origin', label: 'Origen', type: 'text', unit: null, required: true, options: [], helpText: 'Zona o finca de origen del cafe.', displayOrder: 1, isActive: true },
        { key: 'roast', label: 'Tueste', type: 'select', unit: null, required: true, options: ['Claro', 'Medio', 'Oscuro'], helpText: 'Perfil de tueste del lote.', displayOrder: 2, isActive: true },
        { key: 'process', label: 'Proceso', type: 'select', unit: null, required: true, options: ['Lavado', 'Honey', 'Natural'], helpText: 'Metodo de beneficio.', displayOrder: 3, isActive: true },
        { key: 'grind', label: 'Molienda', type: 'select', unit: null, required: true, options: ['Grano', 'Espresso', 'Prensa'], helpText: 'Tipo de presentacion del cafe.', displayOrder: 4, isActive: true },
      ],
    });

    const upsertCoupon = async (data: {
      code: string;
      type: CouponType;
      value: string;
      currencyCode: string;
      minOrderAmount: string;
      maxUsage: number | null;
      isActive: boolean;
    }) => {
      const existingCoupon = await couponRepository.findOne({ where: { code: data.code } });
      if (!existingCoupon) {
        await couponRepository.save(couponRepository.create({ ...data, usageCount: 0, startDate: null, endDate: null }));
        console.log(`✓ Coupon created: ${data.code}`);
        return;
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
      await couponRepository.save(existingCoupon);
      console.log(`~ Coupon updated: ${data.code}`);
    };

    await upsertCoupon({ code: 'WELCOME10', type: CouponType.PERCENTAGE, value: '10.00', currencyCode: 'USD', minOrderAmount: '50.00', maxUsage: 100, isActive: true });
    await upsertCoupon({ code: 'BULK15', type: CouponType.FIXED_AMOUNT, value: '15.00', currencyCode: 'USD', minOrderAmount: '120.00', maxUsage: null, isActive: true });

    const existingSeedCouponIds = (await couponRepository.find({ where: { code: In(SEED_COUPON_CODES) }, select: ['id'] })).map((coupon) => coupon.id);

    await notificationRepository.createQueryBuilder().delete().from(Notification).where("metadata ->> 'seedScope' = :seedScope", { seedScope: SEED_SCOPE }).execute();
    await inventoryRepository.createQueryBuilder().delete().from(InventoryMovement).where('reason LIKE :reasonPrefix', { reasonPrefix: `${SEED_REASON_PREFIX}%` }).execute();

    if (existingSeedCouponIds.length > 0) {
      await couponUsageRepository.createQueryBuilder().delete().from(CouponUsage).where('coupon_id IN (:...couponIds)', { couponIds: existingSeedCouponIds }).execute();
    }

    const existingSeedOrderIds = (await orderRepository.createQueryBuilder('order').select('order.id', 'id').where('order.notes LIKE :notePrefix', { notePrefix: `${SEED_NOTE_PREFIX}%` }).getRawMany<{ id: string }>()).map((order) => order.id);

    if (existingSeedOrderIds.length > 0) {
      await couponUsageRepository.createQueryBuilder().delete().from(CouponUsage).where('order_id IN (:...orderIds)', { orderIds: existingSeedOrderIds }).execute();
      await orderRepository.createQueryBuilder().delete().from(Order).where('id IN (:...orderIds)', { orderIds: existingSeedOrderIds }).execute();
    }

    const users = await userRepository.find({ where: { email: In(resolveSeedUserEmails()) } });
    const sizes = await sizeRepository.find({ where: { abbreviation: In(SEED_SIZE_ABBREVIATIONS) } });
    const colors = await colorRepository.find({ where: { name: In(SEED_COLOR_NAMES) } });
    const tags = await tagRepository.find({ where: { slug: In(SEED_TAG_SLUGS) } });
    const coupons = await couponRepository.find({ where: { code: In(SEED_COUPON_CODES) } });

    const usersByEmail = new Map(users.map((user) => [user.email, user]));
    const sizesByAbbreviation = new Map(sizes.map((size) => [size.abbreviation, size]));
    const colorsByName = new Map(colors.map((color) => [color.name, color]));
    const tagsBySlug = new Map(tags.map((tag) => [tag.slug, tag]));
    const couponsByCode = new Map(coupons.map((coupon) => [coupon.code, coupon]));

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
      coupon?: Coupon | null;
      couponLink?: string | null;
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
      const existing = await productRepository.findOne({ where: { sku: data.sku } });
      const target = existing ?? productRepository.create();
      target.name = data.name;
      target.sku = data.sku;
      target.slug = data.slug;
      target.description = data.description;
      target.basePrice = data.basePrice;
      target.currencyCode = data.currencyCode;
      target.stock = data.stock;
      target.category = data.category;
      target.tags = data.tags;
      target.coupon = data.coupon ?? null;
      target.couponLink = data.couponLink ?? null;
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

      const savedProduct = await productRepository.save(target);
      await productImageRepository.createQueryBuilder().delete().from(ProductImage).where('product_id = :productId', { productId: savedProduct.id }).execute();

      if (data.images?.length) {
        await productImageRepository.save(data.images.map((image) => productImageRepository.create({ product: savedProduct, url: image.url, altText: image.altText, displayOrder: image.displayOrder, isMain: image.isMain })));
      }

      console.log(`${existing ? '~' : '✓'} Product ${existing ? 'updated' : 'created'}: ${data.sku}`);
      return savedProduct;
    };

    const upsertVariant = async (data: {
      sku: string;
      product: Product;
      size: Size;
      color: Color;
      stock: number;
      additionalPrice: string;
    }) => {
      const existingVariant = await variantRepository.findOne({ where: { sku: data.sku } });
      const variant = existingVariant ?? variantRepository.create();
      variant.sku = data.sku;
      variant.product = data.product;
      variant.size = data.size;
      variant.color = data.color;
      variant.stock = data.stock;
      variant.additionalPrice = data.additionalPrice;
      variant.isActive = true;
      await variantRepository.save(variant);
      console.log(`${existingVariant ? '~' : '✓'} Variant ${existingVariant ? 'updated' : 'created'}: ${data.sku}`);
      return variant;
    };

    const poloProduct = await upsertProduct({
      name: 'Polo Pima Signature',
      sku: 'APP-POLO-PIMA',
      slug: 'polo-pima-signature',
      description: 'Polo premium para probar el flujo con variantes de talla y color.',
      basePrice: '79.90',
      currencyCode: 'USD',
      stock: 18,
      category: polosPremium,
      tags: [tagsBySlug.get('nuevo'), tagsBySlug.get('destacado')].filter(Boolean) as Tag[],
      attributeValues: [
        { key: 'material', label: 'Material', type: 'select', unit: null, value: 'Pima' },
        { key: 'fit', label: 'Fit', type: 'select', unit: null, value: 'Regular' },
      ],
      isFeatured: true,
      hasOffer: false,
      images: [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80', altText: 'Polo premium en percha', displayOrder: 1, isMain: true }],
    });

    const termoProduct = await upsertProduct({
      name: 'Termo Expedition 750 ml',
      sku: 'HOME-TERMO-750',
      slug: 'termo-expedition-750',
      description: 'Termo sin variantes con medidas, peso y atributos dinamicos.',
      basePrice: '34.50',
      currencyCode: 'USD',
      stock: 32,
      category: termosTermicos,
      tags: [tagsBySlug.get('destacado'), tagsBySlug.get('outdoor')].filter(Boolean) as Tag[],
      weightValue: '0.620',
      weightUnit: 'kg',
      lengthValue: '8.00',
      widthValue: '8.00',
      heightValue: '29.00',
      dimensionUnit: 'cm',
      attributeValues: [
        { key: 'capacity_ml', label: 'Capacidad', type: 'number', unit: 'ml', value: 750 },
        { key: 'thermal_hours', label: 'Retencion termica', type: 'number', unit: 'h', value: 12 },
        { key: 'material', label: 'Material', type: 'select', unit: null, value: 'Acero 304' },
        { key: 'dishwasher_safe', label: 'Apto lavavajillas', type: 'boolean', unit: null, value: true },
      ],
      isFeatured: true,
      hasOffer: true,
      offerPrice: '29.90',
      offerPercentage: '13.33',
      images: [{ url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80', altText: 'Termo metalico sobre mesa', displayOrder: 1, isMain: true }],
    });

    const cafeProduct = await upsertProduct({
      name: 'Cafe Geisha 1 kg',
      sku: 'FOOD-CAFE-GEISHA-1KG',
      slug: 'cafe-geisha-1kg',
      description: 'Producto sin variantes con atributos por origen, proceso y molienda.',
      basePrice: '28.00',
      currencyCode: 'USD',
      stock: 18,
      category: cafeEspecialidad,
      tags: [tagsBySlug.get('nuevo'), tagsBySlug.get('cafe-especialidad')].filter(Boolean) as Tag[],
      weightValue: '1.000',
      weightUnit: 'kg',
      attributeValues: [
        { key: 'origin', label: 'Origen', type: 'text', unit: null, value: 'Jaen, Peru' },
        { key: 'roast', label: 'Tueste', type: 'select', unit: null, value: 'Medio' },
        { key: 'process', label: 'Proceso', type: 'select', unit: null, value: 'Lavado' },
        { key: 'grind', label: 'Molienda', type: 'select', unit: null, value: 'Grano' },
      ],
      images: [{ url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80', altText: 'Cafe en grano servido en taza', displayOrder: 1, isMain: true }],
    });

    const poloBlackM = await upsertVariant({ sku: 'APP-POLO-PIMA-BLK-M', product: poloProduct, size: sizesByAbbreviation.get('M') as Size, color: colorsByName.get('Black') as Color, stock: 8, additionalPrice: '0.00' });
    const poloBlackL = await upsertVariant({ sku: 'APP-POLO-PIMA-BLK-L', product: poloProduct, size: sizesByAbbreviation.get('L') as Size, color: colorsByName.get('Black') as Color, stock: 6, additionalPrice: '2.00' });
    const poloWhiteM = await upsertVariant({ sku: 'APP-POLO-PIMA-WHT-M', product: poloProduct, size: sizesByAbbreviation.get('M') as Size, color: colorsByName.get('White') as Color, stock: 4, additionalPrice: '0.00' });

    const seedAdmin = usersByEmail.get(adminEmail) as User;
    const customer1 = usersByEmail.get('customer1@local.dev') as User;
    const customer2 = usersByEmail.get('customer2@local.dev') as User;
    const customer3 = usersByEmail.get('customer3@local.dev') as User;
    const welcomeCoupon = couponsByCode.get('WELCOME10') ?? null;

    await inventoryRepository.save([
      inventoryRepository.create({ product: poloProduct, variant: poloBlackM, quantityChange: 10, type: InventoryMovementType.PURCHASE, reason: `${SEED_REASON_PREFIX} ingreso inicial APP-POLO-PIMA-BLK-M`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: poloProduct, variant: poloBlackL, quantityChange: 7, type: InventoryMovementType.PURCHASE, reason: `${SEED_REASON_PREFIX} ingreso inicial APP-POLO-PIMA-BLK-L`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: poloProduct, variant: poloWhiteM, quantityChange: 4, type: InventoryMovementType.PURCHASE, reason: `${SEED_REASON_PREFIX} ingreso inicial APP-POLO-PIMA-WHT-M`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: poloProduct, variant: poloBlackM, quantityChange: -2, type: InventoryMovementType.SALE, reason: `${SEED_REASON_PREFIX} venta confirmada APP-POLO-PIMA-BLK-M`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: poloProduct, variant: poloBlackL, quantityChange: -1, type: InventoryMovementType.SALE, reason: `${SEED_REASON_PREFIX} venta confirmada APP-POLO-PIMA-BLK-L`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: termoProduct, variant: null, quantityChange: 35, type: InventoryMovementType.PURCHASE, reason: `${SEED_REASON_PREFIX} ingreso inicial HOME-TERMO-750`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: termoProduct, variant: null, quantityChange: -3, type: InventoryMovementType.ADJUSTMENT, reason: `${SEED_REASON_PREFIX} ajuste por muestra HOME-TERMO-750`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: cafeProduct, variant: null, quantityChange: 20, type: InventoryMovementType.PURCHASE, reason: `${SEED_REASON_PREFIX} ingreso inicial FOOD-CAFE-GEISHA-1KG`, createdBy: seedAdmin }),
      inventoryRepository.create({ product: cafeProduct, variant: null, quantityChange: -2, type: InventoryMovementType.SALE, reason: `${SEED_REASON_PREFIX} venta entregada FOOD-CAFE-GEISHA-1KG`, createdBy: seedAdmin }),
    ]);

    const confirmedVariantOrder = orderRepository.create({
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

    confirmedVariantOrder.items[0].product = poloProduct;
    confirmedVariantOrder.items[0].variant = poloBlackM;
    confirmedVariantOrder.items[0].snapshotProductName = poloProduct.name;
    confirmedVariantOrder.items[0].snapshotSku = poloBlackM.sku;
    confirmedVariantOrder.items[0].snapshotDescriptor = 'Medium / Black';
    confirmedVariantOrder.items[0].quantity = 2;
    confirmedVariantOrder.items[0].unitPrice = '79.90';
    confirmedVariantOrder.items[0].subtotal = '159.80';
    confirmedVariantOrder.items[1].product = poloProduct;
    confirmedVariantOrder.items[1].variant = poloBlackL;
    confirmedVariantOrder.items[1].snapshotProductName = poloProduct.name;
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

    const pendingMixedOrder = orderRepository.create({
      user: customer2,
      status: OrderStatus.PENDING,
      subtotal: '97.00',
      discount: '9.70',
      total: '87.30',
      currencyCode: 'USD',
      exchangeRateToUsd: '1.000000',
      coupon: welcomeCoupon,
      notes: `${SEED_NOTE_PREFIX} orden producto pendiente`,
      items: [new OrderItem(), new OrderItem()],
      shippingAddresses: [new ShippingAddress()],
    });

    pendingMixedOrder.items[0].product = termoProduct;
    pendingMixedOrder.items[0].variant = null;
    pendingMixedOrder.items[0].snapshotProductName = termoProduct.name;
    pendingMixedOrder.items[0].snapshotSku = termoProduct.sku;
    pendingMixedOrder.items[0].snapshotDescriptor = '750 ml';
    pendingMixedOrder.items[0].quantity = 2;
    pendingMixedOrder.items[0].unitPrice = '34.50';
    pendingMixedOrder.items[0].subtotal = '69.00';
    pendingMixedOrder.items[1].product = cafeProduct;
    pendingMixedOrder.items[1].variant = null;
    pendingMixedOrder.items[1].snapshotProductName = cafeProduct.name;
    pendingMixedOrder.items[1].snapshotSku = cafeProduct.sku;
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

    const deliveredCoffeeOrder = orderRepository.create({
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

    deliveredCoffeeOrder.items[0].product = cafeProduct;
    deliveredCoffeeOrder.items[0].variant = null;
    deliveredCoffeeOrder.items[0].snapshotProductName = cafeProduct.name;
    deliveredCoffeeOrder.items[0].snapshotSku = cafeProduct.sku;
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

    const savedConfirmedOrder = await orderRepository.save(confirmedVariantOrder);
    const savedPendingOrder = await orderRepository.save(pendingMixedOrder);
    await orderRepository.save(deliveredCoffeeOrder);

    if (welcomeCoupon) {
      welcomeCoupon.usageCount = 1;
      await couponRepository.save(welcomeCoupon);
      await couponUsageRepository.save(couponUsageRepository.create({ coupon: welcomeCoupon, user: customer2, order: savedPendingOrder }));
    }

    const backofficeUsers = users.filter((user) => [Role.SUPER_ADMIN, Role.ADMIN, Role.BOSS, Role.MARKETING, Role.SALES].includes(user.role));
    const notifications = backofficeUsers.flatMap((recipient) => [
      notificationRepository.create({ recipientUser: recipient, actorUser: customer3, type: NotificationType.USER_REGISTERED, title: 'Nuevo usuario registrado', message: `${customer3.firstName} ${customer3.lastName} se registro con el email ${customer3.email}.`, link: '/users', metadata: { seedScope: SEED_SCOPE, seedKey: 'customer-registration', userId: customer3.id }, isRead: false, readAt: null }),
      notificationRepository.create({ recipientUser: recipient, actorUser: customer1, type: NotificationType.ORDER_CREATED, title: 'Nueva compra registrada', message: `Ana Cliente genero la orden #${savedConfirmedOrder.id.slice(0, 8).toUpperCase()} por ${money(241.7)} USD.`, link: `/orders/${savedConfirmedOrder.id}`, metadata: { seedScope: SEED_SCOPE, seedKey: 'order-created', orderId: savedConfirmedOrder.id }, isRead: false, readAt: null }),
      notificationRepository.create({ recipientUser: recipient, actorUser: seedAdmin, type: NotificationType.ORDER_STATUS_CHANGED, title: 'Cambio de estado de orden', message: `La orden #${savedConfirmedOrder.id.slice(0, 8).toUpperCase()} cambio de PENDING a CONFIRMED.`, link: `/orders/${savedConfirmedOrder.id}`, metadata: { seedScope: SEED_SCOPE, seedKey: 'order-status-changed', orderId: savedConfirmedOrder.id, previousStatus: OrderStatus.PENDING, status: OrderStatus.CONFIRMED }, isRead: true, readAt: new Date() }),
    ]);

    await notificationRepository.save(notifications);

    console.log('\nResumen del seed multi-rubro:');
    console.log(`- Scope: ${SEED_SCOPE}`);
    console.log(`- Categorias base actualizadas: ${SEED_CATEGORY_SLUGS.length}`);
    console.log(`- Productos demo: ${SEED_PRODUCT_SKUS.length}`);
    console.log(`- Variantes demo: ${SEED_VARIANT_SKUS.length}`);
    console.log(`- Tags demo: ${SEED_TAG_SLUGS.length}`);
    console.log(`- Cupones demo: ${SEED_COUPON_CODES.length}`);
    console.log('- Ordenes demo: 3');
    console.log(`- Notificaciones demo: ${notifications.length}`);
    console.log('\nCredenciales de acceso por defecto:');
    console.log(`- SUPER_ADMIN: ${superAdminRawPassword} (emails: ${superAdminEmail}, superadmin2@local.dev)`);
    console.log(`- ADMIN: ${adminRawPassword} (emails: ${adminEmail}, admin2@local.dev, admin3@local.dev)`);
    console.log(`- CUSTOMER: ${customerPassword} (emails: customer1@local.dev, customer2@local.dev, customer3@local.dev)`);
    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

void seed();
