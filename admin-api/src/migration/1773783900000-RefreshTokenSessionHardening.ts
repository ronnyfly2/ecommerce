import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokenSessionHardening1773783900000
  implements MigrationInterface
{
  name = 'RefreshTokenSessionHardening1773783900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_id varchar NOT NULL,
        token_hash varchar NOT NULL,
        user_id uuid NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        replaced_by_token_id varchar NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ALTER COLUMN replaced_by_token_id TYPE varchar
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS fingerprint_hash varchar
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS ip_address varchar NULL
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS user_agent text NULL
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS device_name varchar NULL
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS last_used_at timestamptz NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_refresh_tokens_token_id
      ON refresh_tokens (token_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_refresh_tokens_user_id
      ON refresh_tokens (user_id)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_refresh_tokens_user_id'
        ) THEN
          ALTER TABLE refresh_tokens
          ADD CONSTRAINT FK_refresh_tokens_user_id
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE refresh_tokens
      SET fingerprint_hash = token_hash
      WHERE fingerprint_hash IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ALTER COLUMN fingerprint_hash SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP COLUMN IF EXISTS last_used_at
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP COLUMN IF EXISTS device_name
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP COLUMN IF EXISTS user_agent
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP COLUMN IF EXISTS ip_address
    `);

    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      DROP COLUMN IF EXISTS fingerprint_hash
    `);
  }
}
