import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMxnAndClpCurrencies1773807000000 implements MigrationInterface {
  name = 'AddMxnAndClpCurrencies1773807000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO currencies (code, name, symbol, exchange_rate_to_usd, is_active, is_default)
      VALUES
        ('MXN', 'Mexican Peso', 'MX$', 17.000000, true, false),
        ('CLP', 'Chilean Peso', 'CLP$', 950.000000, true, false)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        exchange_rate_to_usd = EXCLUDED.exchange_rate_to_usd,
        is_active = EXCLUDED.is_active
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM currencies
      WHERE code IN ('MXN', 'CLP')
    `);
  }
}