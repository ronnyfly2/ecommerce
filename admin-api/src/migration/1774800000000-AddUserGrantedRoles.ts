import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGrantedRoles1774800000000 implements MigrationInterface {
  name = 'AddUserGrantedRoles1774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS granted_roles varchar NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS granted_roles
    `);
  }
}
