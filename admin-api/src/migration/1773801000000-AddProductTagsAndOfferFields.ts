import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductTagsAndOfferFields1773801000000
  implements MigrationInterface
{
  name = 'AddProductTagsAndOfferFields1773801000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS has_offer boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS offer_price numeric(12, 2) NULL,
      ADD COLUMN IF NOT EXISTS offer_percentage numeric(5, 2) NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id uuid NOT NULL,
        tag_id uuid NOT NULL,
        PRIMARY KEY (product_id, tag_id),
        CONSTRAINT FK_product_tags_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE CASCADE,
        CONSTRAINT FK_product_tags_tag
          FOREIGN KEY (tag_id)
          REFERENCES tags(id)
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_tags_product_id
      ON product_tags (product_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_tags_tag_id
      ON product_tags (tag_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_tags_tag_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_tags_product_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_tags`);

    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS offer_percentage,
      DROP COLUMN IF EXISTS offer_price,
      DROP COLUMN IF EXISTS has_offer
    `);
  }
}
