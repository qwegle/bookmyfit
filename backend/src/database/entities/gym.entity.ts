import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type GymTier = 'standard' | 'premium' | 'corporate_exclusive';
export type GymStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'inactive';

@Entity('gyms')
export class GymEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 200 })
  name: string;

  @Index()
  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  area: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ length: 20, nullable: true })
  pinCode: string | null;

  @Column({ length: 30, nullable: true })
  contactPhone: string | null;

  @Column({ length: 150, nullable: true })
  contactEmail: string | null;

  @Column({ length: 255, nullable: true })
  website: string | null;

  @Column({ length: 5, default: '06:00' })
  openingTime: string;

  @Column({ length: 5, default: '22:00' })
  closingTime: string;

  @Column({ length: 5, nullable: true })
  breakStartTime: string | null;

  @Column({ length: 5, nullable: true })
  breakEndTime: string | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ length: 30, default: 'standard' })
  tier: GymTier;

  @Column({ type: 'float', default: 0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;

  @Column({ length: 20, default: 'pending' })
  status: GymStatus;

  @Column({ type: 'float', default: 15 })
  commissionRate: number;

  @Column({ type: 'text', nullable: true })
  coverPhoto: string;

  @Column({ type: 'text', array: true, default: [] })
  photos: string[];

  @Column({ type: 'text', array: true, default: [] })
  amenities: string[];

  @Column({ type: 'text', array: true, default: [] })
  categories: string[];

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 50 })
  ratePerDay: number; // How much BMF pays this gym per customer-visit-day (multi-gym plans)

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  dayPassPrice: number | null; // null = use platform default (149)

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  sameGymMonthlyPrice: number | null; // null = use platform default (999)

  @Column({ default: 100 })
  capacity: number; // max capacity for live count display

  @Column({ type: 'uuid', nullable: true })
  ownerId: string;

  @Column({ type: 'jsonb', nullable: true })
  kycDocuments: Array<{
    name: string;
    url?: string;
    type: string;
    fields?: Record<string, any>;
    status?: 'in_review' | 'approved' | 'rejected';
    uploadedAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNote?: string;
  }> | null;

  @Column({ nullable: true, default: 'not_started' })
  kycStatus: string; // not_started, in_review, approved, rejected

  @Column({ type: 'text', nullable: true })
  kycReviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import { Entity as GymPlanEntityDecorator, PrimaryGeneratedColumn as PGUID, Column as Col, CreateDateColumn as CDC, Index as Idx } from 'typeorm';

import { Entity as E2, PrimaryGeneratedColumn as PG2, Column as C2, CreateDateColumn as CDC2, Index as I2 } from 'typeorm';

/** Gyms that are part of the multi-gym pass network */
@E2('multi_gym_network')
export class MultiGymNetworkEntity {
  @PG2('uuid') id: string;
  @I2() @C2({ type: 'uuid' }) gymId: string;
  @C2({ default: true }) isActive: boolean;
  @CDC2() addedAt: Date;
}

/** Gym-specific individual subscription plans managed by the gym owner */
@GymPlanEntityDecorator('gym_plans')
export class GymPlanEntity {
  @PGUID('uuid') id: string;
  @Idx() @Col({ type: 'uuid' }) gymId: string;
  @Col({ length: 150 }) name: string;
  @Col({ type: 'text', nullable: true }) description: string;
  @Col({ type: 'numeric', precision: 10, scale: 2 }) price: number;
  @Col({ default: 30 }) durationDays: number;
  @Col({ default: 1 }) sessionsPerDay: number; // how many sessions per day (usually 1)
  @Col({ type: 'text', array: true, default: [] }) features: string[];
  @Col({ default: true }) isActive: boolean;
  @CDC() createdAt: Date;
}
