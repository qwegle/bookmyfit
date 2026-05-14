import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWellnessServiceApproval1778300000000 implements MigrationInterface {
  name = 'AddWellnessServiceApproval1778300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wellness_services"
      ADD COLUMN IF NOT EXISTS "approvalStatus" varchar(20) NOT NULL DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS "reviewNote" text
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_wellness_services_approvalStatus" ON "wellness_services" ("approvalStatus")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_wellness_services_approvalStatus"');
    await queryRunner.query('ALTER TABLE "wellness_services" DROP COLUMN IF EXISTS "reviewNote"');
    await queryRunner.query('ALTER TABLE "wellness_services" DROP COLUMN IF EXISTS "approvalStatus"');
  }
}
