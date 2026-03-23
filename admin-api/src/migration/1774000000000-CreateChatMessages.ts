import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessages1774000000000 implements MigrationInterface {
  name = 'CreateChatMessages1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
        recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
        content text NOT NULL,
        is_read boolean NOT NULL DEFAULT false,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_recipient
        ON chat_messages(sender_id, recipient_id, created_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_sender
        ON chat_messages(recipient_id, sender_id, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_messages_recipient_sender`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chat_messages_sender_recipient`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_messages`);
  }
}
