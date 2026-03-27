import { In } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { Category } from '../src/categories/entities/category.entity';
import { Color } from '../src/colors/entities/color.entity';
import { Coupon } from '../src/coupons/entities/coupon.entity';
import { CouponUsage } from '../src/coupons/entities/coupon-usage.entity';
import { InventoryMovement } from '../src/inventory/entities/inventory-movement.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { Order } from '../src/orders/entities/order.entity';
import { Product } from '../src/products/entities/product.entity';
import { ProductVariant } from '../src/products/entities/product-variant.entity';
import { Size } from '../src/sizes/entities/size.entity';
import { Tag } from '../src/tags/entities/tag.entity';
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

type CleanMode = 'seed' | 'users-all' | 'all';

function resolveCleanMode(): CleanMode {
  if (process.argv.includes('--seed')) {
    return 'seed';
  }

  if (process.argv.includes('--all')) {
    return 'all';
  }

  if (process.argv.includes('--users-all')) {
    return 'users-all';
  }

  return 'all';
}

async function cleanSeed() {
  const startedAt = new Date();
  const startTimeMs = Date.now();

  try {
    await AppDataSource.initialize();
    console.log('✓ Database connected');

    const mode = resolveCleanMode();
    const forceMode = process.argv.includes('--force') || process.env.SEED_CLEAN_FORCE === 'true';

    if (mode === 'all') {
      const tables: Array<{ tablename: string }> = await AppDataSource.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'migrations'
      `);

      const tableNames = tables.map((table) => table.tablename);
      if (tableNames.length > 0) {
        const quotedTables = tableNames.map((tableName) => `"public"."${tableName}"`).join(', ');
        await AppDataSource.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
      }

      const finishedAt = new Date();
      const durationMs = Date.now() - startTimeMs;
      console.log('\n🧹 Database cleanup summary:');
      console.log(`- Mode: ${mode}`);
      console.log(`- Started at: ${startedAt.toISOString()}`);
      console.log(`- Finished at: ${finishedAt.toISOString()}`);
      console.log(`- Duration (ms): ${durationMs}`);
      console.log(`- Tables truncated: ${tableNames.length}`);
      console.log('- Skipped tables: migrations');
      console.log('\n✅ Database cleanup completed');
      process.exit(0);
    }

    if (mode === 'users-all') {
      const userTableName = AppDataSource.getRepository(User).metadata.tableName;
      await AppDataSource.query(`TRUNCATE TABLE "public"."${userTableName}" RESTART IDENTITY CASCADE`);

      const finishedAt = new Date();
      const durationMs = Date.now() - startTimeMs;
      console.log('\n🧹 Database cleanup summary:');
      console.log(`- Mode: ${mode}`);
      console.log(`- Started at: ${startedAt.toISOString()}`);
      console.log(`- Finished at: ${finishedAt.toISOString()}`);
      console.log(`- Duration (ms): ${durationMs}`);
      console.log('- Users table truncated with CASCADE');
      console.log('\n✅ Database cleanup completed');
      process.exit(0);
    }

    const userRepository = AppDataSource.getRepository(User);
    const sizeRepository = AppDataSource.getRepository(Size);
    const colorRepository = AppDataSource.getRepository(Color);
    const categoryRepository = AppDataSource.getRepository(Category);
    const productRepository = AppDataSource.getRepository(Product);
    const variantRepository = AppDataSource.getRepository(ProductVariant);
    const tagRepository = AppDataSource.getRepository(Tag);
    const couponRepository = AppDataSource.getRepository(Coupon);
    const couponUsageRepository = AppDataSource.getRepository(CouponUsage);
    const orderRepository = AppDataSource.getRepository(Order);
    const inventoryRepository = AppDataSource.getRepository(InventoryMovement);
    const notificationRepository = AppDataSource.getRepository(Notification);

    const seedUsers = await userRepository.find({ where: { email: In(resolveSeedUserEmails()) } });
    const seedProducts = await productRepository.find({ where: { sku: In(SEED_PRODUCT_SKUS) } });
    const seedVariants = await variantRepository.find({ where: { sku: In(SEED_VARIANT_SKUS) } });
    const seedCoupons = await couponRepository.find({ where: { code: In(SEED_COUPON_CODES) } });
    const seedTags = await tagRepository.find({ where: { slug: In(SEED_TAG_SLUGS) } });
    const sizesToDelete = await sizeRepository.find({ where: { abbreviation: In(SEED_SIZE_ABBREVIATIONS) } });
    const colorsToDelete = await colorRepository.find({ where: { name: In(SEED_COLOR_NAMES) } });

    const seedUserIds = seedUsers.map((user) => user.id);
    const seedProductIds = seedProducts.map((product) => product.id);
    const seedVariantIds = seedVariants.map((variant) => variant.id);
    const seedCouponIds = seedCoupons.map((coupon) => coupon.id);
    const seedTagIds = seedTags.map((tag) => tag.id);
    const seedSizeIds = sizesToDelete.map((size) => size.id);
    const seedColorIds = colorsToDelete.map((color) => color.id);

    await notificationRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where("metadata ->> 'seedScope' = :seedScope", { seedScope: SEED_SCOPE })
      .execute();

    await inventoryRepository
      .createQueryBuilder()
      .delete()
      .from(InventoryMovement)
      .where('reason LIKE :reasonPrefix', { reasonPrefix: `${SEED_REASON_PREFIX}%` })
      .execute();

    const seedOrderIds = (
      await orderRepository
        .createQueryBuilder('order')
        .select('order.id', 'id')
        .where('order.notes LIKE :notePrefix', { notePrefix: `${SEED_NOTE_PREFIX}%` })
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);

    if (seedOrderIds.length > 0) {
      await couponUsageRepository
        .createQueryBuilder()
        .delete()
        .from(CouponUsage)
        .where('order_id IN (:...orderIds)', { orderIds: seedOrderIds })
        .execute();

      await orderRepository
        .createQueryBuilder()
        .delete()
        .from(Order)
        .where('id IN (:...orderIds)', { orderIds: seedOrderIds })
        .execute();
    }

    if (seedCouponIds.length > 0) {
      await couponUsageRepository
        .createQueryBuilder()
        .delete()
        .from(CouponUsage)
        .where('coupon_id IN (:...couponIds)', { couponIds: seedCouponIds })
        .execute();
    }

    const blockedExternalOrderItems =
      seedProductIds.length > 0 || seedVariantIds.length > 0
        ? await AppDataSource.query(
            `
              SELECT COUNT(*)::int AS count
              FROM order_items oi
              LEFT JOIN orders o ON o.id = oi.order_id
              WHERE (
                ($1::uuid[] <> '{}'::uuid[] AND oi.product_id = ANY($1))
                OR ($2::uuid[] <> '{}'::uuid[] AND oi.variant_id = ANY($2))
              )
                AND (o.id IS NULL OR o.notes NOT LIKE $3)
            `,
            [seedProductIds, seedVariantIds, `${SEED_NOTE_PREFIX}%`],
          )
        : [{ count: 0 }];

    const blockedExternalInventory =
      seedProductIds.length > 0 || seedVariantIds.length > 0
        ? await AppDataSource.query(
            `
              SELECT COUNT(*)::int AS count
              FROM inventory_movements im
              WHERE (
                ($1::uuid[] <> '{}'::uuid[] AND im.product_id = ANY($1))
                OR ($2::uuid[] <> '{}'::uuid[] AND im.variant_id = ANY($2))
              )
                AND (im.reason IS NULL OR im.reason NOT LIKE $3)
            `,
            [seedProductIds, seedVariantIds, `${SEED_REASON_PREFIX}%`],
          )
        : [{ count: 0 }];

    const blockedCouponOrders =
      seedCouponIds.length > 0
        ? await AppDataSource.query(
            `
              SELECT COUNT(*)::int AS count
              FROM orders
              WHERE coupon_id = ANY($1)
                AND notes NOT LIKE $2
            `,
            [seedCouponIds, `${SEED_NOTE_PREFIX}%`],
          )
        : [{ count: 0 }];

    const blockedUserOrders =
      seedUserIds.length > 0
        ? await AppDataSource.query(
            `
              SELECT COUNT(*)::int AS count
              FROM orders
              WHERE user_id = ANY($1)
                AND notes NOT LIKE $2
            `,
            [seedUserIds, `${SEED_NOTE_PREFIX}%`],
          )
        : [{ count: 0 }];

    const blockedExternalOrderItemsCount = Number(blockedExternalOrderItems[0]?.count ?? 0);
    const blockedExternalInventoryCount = Number(blockedExternalInventory[0]?.count ?? 0);
    const blockedCouponOrdersCount = Number(blockedCouponOrders[0]?.count ?? 0);
    const blockedUserOrdersCount = Number(blockedUserOrders[0]?.count ?? 0);

    let forceDeletedOrderItems = 0;
    let forceDeletedInventoryMovements = 0;
    let deletedProducts = 0;
    let deletedCoupons = 0;
    let deletedTags = 0;
    let deletedCategories = 0;

    if (forceMode && (seedProductIds.length > 0 || seedVariantIds.length > 0)) {
      const deletedOrderItems = await AppDataSource.query(
        `
          DELETE FROM order_items
          WHERE ($1::uuid[] <> '{}'::uuid[] AND product_id = ANY($1))
             OR ($2::uuid[] <> '{}'::uuid[] AND variant_id = ANY($2))
          RETURNING id
        `,
        [seedProductIds, seedVariantIds],
      );
      forceDeletedOrderItems = deletedOrderItems.length;

      const deletedInventory = await AppDataSource.query(
        `
          DELETE FROM inventory_movements
          WHERE ($1::uuid[] <> '{}'::uuid[] AND product_id = ANY($1))
             OR ($2::uuid[] <> '{}'::uuid[] AND variant_id = ANY($2))
          RETURNING id
        `,
        [seedProductIds, seedVariantIds],
      );
      forceDeletedInventoryMovements = deletedInventory.length;
    }

    const canDeleteProducts =
      seedProducts.length > 0 &&
      (forceMode || (blockedExternalOrderItemsCount === 0 && blockedExternalInventoryCount === 0));

    if (canDeleteProducts) {
      await AppDataSource.query(`DELETE FROM product_tags WHERE product_id = ANY($1)`, [seedProductIds]);
      await productRepository.remove(seedProducts);
      deletedProducts = seedProducts.length;
    }

    if (seedCoupons.length > 0 && (forceMode || blockedCouponOrdersCount === 0)) {
      await couponRepository.remove(seedCoupons);
      deletedCoupons = seedCoupons.length;
    }

    if (seedTagIds.length > 0) {
      const tagLinks = await AppDataSource.query(
        `SELECT COUNT(*)::int AS count FROM product_tags WHERE tag_id = ANY($1)`,
        [seedTagIds],
      );
      const blockedTagLinksCount = Number(tagLinks[0]?.count ?? 0);

      if (blockedTagLinksCount === 0) {
        await tagRepository.remove(seedTags);
        deletedTags = seedTags.length;
      }
    }

    for (const slug of SEED_CATEGORY_SLUGS) {
      const category = await categoryRepository.findOne({ where: { slug } });
      if (!category) {
        continue;
      }

      const blockingProducts = await productRepository.count({
        where: { category: { id: category.id } },
      });

      if (blockingProducts === 0) {
        await categoryRepository.remove(category);
        deletedCategories += 1;
      }
    }

    let blockedSizeCount = 0;
    if (seedSizeIds.length > 0) {
      blockedSizeCount = await variantRepository
        .createQueryBuilder('variant')
        .where('variant.size_id IN (:...sizeIds)', { sizeIds: seedSizeIds })
        .getCount();
    }

    let deletedSizes = 0;
    if (sizesToDelete.length > 0 && blockedSizeCount === 0) {
      await sizeRepository.remove(sizesToDelete);
      deletedSizes = sizesToDelete.length;
    }

    let blockedColorCount = 0;
    if (seedColorIds.length > 0) {
      blockedColorCount = await variantRepository
        .createQueryBuilder('variant')
        .where('variant.color_id IN (:...colorIds)', { colorIds: seedColorIds })
        .getCount();
    }

    let deletedColors = 0;
    if (colorsToDelete.length > 0 && blockedColorCount === 0) {
      await colorRepository.remove(colorsToDelete);
      deletedColors = colorsToDelete.length;
    }

    let deletedUsers = 0;
    if (seedUsers.length > 0 && (forceMode || blockedUserOrdersCount === 0)) {
      await userRepository.remove(seedUsers);
      deletedUsers = seedUsers.length;
    }

    console.log('\n🧹 Seed cleanup summary:');
    console.log(`- Scope: ${SEED_SCOPE}`);
    console.log(`- Mode: ${forceMode ? 'seed-force' : 'seed-safe'}`);
    console.log(`- Seed orders deleted: ${seedOrderIds.length}`);
    console.log(`- Force deleted order items: ${forceDeletedOrderItems}`);
    console.log(`- Force deleted inventory movements: ${forceDeletedInventoryMovements}`);
    console.log(`- Products deleted: ${deletedProducts}`);
    console.log(`- Coupons deleted: ${deletedCoupons}`);
    console.log(`- Tags deleted: ${deletedTags}`);
    console.log(`- Categories deleted: ${deletedCategories}`);
    console.log(`- Sizes deleted: ${deletedSizes}`);
    console.log(`- Colors deleted: ${deletedColors}`);
    console.log(`- Users deleted: ${deletedUsers}`);

    if (!forceMode && blockedExternalOrderItemsCount > 0) {
      console.log(`- Seed products kept: dependencies in ${blockedExternalOrderItemsCount} non-seed order items`);
    }

    if (!forceMode && blockedExternalInventoryCount > 0) {
      console.log(`- Seed products kept: dependencies in ${blockedExternalInventoryCount} non-seed inventory movements`);
    }

    if (!forceMode && blockedCouponOrdersCount > 0) {
      console.log(`- Seed coupons kept: referenced by ${blockedCouponOrdersCount} non-seed orders`);
    }

    if (!forceMode && blockedUserOrdersCount > 0) {
      console.log(`- Seed users kept: referenced by ${blockedUserOrdersCount} non-seed orders`);
    }

    if (blockedSizeCount > 0) {
      console.log(`- Sizes not deleted: ${sizesToDelete.length} (in use by ${blockedSizeCount} product variants)`);
    }

    if (blockedColorCount > 0) {
      console.log(`- Colors not deleted: ${colorsToDelete.length} (in use by ${blockedColorCount} product variants)`);
    }

    if (!forceMode && (blockedExternalOrderItemsCount > 0 || blockedExternalInventoryCount > 0)) {
      console.log('- Tip: run with --force to remove remaining dependencies linked to seeded products.');
    }

    const finishedAt = new Date();
    const durationMs = Date.now() - startTimeMs;
    console.log(`- Started at: ${startedAt.toISOString()}`);
    console.log(`- Finished at: ${finishedAt.toISOString()}`);
    console.log(`- Duration (ms): ${durationMs}`);
    console.log('\n✅ Seed cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed cleanup failed:', error);
    process.exit(1);
  }
}

void cleanSeed();
