import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDynamicAttributesAndProductStock1773813000000 implements MigrationInterface {
  name = 'AddDynamicAttributesAndProductStock1773813000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS attribute_definitions jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS attribute_values jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE products p
      SET stock = COALESCE(variant_totals.total_stock, 0)
      FROM (
        SELECT product_id, SUM(stock)::int AS total_stock
        FROM product_variants
        GROUP BY product_id
      ) variant_totals
      WHERE variant_totals.product_id = p.id
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_movements
      ADD COLUMN IF NOT EXISTS product_id uuid,
      ALTER COLUMN variant_id DROP NOT NULL
    `);

    await queryRunner.query(`
      UPDATE inventory_movements im
      SET product_id = pv.product_id
      FROM product_variants pv
      WHERE im.variant_id = pv.id
        AND im.product_id IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_movements_product_id'
        ) THEN
          ALTER TABLE inventory_movements
          ADD CONSTRAINT fk_inventory_movements_product_id
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS product_id uuid,
      ADD COLUMN IF NOT EXISTS snapshot_product_name varchar,
      ADD COLUMN IF NOT EXISTS snapshot_sku varchar,
      ADD COLUMN IF NOT EXISTS snapshot_descriptor varchar,
      ALTER COLUMN variant_id DROP NOT NULL
    `);

    await queryRunner.query(`
      UPDATE order_items oi
      SET
        product_id = pv.product_id,
        snapshot_product_name = p.name,
        snapshot_sku = pv.sku,
        snapshot_descriptor = CONCAT(sz.name, ' / ', c.name)
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      INNER JOIN sizes sz ON sz.id = pv.size_id
      INNER JOIN colors c ON c.id = pv.color_id
      WHERE oi.variant_id = pv.id
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_product_id'
        ) THEN
          ALTER TABLE order_items
          ADD CONSTRAINT fk_order_items_product_id
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM inventory_movements WHERE variant_id IS NULL`);
    await queryRunner.query(`DELETE FROM order_items WHERE variant_id IS NULL`);

    await queryRunner.query(`
      ALTER TABLE order_items
      DROP CONSTRAINT IF EXISTS fk_order_items_product_id,
      DROP COLUMN IF EXISTS snapshot_descriptor,
      DROP COLUMN IF EXISTS snapshot_sku,
      DROP COLUMN IF EXISTS snapshot_product_name,
      DROP COLUMN IF EXISTS product_id,
      ALTER COLUMN variant_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_movements
      DROP CONSTRAINT IF EXISTS fk_inventory_movements_product_id,
      DROP COLUMN IF EXISTS product_id,
      ALTER COLUMN variant_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS attribute_values,
      DROP COLUMN IF EXISTS stock
    `);

    await queryRunner.query(`
      ALTER TABLE categories
      DROP COLUMN IF EXISTS attribute_definitions
    `);
  }
}