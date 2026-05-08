import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminPdfDrafts1775400000000 implements MigrationInterface {
  name = 'CreateAdminPdfDrafts1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_pdf_drafts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        document_key varchar(191) NOT NULL,
        file_name varchar(255) NOT NULL,
        total_pages int NOT NULL,
        draft jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_admin_pdf_drafts_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_pdf_drafts_user_document
      ON admin_pdf_drafts (user_id, document_key)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_pdf_drafts_updated_at
      ON admin_pdf_drafts (updated_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_admin_pdf_drafts_updated_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_admin_pdf_drafts_user_document');
    await queryRunner.query('DROP TABLE IF EXISTS admin_pdf_drafts');
  }
}
