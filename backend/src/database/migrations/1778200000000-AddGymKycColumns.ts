import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGymKycColumns1778200000000 implements MigrationInterface {
  name = 'AddGymKycColumns1778200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gyms"
      ADD COLUMN IF NOT EXISTS "kycDocuments" jsonb,
      ADD COLUMN IF NOT EXISTS "kycStatus" varchar DEFAULT 'not_started'
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_gyms_kycStatus" ON "gyms" ("kycStatus")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_gyms_kycStatus"');
    await queryRunner.query('ALTER TABLE "gyms" DROP COLUMN IF EXISTS "kycStatus"');
    await queryRunner.query('ALTER TABLE "gyms" DROP COLUMN IF EXISTS "kycDocuments"');
  }
}
