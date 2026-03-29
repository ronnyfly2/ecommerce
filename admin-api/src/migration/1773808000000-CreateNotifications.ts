import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1773808000000 implements MigrationInterface {
  name = 'CreateNotifications1773808000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'notifications_type_enum'
        ) THEN
          CREATE TYPE "public"."notifications_type_enum" AS ENUM(
            'USER_REGISTERED',
            'ORDER_CREATED',
            'ORDER_STATUS_CHANGED'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_user_id" uuid NOT NULL,
        "actor_user_id" uuid,
        "type" "public"."notifications_type_enum" NOT NULL,
        "title" character varying(140) NOT NULL,
        "message" text NOT NULL,
        "link" character varying,
        "metadata" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient_created"
      ON "notifications" ("recipient_user_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient_is_read"
      ON "notifications" ("recipient_user_id", "is_read")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_notifications_recipient_user'
        ) THEN
          ALTER TABLE "notifications"
          ADD CONSTRAINT "FK_notifications_recipient_user"
          FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_notifications_actor_user'
        ) THEN
          ALTER TABLE "notifications"
          ADD CONSTRAINT "FK_notifications_actor_user"
          FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_actor_user"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_recipient_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_recipient_is_read"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_recipient_created"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
  }
}
