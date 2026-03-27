import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryCapabilitiesAndProductMeasurements1773812000000 implements MigrationInterface {
  name = 'AddCategoryCapabilitiesAndProductMeasurements1773812000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS supports_size_color_variants boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS supports_dimensions boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS supports_weight boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS weight_value numeric(10, 3),
      ADD COLUMN IF NOT EXISTS weight_unit varchar(10),
      ADD COLUMN IF NOT EXISTS length_value numeric(10, 2),
      ADD COLUMN IF NOT EXISTS width_value numeric(10, 2),
      ADD COLUMN IF NOT EXISTS height_value numeric(10, 2),
      ADD COLUMN IF NOT EXISTS dimension_unit varchar(10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS dimension_unit,
      DROP COLUMN IF EXISTS height_value,
      DROP COLUMN IF EXISTS width_value,
      DROP COLUMN IF EXISTS length_value,
      DROP COLUMN IF EXISTS weight_unit,
      DROP COLUMN IF EXISTS weight_value
    `);

    await queryRunner.query(`
      ALTER TABLE categories
      DROP COLUMN IF EXISTS supports_weight,
      DROP COLUMN IF EXISTS supports_dimensions,
      DROP COLUMN IF EXISTS supports_size_color_variants
    `);
  }
}