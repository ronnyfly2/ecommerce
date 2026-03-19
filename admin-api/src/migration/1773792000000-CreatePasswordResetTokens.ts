import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1773792000000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1773792000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        token_hash varchar NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_password_reset_tokens_token_hash
      ON password_reset_tokens (token_hash)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_password_reset_tokens_user_id
      ON password_reset_tokens (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_password_reset_tokens_expires_at
      ON password_reset_tokens (expires_at)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_password_reset_tokens_user_id'
        ) THEN
          ALTER TABLE password_reset_tokens
          ADD CONSTRAINT FK_password_reset_tokens_user_id
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE password_reset_tokens
      DROP CONSTRAINT IF EXISTS FK_password_reset_tokens_user_id
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_password_reset_tokens_expires_at
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_password_reset_tokens_user_id
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS UQ_password_reset_tokens_token_hash
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS password_reset_tokens
    `);
  }
}
