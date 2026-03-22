import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCurrenciesAndMoneyFields1773806000000 implements MigrationInterface {
  name = 'CreateCurrenciesAndMoneyFields1773806000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS currencies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(3) NOT NULL UNIQUE,
        name varchar(60) NOT NULL,
        symbol varchar(10) NOT NULL,
        exchange_rate_to_usd numeric(14,6) NOT NULL DEFAULT 1,
        is_active boolean NOT NULL DEFAULT true,
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO currencies (code, name, symbol, exchange_rate_to_usd, is_active, is_default)
      VALUES
        ('USD', 'US Dollar', '$', 1, true, true),
        ('PEN', 'Sol', 'S/', 3.75, true, false)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        exchange_rate_to_usd = EXCLUDED.exchange_rate_to_usd,
        is_active = EXCLUDED.is_active
    `);

    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS currency_code varchar(3) NOT NULL DEFAULT 'USD'
    `);

    await queryRunner.query(`
      ALTER TABLE coupons
      ADD COLUMN IF NOT EXISTS currency_code varchar(3) NOT NULL DEFAULT 'USD'
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS currency_code varchar(3) NOT NULL DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS exchange_rate_to_usd numeric(14,6) NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_products_currency_code ON products (currency_code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_coupons_currency_code ON coupons (currency_code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_orders_currency_code ON orders (currency_code)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_orders_currency_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_coupons_currency_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_products_currency_code`);

    await queryRunner.query(`
      ALTER TABLE orders
      DROP COLUMN IF EXISTS exchange_rate_to_usd,
      DROP COLUMN IF EXISTS currency_code
    `);

    await queryRunner.query(`
      ALTER TABLE coupons
      DROP COLUMN IF EXISTS currency_code
    `);

    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS currency_code
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS currencies`);
  }
}
