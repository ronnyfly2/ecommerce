import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductRecommendations1773805000000 implements MigrationInterface {
  name = 'CreateProductRecommendations1773805000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE product_recommendations_recommendation_type_enum AS ENUM ('RELATED', 'SUGGESTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_recommendations (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL,
        recommended_product_id uuid NOT NULL,
        recommendation_type product_recommendations_recommendation_type_enum NOT NULL,
        display_order integer NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT PK_product_recommendations PRIMARY KEY (id),
        CONSTRAINT FK_product_recommendations_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE CASCADE,
        CONSTRAINT FK_product_recommendations_recommended_product
          FOREIGN KEY (recommended_product_id)
          REFERENCES products(id)
          ON DELETE CASCADE,
        CONSTRAINT UQ_product_recommendation_unique UNIQUE (product_id, recommended_product_id, recommendation_type),
        CONSTRAINT CHK_product_recommendations_not_same CHECK (product_id <> recommended_product_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_recommendations_product_id
      ON product_recommendations (product_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_recommendations_recommended_product_id
      ON product_recommendations (recommended_product_id)
    `);

    await queryRunner.query(`
      INSERT INTO product_recommendations (product_id, recommended_product_id, recommendation_type, display_order)
      SELECT product_id, related_product_id, 'RELATED', 0
      FROM product_related_products
      ON CONFLICT (product_id, recommended_product_id, recommendation_type) DO NOTHING
    `).catch(() => undefined);

    await queryRunner.query(`DROP TABLE IF EXISTS product_related_products CASCADE`).catch(() => undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_related_products (
        product_id uuid NOT NULL,
        related_product_id uuid NOT NULL,
        PRIMARY KEY (product_id, related_product_id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO product_related_products (product_id, related_product_id)
      SELECT product_id, recommended_product_id
      FROM product_recommendations
      WHERE recommendation_type = 'RELATED'
      ON CONFLICT DO NOTHING
    `).catch(() => undefined);

    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_recommendations_recommended_product_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_recommendations_product_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_recommendations`);
    await queryRunner.query(`DROP TYPE IF EXISTS product_recommendations_recommendation_type_enum`);
  }
}