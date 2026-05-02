import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1774500000000 implements MigrationInterface {
  name = 'CreatePayments1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payment_provider_type AS ENUM ('MANUAL_TRANSFER', 'STRIPE', 'CASH_ON_DELIVERY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payment_method_type AS ENUM ('BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'DIGITAL_WALLET');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM (
          'PENDING', 'AWAITING_REVIEW', 'APPROVED', 'REJECTED', 'REFUNDED', 'FAILED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(80) NOT NULL,
        label varchar(120) NOT NULL,
        description text,
        provider payment_provider_type NOT NULL,
        type payment_method_type NOT NULL,
        is_enabled boolean NOT NULL DEFAULT true,
        display_order int NOT NULL DEFAULT 0,
        instructions text,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_code
      ON payment_methods (code)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
        provider payment_provider_type NOT NULL,
        status payment_status NOT NULL DEFAULT 'PENDING',
        amount numeric(12, 2) NOT NULL,
        currency_code varchar(3) NOT NULL DEFAULT 'USD',
        external_id varchar(200),
        checkout_url text,
        receipt_url text,
        receipt_filename varchar(200),
        receipt_mime varchar(80),
        receipt_size int,
        receipt_uploaded_at timestamptz,
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamptz,
        rejection_reason text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments (external_id)
    `);

    await queryRunner.query(`
      INSERT INTO payment_methods (code, label, description, provider, type, is_enabled, display_order, instructions, config)
      VALUES
        ('bank-transfer', 'Transferencia bancaria', 'Realiza el pago por transferencia y adjunta el comprobante', 'MANUAL_TRANSFER', 'BANK_TRANSFER', true, 1,
         'Transfiere el importe exacto a la cuenta indicada y adjunta el comprobante desde tu orden.',
         '{"bankName": "Banco XYZ", "accountHolder": "Empresa SA", "accountNumber": "0000-0000-0000-0000", "cbu": ""}'::jsonb),
        ('cash-on-delivery', 'Pago contra entrega', 'Abona al recibir el pedido', 'CASH_ON_DELIVERY', 'CASH', true, 2,
         'Paga en efectivo al recibir el pedido. Solo disponible para ciertas zonas.',
         '{}'::jsonb),
        ('stripe-card', 'Tarjeta (Stripe)', 'Pago con tarjeta mediante checkout seguro', 'STRIPE', 'CREDIT_CARD', false, 3,
         'Serás redirigido a una pasarela segura para completar el pago.',
         '{"secretKey": "", "webhookSecret": "", "currency": "USD"}'::jsonb)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_payments_external_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_payments_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_payments_order_id');
    await queryRunner.query('DROP TABLE IF EXISTS payments');
    await queryRunner.query('DROP INDEX IF EXISTS idx_payment_methods_code');
    await queryRunner.query('DROP TABLE IF EXISTS payment_methods');
    await queryRunner.query('DROP TYPE IF EXISTS payment_status');
    await queryRunner.query('DROP TYPE IF EXISTS payment_method_type');
    await queryRunner.query('DROP TYPE IF EXISTS payment_provider_type');
  }
}
