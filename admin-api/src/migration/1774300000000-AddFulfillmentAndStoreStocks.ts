import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFulfillmentAndStoreStocks1774300000000
  implements MigrationInterface
{
  name = 'AddFulfillmentAndStoreStocks1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(40) NOT NULL UNIQUE,
        name varchar(140) NOT NULL,
        city varchar(120) NOT NULL,
        country varchar(120) NOT NULL,
        address varchar,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO stores (code, name, city, country, address, is_active)
      VALUES
        ('ATE', 'Ate', 'Lima', 'Peru', 'Ate, Lima, Peru', true),
        ('LA_MOLINA', 'La Molina', 'Lima', 'Peru', 'La Molina, Lima, Peru', true),
        ('LINCE', 'Lince', 'Lima', 'Peru', 'Lince, Lima, Peru', true)
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_delivery_stocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
        stock integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_store_stocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        stock integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_product_store_stocks_product_store UNIQUE (product_id, store_id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO product_delivery_stocks (product_id, stock)
      SELECT p.id, COALESCE(p.stock, 0)
      FROM products p
      ON CONFLICT (product_id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO product_store_stocks (product_id, store_id, stock)
      SELECT p.id, s.id, 0
      FROM products p
      CROSS JOIN stores s
      ON CONFLICT (product_id, store_id) DO NOTHING
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_fulfillment_type_enum') THEN
          CREATE TYPE order_fulfillment_type_enum AS ENUM ('delivery', 'pickup');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS fulfillment_type order_fulfillment_type_enum NOT NULL DEFAULT 'delivery',
      ADD COLUMN IF NOT EXISTS pickup_store_id uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_pickup_store_id'
        ) THEN
          ALTER TABLE orders
          ADD CONSTRAINT fk_orders_pickup_store_id
          FOREIGN KEY (pickup_store_id) REFERENCES stores(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_channel_enum') THEN
          CREATE TYPE inventory_channel_enum AS ENUM ('delivery', 'pickup');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_movements
      ADD COLUMN IF NOT EXISTS channel_type inventory_channel_enum,
      ADD COLUMN IF NOT EXISTS store_id uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_movements_store_id'
        ) THEN
          ALTER TABLE inventory_movements
          ADD CONSTRAINT fk_inventory_movements_store_id
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_movements
      DROP CONSTRAINT IF EXISTS fk_inventory_movements_store_id,
      DROP COLUMN IF EXISTS store_id,
      DROP COLUMN IF EXISTS channel_type
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS inventory_channel_enum`);

    await queryRunner.query(`
      ALTER TABLE orders
      DROP CONSTRAINT IF EXISTS fk_orders_pickup_store_id,
      DROP COLUMN IF EXISTS pickup_store_id,
      DROP COLUMN IF EXISTS fulfillment_type
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS order_fulfillment_type_enum`);

    await queryRunner.query(`DROP TABLE IF EXISTS product_store_stocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_delivery_stocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS stores`);
  }
}
