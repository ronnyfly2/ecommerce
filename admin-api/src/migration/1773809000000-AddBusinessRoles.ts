import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessRoles1773809000000 implements MigrationInterface {
  name = 'AddBusinessRoles1773809000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_name text;
      BEGIN
        SELECT c.udt_name INTO enum_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'users'
          AND c.column_name = 'role';

        IF enum_name IS NULL THEN
          RAISE NOTICE 'Role enum for users.role was not found. Skipping role enum migration.';
          RETURN;
        END IF;

        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''BOSS''', enum_name);
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''MARKETING''', enum_name);
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''SALES''', enum_name);
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL enums do not support removing values safely in reversible migrations.
  }
}
