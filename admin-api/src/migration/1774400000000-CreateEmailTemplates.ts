import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTemplates1774400000000 implements MigrationInterface {
  name = 'CreateEmailTemplates1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key varchar(80) NOT NULL,
        subject varchar(200) NOT NULL,
        html text NOT NULL,
        text text,
        is_enabled boolean NOT NULL DEFAULT true,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_key
      ON email_templates (key)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_email_templates_key');
    await queryRunner.query('DROP TABLE IF EXISTS email_templates');
  }
}
