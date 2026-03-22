import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCouponFields1773802000000 implements MigrationInterface {
  name = 'AddProductCouponFields1773802000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS coupon_id uuid NULL,
      ADD COLUMN IF NOT EXISTS coupon_link varchar NULL
    `);

    await queryRunner.query(`
      ALTER TABLE products
      ADD CONSTRAINT FK_products_coupon_id
      FOREIGN KEY (coupon_id)
      REFERENCES coupons(id)
      ON DELETE SET NULL
    `).catch(() => undefined);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_products_coupon_id
      ON products (coupon_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_products_coupon_id`);
    await queryRunner.query(`
      ALTER TABLE products
      DROP CONSTRAINT IF EXISTS FK_products_coupon_id
    `);
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS coupon_link,
      DROP COLUMN IF EXISTS coupon_id
    `);
  }
}
