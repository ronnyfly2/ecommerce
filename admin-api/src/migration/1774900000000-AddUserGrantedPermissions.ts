import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGrantedPermissions1774900000000 implements MigrationInterface {
  name = 'AddUserGrantedPermissions1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS granted_permissions varchar NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS granted_permissions
    `);
  }
}
