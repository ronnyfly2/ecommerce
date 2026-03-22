import { AppDataSource } from '../src/data-source';
import { User } from '../src/users/entities/user.entity';
import { Size } from '../src/sizes/entities/size.entity';
import { Color } from '../src/colors/entities/color.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Role } from '../src/common/enums/role.enum';
import * as bcrypt from 'bcrypt';

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('✓ Database connected');

    const superAdminEmail =
      process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@local.dev';
    const superAdminRawPassword =
      process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin2026!';
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@local.dev';
    const adminRawPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin2026!';
    const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer2026!';

    const userRepository = AppDataSource.getRepository(User);
    const sizeRepository = AppDataSource.getRepository(Size);
    const colorRepository = AppDataSource.getRepository(Color);

    // Seed Users (upsert with password reset for deterministic local access)
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
        return;
      }

      existingUser.passwordHash = passwordHash;
      existingUser.firstName = params.firstName;
      existingUser.lastName = params.lastName;
      existingUser.role = params.role;
      existingUser.isActive = true;
      await userRepository.save(existingUser);
      console.log(`✓ ${params.label} updated`);
    };

    const seedUsers = [
      {
        email: superAdminEmail,
        rawPassword: superAdminRawPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: Role.SUPER_ADMIN,
        label: 'SUPER_ADMIN',
      },
      {
        email: 'superadmin2@local.dev',
        rawPassword: superAdminRawPassword,
        firstName: 'Platform',
        lastName: 'Owner',
        role: Role.SUPER_ADMIN,
        label: 'SUPER_ADMIN',
      },
      {
        email: adminEmail,
        rawPassword: adminRawPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
        label: 'ADMIN',
      },
      {
        email: 'admin2@local.dev',
        rawPassword: adminRawPassword,
        firstName: 'Store',
        lastName: 'Manager',
        role: Role.ADMIN,
        label: 'ADMIN',
      },
      {
        email: 'admin3@local.dev',
        rawPassword: adminRawPassword,
        firstName: 'Ops',
        lastName: 'Manager',
        role: Role.ADMIN,
        label: 'ADMIN',
      },
      {
        email: 'boss@local.dev',
        rawPassword: adminRawPassword,
        firstName: 'Boss',
        lastName: 'User',
        role: Role.BOSS,
        label: 'BOSS',
      },
      {
        email: 'marketing@local.dev',
        rawPassword: adminRawPassword,
        firstName: 'Marketing',
        lastName: 'Lead',
        role: Role.MARKETING,
        label: 'MARKETING',
      },
      {
        email: 'sales@local.dev',
        rawPassword: adminRawPassword,
        firstName: 'Sales',
        lastName: 'Lead',
        role: Role.SALES,
        label: 'SALES',
      },
      {
        email: 'customer1@local.dev',
        rawPassword: customerPassword,
        firstName: 'Ana',
        lastName: 'Cliente',
        role: Role.CUSTOMER,
        label: 'CUSTOMER',
      },
      {
        email: 'customer2@local.dev',
        rawPassword: customerPassword,
        firstName: 'Luis',
        lastName: 'Cliente',
        role: Role.CUSTOMER,
        label: 'CUSTOMER',
      },
      {
        email: 'customer3@local.dev',
        rawPassword: customerPassword,
        firstName: 'Carla',
        lastName: 'Cliente',
        role: Role.CUSTOMER,
        label: 'CUSTOMER',
      },
    ];

    for (const seedUser of seedUsers) {
      await upsertSeedUser(seedUser);
    }

    // Seed Sizes
    const sizeNames = [
      { name: 'Extra Small', abbreviation: 'XS', displayOrder: 1 },
      { name: 'Small', abbreviation: 'S', displayOrder: 2 },
      { name: 'Medium', abbreviation: 'M', displayOrder: 3 },
      { name: 'Large', abbreviation: 'L', displayOrder: 4 },
      { name: 'Extra Large', abbreviation: 'XL', displayOrder: 5 },
      { name: 'XXL', abbreviation: 'XXL', displayOrder: 6 },
    ];

    for (const sizeData of sizeNames) {
      const existingSize = await sizeRepository.findOne({
        where: { abbreviation: sizeData.abbreviation },
      });

      if (!existingSize) {
        const size = sizeRepository.create(sizeData);
        await sizeRepository.save(size);
        console.log(`✓ Size created: ${sizeData.name} (${sizeData.abbreviation})`);
      }
    }

    // Seed Colors
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
      const existingColor = await colorRepository.findOne({
        where: { name: color.name },
      });

      if (!existingColor) {
        const newColor = colorRepository.create(color);
        await colorRepository.save(newColor);
        console.log(`✓ Color created: ${color.name} (${color.hexCode})`);
      }
    }

    // Seed Categories
    const categoryRepository = AppDataSource.getRepository(Category);

    const upsertCategory = async (data: {
      name: string;
      slug: string;
      description?: string;
      displayOrder: number;
      parent?: Category | null;
    }): Promise<Category> => {
      const existing = await categoryRepository.findOne({ where: { slug: data.slug } });
      if (existing) {
        existing.name = data.name;
        existing.displayOrder = data.displayOrder;
        if (data.description !== undefined) existing.description = data.description ?? null;
        if (data.parent !== undefined) existing.parent = data.parent ?? null;
        await categoryRepository.save(existing);
        console.log(`~ Category updated: ${data.name}`);
        return existing;
      }
      const category = categoryRepository.create({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        displayOrder: data.displayOrder,
        parent: data.parent ?? null,
        isActive: true,
      });
      await categoryRepository.save(category);
      console.log(`✓ Category created: ${data.name}`);
      return category;
    };

    // ─── L1: Polos / T-shirts ───────────────────────────────────────────────
    const polos = await upsertCategory({
      name: 'Polos / T-shirts',
      slug: 'polos-t-shirts',
      description: 'Polos y camisetas de algodón en distintos tipos de cuello y material',
      displayOrder: 1,
    });

    // ─── L2: Collar types ────────────────────────────────────────────────────
    const cuelloCircular = await upsertCategory({
      name: 'Cuello Circular',
      slug: 'polos-cuello-circular',
      displayOrder: 1,
      parent: polos,
    });

    const cuelloV = await upsertCategory({
      name: 'Cuello V',
      slug: 'polos-cuello-v',
      displayOrder: 2,
      parent: polos,
    });

    const cuelloPolo = await upsertCategory({
      name: 'Cuello Polo',
      slug: 'polos-cuello-polo',
      displayOrder: 3,
      parent: polos,
    });

    // ─── L3: Thread/fabric types (per collar) ────────────────────────────────
    const threadTypes = [
      { name: 'Jersey 20/1', slug: 'jersey-20-1', displayOrder: 1 },
      { name: 'Jersey 30/1', slug: 'jersey-30-1', displayOrder: 2 },
      { name: 'HIGH COTTON 14/1', slug: 'high-cotton-14-1', displayOrder: 3 },
      { name: 'Pima 40/1', slug: 'pima-40-1', displayOrder: 4 },
      { name: 'Cotton 32/1', slug: 'cotton-32-1', displayOrder: 5 },
    ];

    const collarParents: Array<{ category: Category; prefix: string }> = [
      { category: cuelloCircular, prefix: 'cuello-circular' },
      { category: cuelloV, prefix: 'cuello-v' },
      { category: cuelloPolo, prefix: 'cuello-polo' },
    ];

    for (const { category: collar, prefix } of collarParents) {
      for (const thread of threadTypes) {
        await upsertCategory({
          name: `${thread.name} – ${collar.name}`,
          slug: `polos-${prefix}-${thread.slug}`,
          displayOrder: thread.displayOrder,
          parent: collar,
        });
      }
    }

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

seed();
