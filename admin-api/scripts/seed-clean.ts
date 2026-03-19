import { In } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/users/entities/user.entity';
import { Size } from '../src/sizes/entities/size.entity';
import { Color } from '../src/colors/entities/color.entity';
import { ProductVariant } from '../src/products/entities/product-variant.entity';

type CleanMode = 'seed' | 'users-all' | 'all';

function resolveCleanMode(): CleanMode {
  if (process.argv.includes('--all')) {
    return 'all';
  }

  if (process.argv.includes('--users-all')) {
    return 'users-all';
  }

  return 'seed';
}

async function cleanSeed() {
  try {
    await AppDataSource.initialize();
    console.log('✓ Database connected');

    const mode = resolveCleanMode();
    const forceMode =
      process.argv.includes('--force') || process.env.SEED_CLEAN_FORCE === 'true';

    if (mode === 'all') {
      const tables: Array<{ tablename: string }> = await AppDataSource.query(
        `
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename <> 'migrations'
        `,
      );

      const tableNames = tables.map((table) => table.tablename);
      if (tableNames.length === 0) {
        console.log('ℹ No public tables found to truncate');
      } else {
        const quotedTables = tableNames
          .map((tableName) => `"public"."${tableName}"`)
          .join(', ');
        await AppDataSource.query(
          `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
        );
      }

      console.log('\n🧹 Database cleanup summary:');
      console.log(`- Mode: ${mode}`);
      console.log(`- Tables truncated: ${tableNames.length}`);
      console.log('\n✅ Database cleanup completed');
      process.exit(0);
    }

    if (mode === 'users-all') {
      const userTableName = AppDataSource.getRepository(User).metadata.tableName;
      await AppDataSource.query(
        `TRUNCATE TABLE "public"."${userTableName}" RESTART IDENTITY CASCADE`,
      );

      console.log('\n🧹 Database cleanup summary:');
      console.log(`- Mode: ${mode}`);
      console.log('- Users table truncated with CASCADE');
      console.log('\n✅ Database cleanup completed');
      process.exit(0);
    }

    const seedUserEmails = [
      process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@local.dev',
      'superadmin2@local.dev',
      process.env.SEED_ADMIN_EMAIL ?? 'admin@local.dev',
      'admin2@local.dev',
      'admin3@local.dev',
      'customer1@local.dev',
      'customer2@local.dev',
      'customer3@local.dev',
    ];

    const seedSizeAbbreviations = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const seedColorNames = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Gray', 'Navy'];

    const userRepository = AppDataSource.getRepository(User);
    const sizeRepository = AppDataSource.getRepository(Size);
    const colorRepository = AppDataSource.getRepository(Color);
    const variantRepository = AppDataSource.getRepository(ProductVariant);

    const usersToDelete = await userRepository.find({
      where: { email: In(seedUserEmails) },
    });

    let deletedUsers = 0;
    if (usersToDelete.length > 0) {
      await userRepository.remove(usersToDelete);
      deletedUsers = usersToDelete.length;
    }

    const sizesToDelete = await sizeRepository.find({
      where: { abbreviation: In(seedSizeAbbreviations) },
    });

    const seedSizeIds = sizesToDelete.map((size) => size.id);
    const colorsToDelete = await colorRepository.find({
      where: { name: In(seedColorNames) },
    });

    const seedColorIds = colorsToDelete.map((color) => color.id);

    let forceDeletedVariants = 0;
    let forceDeletedOrderItems = 0;
    let forceDeletedInventoryMovements = 0;

    const variantIdsToDelete =
      seedSizeIds.length > 0 || seedColorIds.length > 0
        ? (
            await variantRepository
              .createQueryBuilder('variant')
              .select('variant.id', 'id')
              .where(
                seedSizeIds.length > 0
                  ? 'variant.size_id IN (:...sizeIds)'
                  : '1=0',
                { sizeIds: seedSizeIds },
              )
              .orWhere(
                seedColorIds.length > 0
                  ? 'variant.color_id IN (:...colorIds)'
                  : '1=0',
                { colorIds: seedColorIds },
              )
              .getRawMany<{ id: string }>()
          ).map((row) => row.id)
        : [];

    if (forceMode && variantIdsToDelete.length > 0) {
      await AppDataSource.transaction(async (manager) => {
        const deleteOrderItemsResult = await manager
          .createQueryBuilder()
          .delete()
          .from('order_items')
          .where('variant_id IN (:...variantIds)', { variantIds: variantIdsToDelete })
          .execute();
        forceDeletedOrderItems = deleteOrderItemsResult.affected ?? 0;

        const deleteInventoryMovementsResult = await manager
          .createQueryBuilder()
          .delete()
          .from('inventory_movements')
          .where('variant_id IN (:...variantIds)', { variantIds: variantIdsToDelete })
          .execute();
        forceDeletedInventoryMovements = deleteInventoryMovementsResult.affected ?? 0;

        const deleteVariantsResult = await manager
          .createQueryBuilder()
          .delete()
          .from(ProductVariant)
          .where('id IN (:...variantIds)', { variantIds: variantIdsToDelete })
          .execute();
        forceDeletedVariants = deleteVariantsResult.affected ?? 0;
      });
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

    console.log('\n🧹 Seed cleanup summary:');
    console.log(`- Mode: ${forceMode ? 'seed-force' : 'seed-safe'}`);
    console.log(`- Users deleted: ${deletedUsers}`);
    console.log(`- Variants deleted: ${forceDeletedVariants}`);
    console.log(`- Inventory movements deleted: ${forceDeletedInventoryMovements}`);
    console.log(`- Order items deleted: ${forceDeletedOrderItems}`);
    console.log(`- Sizes deleted: ${deletedSizes}`);
    console.log(`- Colors deleted: ${deletedColors}`);

    if (blockedSizeCount > 0) {
      console.log(
        `- Sizes not deleted: ${sizesToDelete.length} (in use by ${blockedSizeCount} product variants)`,
      );
    }

    if (blockedColorCount > 0) {
      console.log(
        `- Colors not deleted: ${colorsToDelete.length} (in use by ${blockedColorCount} product variants)`,
      );
    }

    if (!forceMode && variantIdsToDelete.length > 0) {
      console.log(
        '- Tip: run with --force (or npm run seed:clean:force) to remove blocking variants and dependencies.',
      );
    }

    console.log('\n✅ Seed cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed cleanup failed:', error);
    process.exit(1);
  }
}

cleanSeed();
