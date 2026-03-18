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
      process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@ecommerce.com';
    const superAdminRawPassword =
      process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMeSuperAdmin123!';
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ecommerce.com';
    const adminRawPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMeAdmin123!';

    const userRepository = AppDataSource.getRepository(User);
    const sizeRepository = AppDataSource.getRepository(Size);
    const colorRepository = AppDataSource.getRepository(Color);

    // Seed Users
    const existingSuperAdmin = await userRepository.findOne({
      where: { email: superAdminEmail },
    });

    if (!existingSuperAdmin) {
      const superAdminPassword = await bcrypt.hash(superAdminRawPassword, 10);
      const superAdmin = userRepository.create({
        email: superAdminEmail,
        passwordHash: superAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: Role.SUPER_ADMIN,
        isActive: true,
      });
      await userRepository.save(superAdmin);
      console.log('✓ SUPER_ADMIN created');
    } else {
      console.log('✓ SUPER_ADMIN already exists');
    }

    const existingAdmin = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const adminPassword = await bcrypt.hash(adminRawPassword, 10);
      const admin = userRepository.create({
        email: adminEmail,
        passwordHash: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
        isActive: true,
      });
      await userRepository.save(admin);
      console.log('✓ ADMIN created');
    } else {
      console.log('✓ ADMIN already exists');
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

    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
