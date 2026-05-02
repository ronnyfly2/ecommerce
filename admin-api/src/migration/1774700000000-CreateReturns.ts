import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReturns1774700000000 implements MigrationInterface {
  name = 'CreateReturns1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE return_status AS ENUM (
          'PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE return_reason AS ENUM (
          'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'DAMAGED_IN_TRANSIT',
          'SIZE_FIT', 'CHANGED_MIND', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE return_event_type AS ENUM (
          'STATUS_CHANGE', 'NOTE', 'REFUND_ISSUED'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE refund_method AS ENUM (
          'ORIGINAL', 'STORE_CREDIT', 'BANK_TRANSFER', 'CASH', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS return_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rma_number varchar(32) NOT NULL,
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status return_status NOT NULL DEFAULT 'PENDING',
        reason return_reason NOT NULL DEFAULT 'OTHER',
        description text,
        customer_notes text,
        internal_notes text,
        instructions text,
        rejection_reason text,
        refund_amount numeric(12, 2),
        refund_method refund_method,
        currency_code varchar(3) NOT NULL DEFAULT 'USD',
        refund_reference varchar(200),
        requested_at timestamptz NOT NULL,
        approved_at timestamptz,
        rejected_at timestamptz,
        received_at timestamptz,
        refunded_at timestamptz,
        cancelled_at timestamptz,
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_return_requests_rma_number ON return_requests (rma_number)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests (order_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests (user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests (status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS return_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        return_id uuid NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
        order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
        quantity int NOT NULL,
        reason return_reason,
        condition_notes text,
        restockable boolean NOT NULL DEFAULT true,
        received_quantity int,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items (return_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_items_order_item_id ON return_items (order_item_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS return_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        return_id uuid NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
        type return_event_type NOT NULL DEFAULT 'NOTE',
        status return_status,
        description text,
        metadata jsonb,
        occurred_at timestamptz NOT NULL,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_events_return_id ON return_events (return_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_return_events_occurred_at ON return_events (occurred_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_events_occurred_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_events_return_id');
    await queryRunner.query('DROP TABLE IF EXISTS return_events');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_items_order_item_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_items_return_id');
    await queryRunner.query('DROP TABLE IF EXISTS return_items');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_requests_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_requests_user_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_requests_order_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_return_requests_rma_number');
    await queryRunner.query('DROP TABLE IF EXISTS return_requests');
    await queryRunner.query('DROP TYPE IF EXISTS refund_method');
    await queryRunner.query('DROP TYPE IF EXISTS return_event_type');
    await queryRunner.query('DROP TYPE IF EXISTS return_reason');
    await queryRunner.query('DROP TYPE IF EXISTS return_status');
  }
}
