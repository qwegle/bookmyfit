import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './entities/user.entity';
import { GymEntity } from './entities/gym.entity';
import { ProductEntity } from './entities/store.entity';
import { CorporateAccountEntity } from './entities/corporate.entity';
import { WorkoutVideoEntity } from './entities/misc.entity';
import { WellnessPartnerEntity, WellnessServiceEntity } from './entities/wellness.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('Seed');
  constructor(
    @InjectRepository(UserEntity) private users: Repository<UserEntity>,
    @InjectRepository(GymEntity) private gyms: Repository<GymEntity>,
    @InjectRepository(ProductEntity) private products: Repository<ProductEntity>,
    @InjectRepository(CorporateAccountEntity) private corps: Repository<CorporateAccountEntity>,
    @InjectRepository(WorkoutVideoEntity) private videos: Repository<WorkoutVideoEntity>,
    @InjectRepository(WellnessPartnerEntity) private wellnessPartners: Repository<WellnessPartnerEntity>,
    @InjectRepository(WellnessServiceEntity) private wellnessServices: Repository<WellnessServiceEntity>,
  ) {}

  async onApplicationBootstrap() {
    const seedEnabled = process.env.SEED_ON_BOOT === 'true';
    if (!seedEnabled) {
      this.log.log('Seed on boot disabled. Set SEED_ON_BOOT=true only for local/demo setup.');
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      this.log.warn('SEED_ON_BOOT=true ignored in production.');
      return;
    }
    await this.seedUsers();
    await this.seedGyms();
    await this.seedBBSRGyms();
    await this.seedWellness();
    await this.seedProducts();
    await this.seedCorporates();
    await this.seedVideos();
    await this.linkGymOwner();
    this.log.log('Seed data ready');
  }

  private async seedUsers() {
    const seeds = [
      { email: 'admin@bookmyfit.in', phone: '9000000001', name: 'Super Admin', role: 'super_admin' as const, password: 'admin123' },
      { email: 'gym@bookmyfit.in', phone: '9000000002', name: 'Gym Owner', role: 'gym_owner' as const, password: 'gym123' },
      { email: 'staff@bookmyfit.in', phone: '9000000003', name: 'Gym Staff', role: 'gym_staff' as const, password: 'staff123' },
      { email: 'hr@techcorp.in', phone: '9000000004', name: 'HR Admin', role: 'corporate_admin' as const, password: 'hr1234' },
    ];
    for (const u of seeds) {
      const existing = await this.users.findOne({ where: { email: u.email } });
      if (existing) {
        if (u.email === 'hr@techcorp.in') {
          const hasExpectedPassword = existing.passwordHash
            ? await bcrypt.compare(u.password, existing.passwordHash)
            : false;
          if (!hasExpectedPassword) {
            existing.passwordHash = await bcrypt.hash(u.password, 10);
            await this.users.save(existing);
            this.log.log(`Updated seeded corporate login: ${u.email} / ${u.password}`);
          }
        }
        continue;
      }
      await this.users.save(this.users.create({
        email: u.email, phone: u.phone, name: u.name, role: u.role,
        passwordHash: await bcrypt.hash(u.password, 10),
      }));
      this.log.log(`Seeded user: ${u.email} / ${u.password}`);
    }
  }

  private async seedGyms() {
    if ((await this.gyms.count()) > 0) return;
    const gyms = [
      { name: 'PowerZone Fitness', city: 'Mumbai', area: 'Bandra West', address: 'Linking Rd, Bandra West, Mumbai', lat: 19.0596, lng: 72.8295, tier: 'corporate_exclusive' as const, rating: 4.8, ratingCount: 218, status: 'active' as const, commissionRate: 20, amenities: ['AC', 'Parking', 'Shower', 'Locker', 'Steam Room', 'Pool'], categories: ['Cardio', 'Weights', 'CrossFit'] },
      { name: 'FitHub Pro', city: 'Mumbai', area: 'Powai', address: 'Hiranandani, Powai, Mumbai', lat: 19.1176, lng: 72.9060, tier: 'premium' as const, rating: 4.6, ratingCount: 142, status: 'active' as const, commissionRate: 18, amenities: ['AC', 'Parking', 'Shower', 'Locker'], categories: ['Cardio', 'Weights'] },
      { name: 'IronBody Gym', city: 'Bangalore', area: 'HSR Layout', address: '27th Main, HSR Layout, Bangalore', lat: 12.9116, lng: 77.6383, tier: 'standard' as const, rating: 4.3, ratingCount: 87, status: 'active' as const, commissionRate: 15, amenities: ['Parking', 'Shower', 'Locker'], categories: ['Weights'] },
      { name: 'AquaFit Centre', city: 'Mumbai', area: 'Andheri West', address: 'Lokhandwala, Andheri W, Mumbai', lat: 19.1368, lng: 72.8301, tier: 'premium' as const, rating: 4.5, ratingCount: 96, status: 'active' as const, commissionRate: 18, amenities: ['AC', 'Parking', 'Pool', 'Shower', 'Locker'], categories: ['Pool', 'Cardio'] },
      { name: 'CrossTown Arena', city: 'Delhi', area: 'Saket', address: 'Select Citywalk, Saket, Delhi', lat: 28.5286, lng: 77.2196, tier: 'corporate_exclusive' as const, rating: 4.7, ratingCount: 184, status: 'active' as const, commissionRate: 20, amenities: ['AC', 'Parking', 'Shower', 'Locker', 'Sauna', 'CrossFit Zone'], categories: ['CrossFit', 'Weights', 'Cardio'] },
    ];
    await this.gyms.save(this.gyms.create(gyms));
    this.log.log(`Seeded ${gyms.length} gyms`);
  }

  private async seedProducts() {
    if ((await this.products.count()) > 0) return;
    const items = [
      { name: 'Whey Pro 2kg', category: 'supplements', price: 2199, mrp: 2999, stock: 50, images: ['https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400'], description: 'Premium whey protein isolate by MuscleBlaze' },
      { name: 'Pro Shaker Cup', category: 'accessories', price: 449, mrp: 599, stock: 120, images: ['https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400'], description: 'BPA-free shaker bottle by GNC Sports' },
      { name: 'Lifting Gloves', category: 'accessories', price: 799, mrp: 1199, stock: 80, images: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400'], description: 'Padded training gloves by Harbinger' },
      { name: 'Resistance Band Set', category: 'equipment', price: 599, mrp: 899, stock: 60, images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'], description: '5-level resistance bands by Boldfit' },
      { name: 'BCAA 250g', category: 'supplements', price: 899, mrp: 1299, stock: 40, images: ['https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=400'], description: 'Essential amino acid blend by AS-IT-IS' },
      { name: 'Training T-Shirt', category: 'apparel', price: 649, mrp: 999, stock: 150, images: ['https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400'], description: 'Dry-fit performance tee by Nivia Sports' },
    ];
    await this.products.save(this.products.create(items as any));
    this.log.log(`Seeded ${items.length} products`);
  }

  private async seedCorporates() {
    if ((await this.corps.count()) > 0) {
      // Link admin user if not already linked
      const corp = await this.corps.findOne({ where: { companyName: 'TechCorp India' } });
      if (corp && !corp.adminUserId) {
        const hrUser = await this.users.findOne({ where: { email: 'hr@techcorp.in' } });
        if (hrUser) {
          await this.corps.update(corp.id, { adminUserId: hrUser.id });
          this.log.log(`Linked corporate admin ${hrUser.email} to TechCorp India`);
        }
      }
      return;
    }
    const hrUser = await this.users.findOne({ where: { email: 'hr@techcorp.in' } });
    await this.corps.save(this.corps.create({
      companyName: 'TechCorp India', email: 'billing@techcorp.in',
      planType: 'elite', totalSeats: 150, assignedSeats: 0,
      billingContact: 'HR Finance · +91 9000000004',
      adminUserId: hrUser?.id,
    }));
    this.log.log('Seeded TechCorp India corporate account');
  }

  private async seedVideos() {
    if ((await this.videos.count()) > 0) return;
    const items = [
      { title: 'Full Body HIIT - 20 Min', category: 'hiit', thumbnailUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400', videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', durationSeconds: 1200, isPremium: false, description: 'Burn calories with this no-equipment full body HIIT session' },
      { title: 'Beginner Yoga Flow', category: 'yoga', thumbnailUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400', videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', durationSeconds: 1800, isPremium: false, description: 'Morning yoga flow for beginners, 30 minutes' },
      { title: 'Advanced Chest & Triceps', category: 'strength', thumbnailUrl: 'https://images.unsplash.com/photo-1534368786749-b63e05c92717?w=400', videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', durationSeconds: 2700, isPremium: true, description: 'Heavy compound movements for chest and tricep hypertrophy' },
      { title: 'Core Stability & Abs', category: 'strength', thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', durationSeconds: 900, isPremium: false, description: 'Build a strong core with this 15-min ab circuit' },
      { title: 'Zumba Dance Cardio', category: 'cardio', thumbnailUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400', videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', durationSeconds: 1500, isPremium: false, description: 'Dance your way to fitness with upbeat Zumba' },
      { title: 'Elite Upper Body Split', category: 'strength', thumbnailUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400', videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', durationSeconds: 3600, isPremium: true, description: 'Pro-level upper body split for serious lifters' },
    ];
    await this.videos.save(this.videos.create(items as any));
    this.log.log(`Seeded ${items.length} workout videos`);
  }

  private async seedBBSRGyms() {
    const bbsrGyms = [
      { name: "Gold's Gym Bhubaneswar", city: 'Bhubaneswar', area: 'Chandrasekharpur', address: 'Jaydev Vihar Square, Chandrasekharpur, Bhubaneswar', lat: 20.3110, lng: 85.8186, tier: 'premium' as const, rating: 4.7, ratingCount: 186, status: 'active' as const, commissionRate: 18, amenities: ['AC', 'Parking', 'Shower', 'Locker', 'Sauna', 'Steam Room'], categories: ['Strength', 'Cardio', 'CrossFit'] },
      { name: 'Anytime Fitness Bhubaneswar', city: 'Bhubaneswar', area: 'Saheed Nagar', address: 'Saheed Nagar, Bhubaneswar, Odisha 751007', lat: 20.2888, lng: 85.8480, tier: 'premium' as const, rating: 4.5, ratingCount: 124, status: 'active' as const, commissionRate: 18, amenities: ['AC', 'Parking', 'Shower', 'Locker', '24/7 Access'], categories: ['Cardio', 'Strength'] },
      { name: 'Cult.fit Bhubaneswar', city: 'Bhubaneswar', area: 'Patia', address: 'Patia Square, Patia, Bhubaneswar 751024', lat: 20.3413, lng: 85.8157, tier: 'corporate_exclusive' as const, rating: 4.8, ratingCount: 312, status: 'active' as const, commissionRate: 20, amenities: ['AC', 'Parking', 'Shower', 'Locker', 'Pool', 'Steam Room'], categories: ['HIIT', 'Yoga', 'Cardio', 'Strength'] },
      { name: 'Iron House Gym', city: 'Bhubaneswar', area: 'Nayapalli', address: 'Nayapalli, Bhubaneswar, Odisha 751015', lat: 20.2820, lng: 85.8276, tier: 'standard' as const, rating: 4.4, ratingCount: 89, status: 'active' as const, commissionRate: 15, amenities: ['AC', 'Shower', 'Locker'], categories: ['Strength', 'Cardio'] },
      { name: 'CrossFit Bhubaneswar', city: 'Bhubaneswar', area: 'Jaydev Vihar', address: 'Jaydev Vihar, Bhubaneswar, Odisha 751013', lat: 20.3006, lng: 85.8290, tier: 'premium' as const, rating: 4.6, ratingCount: 143, status: 'active' as const, commissionRate: 18, amenities: ['AC', 'Parking', 'Shower'], categories: ['CrossFit', 'HIIT', 'Strength'] },
      { name: 'PowerHouse Fitness', city: 'Bhubaneswar', area: 'Khandagiri', address: 'Khandagiri Square, Bhubaneswar, Odisha 751030', lat: 20.2489, lng: 85.7829, tier: 'standard' as const, rating: 4.3, ratingCount: 76, status: 'active' as const, commissionRate: 15, amenities: ['AC', 'Shower', 'Locker', 'Parking'], categories: ['Strength', 'Cardio'] },
      { name: 'Fitness First Bhubaneswar', city: 'Bhubaneswar', area: 'IRC Village', address: 'IRC Village, Nayapalli, Bhubaneswar 751015', lat: 20.2996, lng: 85.8220, tier: 'premium' as const, rating: 4.5, ratingCount: 98, status: 'active' as const, commissionRate: 18, amenities: ['AC', 'Parking', 'Shower', 'Locker', 'Pool'], categories: ['Yoga', 'Cardio', 'Strength'] },
      { name: 'Flex Fitness Studio', city: 'Bhubaneswar', area: 'Damana', address: 'Damana Square, Bhubaneswar, Odisha 751024', lat: 20.3149, lng: 85.8170, tier: 'standard' as const, rating: 4.2, ratingCount: 54, status: 'active' as const, commissionRate: 15, amenities: ['AC', 'Shower'], categories: ['Strength', 'Zumba'] },
    ];
    for (const g of bbsrGyms) {
      const existing = await this.gyms.findOne({ where: { name: g.name } });
      if (existing) continue;
      await this.gyms.save(this.gyms.create(g as any));
      this.log.log(`Seeded BBSR gym: ${g.name}`);
    }
  }

  /** Link the seeded gym_owner user to PowerZone Fitness */
  private async linkGymOwner() {
    const owner = await this.users.findOne({ where: { email: 'gym@bookmyfit.in' } });
    if (!owner) return;
    const gym = await this.gyms.findOne({ where: { name: 'PowerZone Fitness' } });
    if (!gym) return;
    if (gym.ownerId === owner.id) return; // already linked
    await this.gyms.update(gym.id, { ownerId: owner.id });
    this.log.log(`Linked gym owner ${owner.email} to ${gym.name}`);
  }

  private async seedWellness() {
    if ((await this.wellnessPartners.count()) > 0) return;

    const partners = [
      { name: 'Serenity Spa & Wellness', serviceType: 'spa', city: 'Bhubaneswar', area: 'Saheed Nagar', address: 'Plot 42, Saheed Nagar, Bhubaneswar 751007', lat: 20.2888, lng: 85.8480, rating: 4.8, reviewCount: 142, commissionRate: 30, status: 'active', photos: ['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=900&q=80'], discountPercent: 20 },
      { name: 'Royal Bliss Spa', serviceType: 'spa', city: 'Bhubaneswar', area: 'Nayapalli', address: 'Nayapalli Main Road, Bhubaneswar 751015', lat: 20.2820, lng: 85.8276, rating: 4.6, reviewCount: 98, commissionRate: 30, status: 'active', photos: ['https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=900&q=80'], discountPercent: 0 },
      { name: 'Zen Wellness Club', serviceType: 'spa', city: 'Bhubaneswar', area: 'Jaydev Vihar', address: 'Jaydev Vihar, Bhubaneswar 751013', lat: 20.3006, lng: 85.8290, rating: 4.7, reviewCount: 211, commissionRate: 30, status: 'active', photos: ['https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=900&q=80'], discountPercent: 15 },
      { name: 'ZenTouch Home Spa', serviceType: 'home', city: 'Bhubaneswar', area: 'Saheed Nagar', address: 'Serves Bhubaneswar area', lat: 20.2888, lng: 85.8480, rating: 4.7, reviewCount: 86, commissionRate: 25, status: 'active', photos: ['https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900&q=80'], discountPercent: 10 },
      { name: 'BlissAt Home Wellness', serviceType: 'home', city: 'Bhubaneswar', area: 'Nayapalli', address: 'Serves Bhubaneswar area', lat: 20.2820, lng: 85.8276, rating: 4.5, reviewCount: 64, commissionRate: 25, status: 'active', photos: ['https://images.unsplash.com/photo-1610337673044-720471f83677?w=900&q=80'], discountPercent: 0 },
    ];

    const saved = await this.wellnessPartners.save(this.wellnessPartners.create(partners as any));
    this.log.log(`Seeded ${saved.length} wellness partners`);

    const servicesByName: Record<string, any[]> = {
      'Serenity Spa & Wellness': [
        { name: 'Swedish Massage', category: 'Massage', price: 1499, originalPrice: 1999, durationMinutes: 60, description: 'Full body relaxation with warm aromatic oils', imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&q=80' },
        { name: 'Deep Tissue Massage', category: 'Massage', price: 1999, originalPrice: 2499, durationMinutes: 90, description: 'Targets chronic muscle tension and knots', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80' },
        { name: 'Classic Facial', category: 'Facial', price: 999, originalPrice: 1299, durationMinutes: 45, description: 'Deep cleansing, exfoliation and hydration', imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80' },
        { name: 'Gold Facial', category: 'Facial', price: 1799, originalPrice: 2199, durationMinutes: 60, description: 'Luxury 24K gold anti-ageing treatment', imageUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400&q=80' },
        { name: 'Hot Stone Therapy', category: 'Massage', price: 2299, originalPrice: 2799, durationMinutes: 75, description: 'Heated basalt stones for deep muscle relaxation', imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80' },
        { name: 'Aromatherapy', category: 'Relaxation', price: 1299, originalPrice: null, durationMinutes: 60, description: 'Calming essential oil therapy', imageUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=400&q=80' },
      ],
      'Royal Bliss Spa': [
        { name: 'Royal Body Wrap', category: 'Body Treatment', price: 2499, originalPrice: 2999, durationMinutes: 90, description: 'Luxurious full body wrap with seaweed and mud', imageUrl: 'https://images.unsplash.com/photo-1610337673044-720471f83677?w=400&q=80' },
        { name: 'Thai Massage', category: 'Massage', price: 1699, originalPrice: 1999, durationMinutes: 75, description: 'Traditional Thai stretching and pressure point massage', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80' },
        { name: 'Manicure & Pedicure', category: 'Nail Care', price: 799, originalPrice: 999, durationMinutes: 90, description: 'Classic nail care with gel polish', imageUrl: 'https://images.unsplash.com/photo-1571019614099-9fdcf8b4e43b?w=400&q=80' },
        { name: 'Head & Scalp Massage', category: 'Massage', price: 699, originalPrice: null, durationMinutes: 30, description: 'Relieving scalp tension and headaches', imageUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=400&q=80' },
        { name: 'Couple Massage', category: 'Massage', price: 3499, originalPrice: 3999, durationMinutes: 60, description: 'Relaxing side-by-side Swedish massage for two', imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&q=80' },
      ],
      'Zen Wellness Club': [
        { name: 'Hydrating Facial', category: 'Facial', price: 1199, originalPrice: 1499, durationMinutes: 60, description: 'Intensive hydration and brightening facial', imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80' },
        { name: 'Shirodhara', category: 'Ayurveda', price: 2199, originalPrice: 2799, durationMinutes: 60, description: 'Warm oil stream on forehead for deep relaxation', imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80' },
        { name: 'Abhyanga Massage', category: 'Ayurveda', price: 1899, originalPrice: 2299, durationMinutes: 75, description: 'Traditional Ayurvedic full-body oil massage', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80' },
        { name: 'Anti-Stress Massage', category: 'Massage', price: 1599, originalPrice: null, durationMinutes: 60, description: 'Targeted stress relief for neck, shoulders and back', imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&q=80' },
        { name: 'Sauna Session', category: 'Relaxation', price: 599, originalPrice: 799, durationMinutes: 45, description: '45-min sauna session with towel and water', imageUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=400&q=80' },
      ],
      'ZenTouch Home Spa': [
        { name: 'Home Swedish Massage', category: 'Massage', price: 999, originalPrice: 1299, durationMinutes: 60, description: 'Full body massage at your home', imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&q=80' },
        { name: 'Home Facial', category: 'Facial', price: 799, originalPrice: 999, durationMinutes: 45, description: 'Classic facial at your doorstep', imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80' },
        { name: 'Home Manicure', category: 'Nail Care', price: 499, originalPrice: 599, durationMinutes: 60, description: 'Nail care with gel polish at home', imageUrl: 'https://images.unsplash.com/photo-1571019614099-9fdcf8b4e43b?w=400&q=80' },
        { name: 'Haircut & Blowdry', category: 'Hair', price: 699, originalPrice: 899, durationMinutes: 60, description: 'Professional haircut and styling at home', imageUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400&q=80' },
        { name: 'Waxing (Full Body)', category: 'Hair Removal', price: 1299, originalPrice: 1599, durationMinutes: 90, description: 'Full body waxing at your home', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80' },
      ],
      'BlissAt Home Wellness': [
        { name: 'Deep Tissue Home Massage', category: 'Massage', price: 1199, originalPrice: 1499, durationMinutes: 75, description: 'Therapeutic deep tissue massage at home', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80' },
        { name: 'Bridal Makeup', category: 'Makeup', price: 4999, originalPrice: 6999, durationMinutes: 120, description: 'Professional bridal makeup at home', imageUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=400&q=80' },
        { name: 'Party Makeup', category: 'Makeup', price: 1499, originalPrice: 1999, durationMinutes: 60, description: 'Glam party makeup at your home', imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80' },
        { name: 'Home Pedicure', category: 'Nail Care', price: 399, originalPrice: 499, durationMinutes: 45, description: 'Relaxing pedicure at your home', imageUrl: 'https://images.unsplash.com/photo-1571019614099-9fdcf8b4e43b?w=400&q=80' },
      ],
    };

    for (const partner of saved) {
      const services = servicesByName[partner.name];
      if (!services) continue;
      await this.wellnessServices.save(
        this.wellnessServices.create(services.map(s => ({ ...s, partnerId: partner.id, isActive: true })) as any)
      );
    }
    this.log.log('Seeded wellness partners and services');
  }
}
