import { AppDataSource } from '../src/data-source';
import { User } from '../src/users/entities/user.entity';
import { Size } from '../src/sizes/entities/size.entity';
import { Color } from '../src/colors/entities/color.entity';
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
