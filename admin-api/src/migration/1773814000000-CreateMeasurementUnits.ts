import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeasurementUnits1773814000000 implements MigrationInterface {
  name = 'CreateMeasurementUnits1773814000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS measurement_units (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(30) NOT NULL UNIQUE,
        label varchar(120) NOT NULL,
        family varchar(30) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        display_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO measurement_units (code, label, family, is_active, display_order)
      VALUES
        ('mcg', 'Microgramos', 'weight', true, 0),
        ('mg', 'Miligramos', 'weight', true, 1),
        ('g', 'Gramos', 'weight', true, 2),
        ('kg', 'Kilogramos', 'weight', true, 3),
        ('lb', 'Libras', 'weight', true, 4),
        ('oz', 'Onzas', 'weight', true, 5),
        ('st', 'Stone', 'weight', true, 6),
        ('t', 'Toneladas', 'weight', true, 7),

        ('mm', 'Milimetros', 'length', true, 10),
        ('cm', 'Centimetros', 'length', true, 11),
        ('m', 'Metros', 'length', true, 12),
        ('km', 'Kilometros', 'length', true, 13),
        ('in', 'Pulgadas', 'length', true, 14),
        ('ft', 'Pies', 'length', true, 15),
        ('yd', 'Yardas', 'length', true, 16),
        ('mi', 'Millas', 'length', true, 17),

        ('ml', 'Mililitros', 'volume', true, 20),
        ('l', 'Litros', 'volume', true, 21),
        ('m3', 'Metros cubicos', 'volume', true, 22),
        ('fl oz', 'Onzas fluidas', 'volume', true, 23),
        ('cc', 'Centimetros cubicos', 'volume', true, 24),
        ('gal', 'Galones', 'volume', true, 25),
        ('qt', 'Cuartos', 'volume', true, 26),
        ('pt', 'Pintas', 'volume', true, 27),

        ('cm2', 'Centimetros cuadrados', 'area', true, 30),
        ('m2', 'Metros cuadrados', 'area', true, 31),
        ('ha', 'Hectareas', 'area', true, 32),

        ('u', 'Unidades', 'count', true, 40),
        ('pack', 'Packs', 'count', true, 41),
        ('par', 'Pares', 'count', true, 42),

        ('c', 'Celsius', 'temperature', true, 50),
        ('f', 'Fahrenheit', 'temperature', true, 51),

        ('min', 'Minutos', 'time', true, 60),
        ('h', 'Horas', 'time', true, 61),
        ('d', 'Dias', 'time', true, 62)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS measurement_units`);
  }
}
