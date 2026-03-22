import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductSku1773803000000 implements MigrationInterface {
  name = 'AddProductSku1773803000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS sku varchar
    `);

    await queryRunner.query(`
      UPDATE products
      SET sku = CONCAT('PRD-', UPPER(REPLACE(slug, '-', '_')))
      WHERE sku IS NULL OR TRIM(sku) = ''
    `);

    await queryRunner.query(`
      ALTER TABLE products
      ALTER COLUMN sku SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_products_sku_unique
      ON products (sku)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_products_sku_unique`);
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS sku
    `);
  }
}
