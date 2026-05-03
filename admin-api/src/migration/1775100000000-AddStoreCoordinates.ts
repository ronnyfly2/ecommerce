import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreCoordinates1775100000000 implements MigrationInterface {
  name = 'AddStoreCoordinates1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "lat" numeric(10,6)`);
    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "lng" numeric(10,6)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "lng"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "lat"`);
  }
}
