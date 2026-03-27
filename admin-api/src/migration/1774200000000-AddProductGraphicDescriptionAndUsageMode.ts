import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductGraphicDescriptionAndUsageMode1774200000000
  implements MigrationInterface
{
  name = 'AddProductGraphicDescriptionAndUsageMode1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS graphic_description text,
      ADD COLUMN IF NOT EXISTS usage_mode text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS usage_mode,
      DROP COLUMN IF EXISTS graphic_description
    `);
  }
}
