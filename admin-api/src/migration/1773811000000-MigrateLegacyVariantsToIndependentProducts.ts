import { MigrationInterface, QueryRunner } from 'typeorm';

type LegacyVariantRow = {
  variantId: string;
  parentProductId: string;
  parentName: string;
  parentSku: string;
  parentSlug: string;
  parentDescription: string | null;
  parentBasePrice: string;
  parentCurrencyCode: string;
  parentCategoryId: string;
  parentCouponId: string | null;
  parentCouponLink: string | null;
  parentIsFeatured: boolean;
  sizeName: string;
  colorName: string;
  variantSku: string;
  variantAdditionalPrice: string;
  variantIsActive: boolean;
};

export class MigrateLegacyVariantsToIndependentProducts1773811000000 implements MigrationInterface {
  name = 'MigrateLegacyVariantsToIndependentProducts1773811000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS variant_products_migration_map (
        product_variant_id uuid PRIMARY KEY,
        parent_product_id uuid NOT NULL,
        variant_product_id uuid NOT NULL,
        created_by_migration boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const rows = await queryRunner.query(`
      SELECT
        pv.id AS "variantId",
        p.id AS "parentProductId",
        p.name AS "parentName",
        p.sku AS "parentSku",
        p.slug AS "parentSlug",
        p.description AS "parentDescription",
        p.base_price::text AS "parentBasePrice",
        p.currency_code AS "parentCurrencyCode",
        p.category_id AS "parentCategoryId",
        p.coupon_id AS "parentCouponId",
        p.coupon_link AS "parentCouponLink",
        p.is_featured AS "parentIsFeatured",
        sz.name AS "sizeName",
        c.name AS "colorName",
        pv.sku AS "variantSku",
        pv.additional_price::text AS "variantAdditionalPrice",
        pv.is_active AS "variantIsActive"
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      INNER JOIN sizes sz ON sz.id = pv.size_id
      INNER JOIN colors c ON c.id = pv.color_id
      ORDER BY p.created_at ASC, pv.created_at ASC
    `) as LegacyVariantRow[];

    const orderByParent = new Map<string, number>();

    for (const row of rows) {
      const alreadyMapped = await queryRunner.query(
        `SELECT 1 FROM variant_products_migration_map WHERE product_variant_id = $1 LIMIT 1`,
        [row.variantId],
      );

      if (alreadyMapped.length > 0) {
        continue;
      }

      const existingProduct = await queryRunner.query(
        `SELECT id FROM products WHERE sku = $1 LIMIT 1`,
        [row.variantSku],
      );

      let variantProductId: string;
      let createdByMigration = false;

      if (existingProduct.length > 0) {
        variantProductId = existingProduct[0].id as string;
      } else {
        createdByMigration = true;

        const finalBasePrice = (
          Number(row.parentBasePrice || 0) + Number(row.variantAdditionalPrice || 0)
        ).toFixed(2);

        const generatedName = `${row.parentName} - ${row.colorName} ${row.sizeName} (${row.variantSku})`;
        const generatedSlug = this.slugify(`var-${row.variantSku}-${row.variantId.slice(0, 8)}`);
        const generatedDescription = this.buildDescription(row);

        const inserted = await queryRunner.query(
          `
            INSERT INTO products (
              name,
              sku,
              slug,
              description,
              base_price,
              currency_code,
              category_id,
              coupon_id,
              coupon_link,
              is_active,
              is_featured,
              has_offer,
              offer_price,
              offer_percentage,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              false,
              NULL,
              NULL,
              now(),
              now()
            )
            RETURNING id
          `,
          [
            generatedName,
            row.variantSku,
            generatedSlug,
            generatedDescription,
            finalBasePrice,
            row.parentCurrencyCode,
            row.parentCategoryId,
            row.parentCouponId,
            row.parentCouponLink,
            row.variantIsActive,
            row.parentIsFeatured,
          ],
        );

        variantProductId = inserted[0].id as string;

        await queryRunner.query(
          `
            INSERT INTO product_tags (product_id, tag_id)
            SELECT $1, pt.tag_id
            FROM product_tags pt
            WHERE pt.product_id = $2
            ON CONFLICT DO NOTHING
          `,
          [variantProductId, row.parentProductId],
        );

        await queryRunner.query(
          `
            INSERT INTO product_images (
              product_id,
              url,
              alt_text,
              is_main,
              display_order,
              created_at
            )
            SELECT
              $1,
              pi.url,
              COALESCE(pi.alt_text, $2),
              pi.is_main,
              pi.display_order,
              now()
            FROM product_images pi
            WHERE pi.product_id = $3
          `,
          [variantProductId, generatedName, row.parentProductId],
        );
      }

      const nextOrder = orderByParent.get(row.parentProductId) ?? 0;

      await queryRunner.query(
        `
          INSERT INTO product_recommendations (
            product_id,
            recommended_product_id,
            recommendation_type,
            display_order,
            created_at
          )
          VALUES ($1, $2, 'VARIANT', $3, now())
          ON CONFLICT (product_id, recommended_product_id, recommendation_type) DO NOTHING
        `,
        [row.parentProductId, variantProductId, nextOrder],
      );

      orderByParent.set(row.parentProductId, nextOrder + 1);

      await queryRunner.query(
        `
          INSERT INTO variant_products_migration_map (
            product_variant_id,
            parent_product_id,
            variant_product_id,
            created_by_migration
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (product_variant_id) DO NOTHING
        `,
        [row.variantId, row.parentProductId, variantProductId, createdByMigration],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const mappedRows = await queryRunner.query(`
      SELECT
        product_variant_id,
        parent_product_id,
        variant_product_id,
        created_by_migration
      FROM variant_products_migration_map
    `) as Array<{
      product_variant_id: string;
      parent_product_id: string;
      variant_product_id: string;
      created_by_migration: boolean;
    }>;

    for (const row of mappedRows) {
      await queryRunner.query(
        `
          DELETE FROM product_recommendations
          WHERE product_id = $1
            AND recommended_product_id = $2
            AND recommendation_type = 'VARIANT'
        `,
        [row.parent_product_id, row.variant_product_id],
      );

      if (row.created_by_migration) {
        await queryRunner.query(
          `DELETE FROM products WHERE id = $1`,
          [row.variant_product_id],
        );
      }
    }

    await queryRunner.query(`DROP TABLE IF EXISTS variant_products_migration_map`);
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private buildDescription(row: LegacyVariantRow): string {
    const detail = `Variante automática migrada desde ${row.parentSku}: ${row.colorName} / ${row.sizeName}.`;
    if (!row.parentDescription) {
      return detail;
    }
    return `${row.parentDescription}\n\n${detail}`;
  }
}
