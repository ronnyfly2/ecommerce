import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductFeatures1774301000000 implements MigrationInterface {
  name = 'AddProductFeatures1774301000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS features
    `);
  }
}
