import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTemplates1775300000000 implements MigrationInterface {
  name = 'CreateTemplates1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_key varchar(120) NOT NULL,
        channel varchar(20) NOT NULL,
        page_type varchar(40) NOT NULL,
        version int NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'draft',
        schema_version varchar(20) NOT NULL,
        content jsonb NOT NULL,
        publish_note text,
        created_by varchar(120),
        updated_by varchar(120),
        published_by varchar(120),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        CONSTRAINT chk_templates_status CHECK (status IN ('draft', 'published', 'deprecated')),
        CONSTRAINT chk_templates_channel CHECK (channel IN ('web')),
        CONSTRAINT chk_templates_page_type CHECK (page_type IN ('home', 'category'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_key_channel_version
      ON templates (template_key, channel, version)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_single_published
      ON templates (template_key, channel)
      WHERE status = 'published'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_templates_lookup
      ON templates (template_key, channel, status, version DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_templates_lookup');
    await queryRunner.query('DROP INDEX IF EXISTS idx_templates_single_published');
    await queryRunner.query('DROP INDEX IF EXISTS idx_templates_key_channel_version');
    await queryRunner.query('DROP TABLE IF EXISTS templates');
  }
}
