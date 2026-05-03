import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnFleetCarrierPreset1775000000000 implements MigrationInterface {
  name = 'AddOwnFleetCarrierPreset1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO carriers (
        code,
        label,
        description,
        tracking_url_template,
        is_enabled,
        display_order,
        config
      )
      VALUES (
        'own-fleet',
        'Transporte propio',
        'Flota interna con seguimiento y operacion gestionada por la empresa',
        NULL,
        true,
        0,
        '{
          "operational": {
            "operationMode": "OWN_FLEET",
            "mapProvider": "OPENSTREETMAP",
            "geolocationMode": "MOBILE_APP",
            "supportsRealtimeTracking": true,
            "supportsRouteOptimization": true,
            "supportsProofOfDelivery": true,
            "defaultHubLat": null,
            "defaultHubLng": null,
            "dispatchContactPhone": null
          }
        }'::jsonb
      )
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM carriers
      WHERE code = 'own-fleet'
    `);
  }
}
