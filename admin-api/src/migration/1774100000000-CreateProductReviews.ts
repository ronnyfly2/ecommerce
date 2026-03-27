import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductReviews1774100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment      text NULL,
        is_approved  boolean NOT NULL DEFAULT false,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        UNIQUE (product_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_reviews_product_id ON product_reviews (product_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_reviews_user_id ON product_reviews (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_product_reviews_approved ON product_reviews (product_id, is_approved)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_reviews_approved`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_reviews_user_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_product_reviews_product_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_reviews`);
  }
}
