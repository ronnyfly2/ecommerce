import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShipments1774600000000 implements MigrationInterface {
  name = 'CreateShipments1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE shipment_status AS ENUM (
          'PENDING', 'READY_TO_SHIP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
          'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE shipment_event_type AS ENUM (
          'STATUS_CHANGE', 'LOCATION_UPDATE', 'NOTE', 'EXCEPTION'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS carriers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(80) NOT NULL,
        label varchar(120) NOT NULL,
        description text,
        tracking_url_template text,
        is_enabled boolean NOT NULL DEFAULT true,
        display_order int NOT NULL DEFAULT 0,
        logo_url text,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_carriers_code ON carriers (code)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        carrier_id uuid REFERENCES carriers(id) ON DELETE SET NULL,
        status shipment_status NOT NULL DEFAULT 'PENDING',
        tracking_number varchar(120),
        tracking_url text,
        shipping_cost numeric(12, 2) NOT NULL DEFAULT 0,
        currency_code varchar(3) NOT NULL DEFAULT 'USD',
        ship_to_name varchar(200),
        ship_to_street varchar(200),
        ship_to_city varchar(120),
        ship_to_state varchar(120),
        ship_to_postal_code varchar(30),
        ship_to_country varchar(120),
        ship_to_phone varchar(40),
        ship_to_lat numeric(10, 6),
        ship_to_lng numeric(10, 6),
        estimated_delivery_at timestamptz,
        shipped_at timestamptz,
        delivered_at timestamptz,
        notes text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments (order_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments (tracking_number)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shipment_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
        quantity int NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items (shipment_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipment_items_order_item_id ON shipment_items (order_item_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shipment_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        type shipment_event_type NOT NULL DEFAULT 'NOTE',
        status shipment_status,
        location varchar(200),
        lat numeric(10, 6),
        lng numeric(10, 6),
        description text,
        occurred_at timestamptz NOT NULL,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON shipment_events (shipment_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_shipment_events_occurred_at ON shipment_events (occurred_at)
    `);

    await queryRunner.query(`
      INSERT INTO carriers (code, label, description, tracking_url_template, is_enabled, display_order, config)
      VALUES
        ('manual', 'Envio manual', 'Seguimiento manual actualizado por el equipo', NULL, true, 1, '{}'::jsonb),
        ('shalom', 'Shalom', 'Transporte Shalom', 'https://www.shalom.com.pe/seguimiento?codigo={tracking}', true, 2, '{}'::jsonb),
        ('olva', 'Olva Courier', 'Olva Courier nacional', 'https://www.olvacourier.com/tracking?guia={tracking}', true, 3, '{}'::jsonb),
        ('dhl', 'DHL Express', 'Envio internacional', 'https://www.dhl.com/en/express/tracking.html?AWB={tracking}', false, 4, '{}'::jsonb)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipment_events_occurred_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipment_events_shipment_id');
    await queryRunner.query('DROP TABLE IF EXISTS shipment_events');
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipment_items_order_item_id');
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipment_items_shipment_id');
    await queryRunner.query('DROP TABLE IF EXISTS shipment_items');
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipments_tracking_number');
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipments_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_shipments_order_id');
    await queryRunner.query('DROP TABLE IF EXISTS shipments');
    await queryRunner.query('DROP INDEX IF EXISTS idx_carriers_code');
    await queryRunner.query('DROP TABLE IF EXISTS carriers');
    await queryRunner.query('DROP TYPE IF EXISTS shipment_event_type');
    await queryRunner.query('DROP TYPE IF EXISTS shipment_status');
  }
}
