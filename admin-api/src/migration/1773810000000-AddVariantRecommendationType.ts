import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVariantRecommendationType1773810000000 implements MigrationInterface {
  name = 'AddVariantRecommendationType1773810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE product_recommendations_recommendation_type_enum ADD VALUE IF NOT EXISTS 'VARIANT';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM product_recommendations
      WHERE recommendation_type = 'VARIANT';
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'product_recommendations_recommendation_type_enum'
        ) THEN
          ALTER TYPE product_recommendations_recommendation_type_enum RENAME TO product_recommendations_recommendation_type_enum_old;

          CREATE TYPE product_recommendations_recommendation_type_enum AS ENUM ('RELATED', 'SUGGESTED');

          ALTER TABLE product_recommendations
            ALTER COLUMN recommendation_type
            TYPE product_recommendations_recommendation_type_enum
            USING recommendation_type::text::product_recommendations_recommendation_type_enum;

          DROP TYPE product_recommendations_recommendation_type_enum_old;
        END IF;
      END $$;
    `);
  }
}
