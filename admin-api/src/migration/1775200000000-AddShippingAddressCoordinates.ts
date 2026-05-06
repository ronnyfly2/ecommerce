import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShippingAddressCoordinates1775200000000 implements MigrationInterface {
  name = 'AddShippingAddressCoordinates1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipping_addresses" ADD COLUMN IF NOT EXISTS "lat" numeric(10,6)`);
    await queryRunner.query(`ALTER TABLE "shipping_addresses" ADD COLUMN IF NOT EXISTS "lng" numeric(10,6)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipping_addresses" DROP COLUMN "lng"`);
    await queryRunner.query(`ALTER TABLE "shipping_addresses" DROP COLUMN "lat"`);
  }
}
