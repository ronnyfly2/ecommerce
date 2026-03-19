import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { CleanSeedDto, SeedCleanMode } from './dto/clean-seed.dto';

@Injectable()
export class AdminToolsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Size)
    private readonly sizeRepository: Repository<Size>,
    @InjectRepository(Color)
    private readonly colorRepository: Repository<Color>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

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

  async runSeed() {
    this.assertEnabled();

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
      label: string;
    }) => {
      const existingUser = await this.userRepository.findOne({
        where: { email: params.email },
      });

      const passwordHash = await bcrypt.hash(params.rawPassword, 10);

      if (!existingUser) {
        const newUser = this.userRepository.create({
          email: params.email,
          passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          role: params.role,
          isActive: true,
        });
        await this.userRepository.save(newUser);
        return `${params.label} created`;
      }

      existingUser.passwordHash = passwordHash;
      existingUser.firstName = params.firstName;
      existingUser.lastName = params.lastName;
      existingUser.role = params.role;
      existingUser.isActive = true;
      await this.userRepository.save(existingUser);
      return `${params.label} updated`;
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

    const userResults = await Promise.all(seedUsers.map((userData) => upsertSeedUser(userData)));

    const seedSizes = [
      { name: 'Extra Small', abbreviation: 'XS', displayOrder: 1 },
      { name: 'Small', abbreviation: 'S', displayOrder: 2 },
      { name: 'Medium', abbreviation: 'M', displayOrder: 3 },
      { name: 'Large', abbreviation: 'L', displayOrder: 4 },
      { name: 'Extra Large', abbreviation: 'XL', displayOrder: 5 },
      { name: 'XXL', abbreviation: 'XXL', displayOrder: 6 },
    ];

    let createdSizes = 0;
    for (const sizeData of seedSizes) {
      const existingSize = await this.sizeRepository.findOne({
        where: { abbreviation: sizeData.abbreviation },
      });
      if (!existingSize) {
        const size = this.sizeRepository.create(sizeData);
        await this.sizeRepository.save(size);
        createdSizes += 1;
      }
    }

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

    let createdColors = 0;
    for (const colorData of seedColors) {
      const existingColor = await this.colorRepository.findOne({
        where: { name: colorData.name },
      });
      if (!existingColor) {
        const color = this.colorRepository.create(colorData);
        await this.colorRepository.save(color);
        createdColors += 1;
      }
    }

    return {
      mode: 'seed-run',
      users: userResults,
      createdSizes,
      createdColors,
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

  async cleanSeed(dto: CleanSeedDto, confirmationPhrase?: string) {
    this.assertEnabled();

    const mode = dto.mode ?? SeedCleanMode.SEED;
    const forceMode = dto.force ?? false;
    this.assertDestructiveConfirmation(mode, forceMode, confirmationPhrase);

    if (mode === SeedCleanMode.ALL) {
      const tables: Array<{ tablename: string }> = await this.dataSource.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'migrations'
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

      return {
        mode,
        tablesTruncated: tableNames.length,
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

    const seedUserEmails = [
      this.configService.get<string>('SEED_SUPER_ADMIN_EMAIL') ?? 'superadmin@local.dev',
      'superadmin2@local.dev',
      this.configService.get<string>('SEED_ADMIN_EMAIL') ?? 'admin@local.dev',
      'admin2@local.dev',
      'admin3@local.dev',
      'customer1@local.dev',
      'customer2@local.dev',
      'customer3@local.dev',
    ];
    const seedSizeAbbreviations = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const seedColorNames = [
      'Black',
      'White',
      'Red',
      'Blue',
      'Green',
      'Yellow',
      'Gray',
      'Navy',
    ];

    const usersToDelete = await this.userRepository.find({
      where: { email: In(seedUserEmails) },
    });

    let deletedUsers = 0;
    if (usersToDelete.length > 0) {
      await this.userRepository.remove(usersToDelete);
      deletedUsers = usersToDelete.length;
    }

    const sizesToDelete = await this.sizeRepository.find({
      where: { abbreviation: In(seedSizeAbbreviations) },
    });
    const colorsToDelete = await this.colorRepository.find({
      where: { name: In(seedColorNames) },
    });

    const seedSizeIds = sizesToDelete.map((size) => size.id);
    const seedColorIds = colorsToDelete.map((color) => color.id);

    const variantIdsToDelete =
      seedSizeIds.length > 0 || seedColorIds.length > 0
        ? (
            await this.variantRepository
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

    let forceDeletedVariants = 0;
    let forceDeletedOrderItems = 0;
    let forceDeletedInventoryMovements = 0;

    if (forceMode && variantIdsToDelete.length > 0) {
      await this.dataSource.transaction(async (manager) => {
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
        forceDeletedInventoryMovements =
          deleteInventoryMovementsResult.affected ?? 0;

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
      blockedSizeCount = await this.variantRepository
        .createQueryBuilder('variant')
        .where('variant.size_id IN (:...sizeIds)', { sizeIds: seedSizeIds })
        .getCount();
    }

    let deletedSizes = 0;
    if (sizesToDelete.length > 0 && blockedSizeCount === 0) {
      await this.sizeRepository.remove(sizesToDelete);
      deletedSizes = sizesToDelete.length;
    }

    let blockedColorCount = 0;
    if (seedColorIds.length > 0) {
      blockedColorCount = await this.variantRepository
        .createQueryBuilder('variant')
        .where('variant.color_id IN (:...colorIds)', { colorIds: seedColorIds })
        .getCount();
    }

    let deletedColors = 0;
    if (colorsToDelete.length > 0 && blockedColorCount === 0) {
      await this.colorRepository.remove(colorsToDelete);
      deletedColors = colorsToDelete.length;
    }

    return {
      mode: forceMode ? 'seed-force' : 'seed-safe',
      deletedUsers,
      forceDeletedVariants,
      forceDeletedOrderItems,
      forceDeletedInventoryMovements,
      deletedSizes,
      deletedColors,
      blockedSizeCount,
      blockedColorCount,
    };
  }
}
