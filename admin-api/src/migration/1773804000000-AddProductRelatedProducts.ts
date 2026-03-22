import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductRelatedProducts1773804000000 implements MigrationInterface {
  name = 'AddProductRelatedProducts1773804000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_related_products (
        product_id uuid NOT NULL,
        related_product_id uuid NOT NULL,
        PRIMARY KEY (product_id, related_product_id),
        CONSTRAINT FK_product_related_products_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE CASCADE,
        CONSTRAINT FK_product_related_products_related_product
          FOREIGN KEY (related_product_id)
          REFERENCES products(id)
          ON DELETE CASCADE,
        CONSTRAINT CHK_product_related_products_not_same
          CHECK (product_id <> related_product_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_related_products_product_id
      ON product_related_products (product_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_related_products_related_product_id
      ON product_related_products (related_product_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_related_products_related_product_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_related_products_product_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_related_products`);
  }
}
