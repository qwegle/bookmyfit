import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppConfig1778400000000 implements MigrationInterface {
  name = 'CreateAppConfig1778400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_config" (
        "key" varchar(100) PRIMARY KEY,
        "value" jsonb NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "app_config"');
  }
}
