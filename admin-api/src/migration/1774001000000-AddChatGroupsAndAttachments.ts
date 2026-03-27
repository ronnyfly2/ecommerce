import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatGroupsAndAttachments1774001000000 implements MigrationInterface {
  name = 'AddChatGroupsAndAttachments1774001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_group_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at timestamptz,
        joined_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_chat_group_members_group_user UNIQUE (group_id, user_id)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE chat_messages
      ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES chat_groups(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS message_type varchar(20) NOT NULL DEFAULT 'TEXT',
      ADD COLUMN IF NOT EXISTS attachment_url varchar,
      ADD COLUMN IF NOT EXISTS attachment_name varchar(255),
      ADD COLUMN IF NOT EXISTS attachment_mime varchar(150),
      ADD COLUMN IF NOT EXISTS attachment_size int
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_group_created
        ON chat_messages(group_id, created_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_group_members_user
        ON chat_group_members(user_id, group_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_group_members_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_messages_group_created`);

    await queryRunner.query(`
      ALTER TABLE chat_messages
      DROP COLUMN IF EXISTS attachment_size,
      DROP COLUMN IF EXISTS attachment_mime,
      DROP COLUMN IF EXISTS attachment_name,
      DROP COLUMN IF EXISTS attachment_url,
      DROP COLUMN IF EXISTS message_type,
      DROP COLUMN IF EXISTS group_id
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS chat_group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_groups`);
  }
}
