import { useState, useEffect, useRef } from 'react';
import {
  Alert, ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Image, FlatList, Dimensions, ActivityIndicator, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import {
  IconArrowLeft, IconStar, IconPin, IconHeart, IconChevronRight,
  IconShield, IconCheck, IconBuilding, IconHeadphones, IconBolt,
} from '../components/Icons';
import { API_BASE as API } from '../lib/api';
import {
  wellnessPartnerImage,
  wellnessServiceImage,
} from '../lib/imageFallbacks';

const { width: W } = Dimensions.get('window');

function getPartnerImage(partner: any): string {
  return wellnessPartnerImage(partner);
}

// Static hero slides
const HERO_SLIDES = [
  {
    uri: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=900&q=80',
    kicker: 'SELF CARE IS HEALTH CARE',
    title: 'Relax Your Body',
    titleAccent: 'Refresh Your Mind',
    subtitle: 'Premium spa experiences for your well-being.',
  },
  {
    uri: 'https://images.unsplash.com/photo-1559756994-9df0adf7bff9?w=900&q=80',
    kicker: 'PROFESSIONAL CARE',
    title: 'Expert Therapists',
    titleAccent: 'Near You',
    subtitle: 'Certified professionals, premium products, peaceful spaces',
  },
];

type ApiPartner = {
  id: string; name: string; serviceType: string; city: string; area: string;
  rating: number; reviewCount: number; distanceLabel: string; photos: string[];
  discountPercent?: number;
};
type ApiService = {
  id: string; name: string; durationMinutes: number; price: number;
  imageUrl?: string; partnerId: string;
};

export default function WellnessScreen() {
  const [partners, setPartners] = useState<ApiPartner[]>([]);
  const [services, setServices] = useState<ApiService[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'spa' | 'home'>('all');
  const heroRef = useRef<FlatList>(null);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { width: screenW } = useWindowDimensions();
  const heroW = Math.max(1, Math.round(screenW || W));

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/v1/wellness/partners?page=1&limit=20`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/v1/wellness/services/all`).then(r => r.json()).catch(() => null),
    ]).then(([pRes, sRes]) => {
      const pts = pRes?.data || pRes;
      const svcs = sRes;
      if (Array.isArray(pts) && pts.length > 0) setPartners(pts);
      if (Array.isArray(svcs) && svcs.length > 0) setServices(svcs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    heroTimer.current = setInterval(() => {
      setHeroIndex(i => {
        const next = (i + 1) % HERO_SLIDES.length;
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => { if (heroTimer.current) clearInterval(heroTimer.current); };
  }, []);

  const toggleLike = (id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Get min price for a partner from services
  const getMinPrice = (partnerId: string): number | null => {
    const partnerServices = services.filter(s => s.partnerId === partnerId);
    if (partnerServices.length === 0) return null;
    return Math.min(...partnerServices.map(s => Number(s.price)));
  };

  const displayPartners: ApiPartner[] = partners;
  const displayServices: ApiService[] = services;
  const filteredServices = displayServices;

  const partnersByType = activeFilter === 'all'
    ? displayPartners
    : displayPartners.filter(p => {
        const type = (p.serviceType || '').toLowerCase();
        if (activeFilter === 'home') return type === 'home' || type.includes('home');
        return type !== 'home' && !type.includes('home');
      });
  const filteredPartners = partnersByType;

  // Partner tags based on service type
  const getPartnerTags = (partner: ApiPartner) => {
    const type = partner.serviceType?.toLowerCase() || 'spa';
    if (type === 'physio') return ['Physiotherapy', 'Rehab', 'Sports'];
    if (type === 'massage') return ['Massage', 'Relaxation', 'Deep Tissue'];
    if (type === 'home') return ['Home Service', 'At-Home', 'Private'];
    return ['Spa', 'Relaxation', 'Luxury'];
  };

  return (
    <SafeAreaView style={s.root} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Spa & Recovery</Text>
            <Text style={s.headerSubtitle}>Relax. Rejuvenate. Refresh.</Text>
          </View>
          <View style={s.headerRight} />
        </View>

        {/* Hero Slider */}
        <View style={s.heroContainer}>
          <FlatList
            key={`wellness-hero-${heroW}`}
            ref={heroRef}
            data={HERO_SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / heroW);
              setHeroIndex(Math.min(HERO_SLIDES.length - 1, Math.max(0, idx)));
            }}
            getItemLayout={(_, index) => ({ length: heroW, offset: heroW * index, index })}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => heroRef.current?.scrollToOffset({ offset: heroW * info.index, animated: true }), 80);
            }}
            renderItem={({ item }) => (
              <View style={[s.heroSlide, { width: heroW }]}>
                <Image source={{ uri: item.uri }} style={[s.heroImage, { width: heroW }]} />
                <View style={s.heroOverlay} />
                <View style={s.heroContent}>
                  <Text style={s.heroKicker}>{item.kicker}</Text>
                  <Text style={s.heroTitle}>{item.title}</Text>
                  <Text style={s.heroTitleAccent}>{item.titleAccent}</Text>
                  <Text style={s.heroSub}>{item.subtitle}</Text>
                </View>
              </View>
            )}
          />
          {/* Dots */}
          <View style={s.heroDots}>
            {HERO_SLIDES.map((_, i) => (
              <View key={i} style={[s.heroDot, i === heroIndex && s.heroDotActive]} />
            ))}
          </View>
        </View>

        {/* Choose Your Service Type */}
        <Text style={s.sectionTitle}>Choose Your Service Type</Text>
        <View style={s.serviceTypeRow}>
          {/* Spa Centre */}
          <TouchableOpacity style={s.serviceTypeCard} activeOpacity={0.85} onPress={() => router.push('/spa-centres' as any)}>
            <View style={[s.serviceTypeIconBox, { backgroundColor: 'rgba(0,212,106,0.08)' }]}>
              <IconBuilding size={24} color={colors.accent} />
            </View>
            <Text style={s.serviceTypeName}>Spa Centre</Text>
            <Text style={s.serviceTypeSub}>Visit our partner spa centres</Text>
            <View style={{ alignSelf: 'flex-end', marginTop: 6 }}>
              <IconChevronRight size={14} color={colors.accent} />
            </View>
          </TouchableOpacity>

          {/* Home Service */}
          <TouchableOpacity style={[s.serviceTypeCard, s.serviceTypeCardPurple]} activeOpacity={0.85} onPress={() => router.push('/home-services' as any)}>
            <View style={[s.serviceTypeIconBox, { backgroundColor: 'rgba(155,0,255,0.12)' }]}>
              <IconShield size={24} color={colors.tierPremium} />
            </View>
            <Text style={s.serviceTypeName}>Home Service</Text>
            <Text style={s.serviceTypeSub}>Professional spa at your home</Text>
            <View style={{ alignSelf: 'flex-end', marginTop: 6 }}>
              <IconChevronRight size={14} color={colors.tierPremium} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Popular Spa Services */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Popular Spa Services</Text>
          <TouchableOpacity onPress={() => router.push('/spa-centres' as any)}><Text style={s.seeAll}>See all</Text></TouchableOpacity>
        </View>
        <FlatList
          data={filteredServices}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={s.servicesScroll}
          renderItem={({ item: svc }) => {
            const imgUri = wellnessServiceImage(svc);
            return (
              <TouchableOpacity
                style={s.svcCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (svc.partnerId) {
                    router.push({
                      pathname: '/wellness/book-service',
                      params: {
                        serviceId: svc.id,
                        partnerId: svc.partnerId,
                        serviceName: svc.name,
                        price: String(svc.price),
                        duration: String(svc.durationMinutes),
                      },
                    } as any);
                  } else {
                    Alert.alert('Service unavailable', 'This service is not linked to a wellness partner yet.');
                  }
                }}
              >
                <Image source={{ uri: imgUri }} style={s.svcImage} />
                <View style={s.svcInfo}>
                  <Text style={s.svcName} numberOfLines={1}>{svc.name}</Text>
                  <Text style={s.svcMeta}>{svc.durationMinutes} Min • ₹{Number(svc.price).toLocaleString('en-IN')}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Filter Tabs */}
        <View style={s.filterTabs}>
          {(['all', 'spa', 'home'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, activeFilter === f && s.filterTabActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[s.filterTabText, activeFilter === f && s.filterTabTextActive]}>
                {f === 'all' ? 'All' : f === 'spa' ? 'Spa Centre' : 'Home Service'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top Spa Centres */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Top Spa Centres Near You</Text>
          <TouchableOpacity onPress={() => router.push('/spa-centres' as any)}><Text style={s.seeAll}>See all</Text></TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : (
          filteredPartners.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyTitle}>No wellness services found</Text>
              <Text style={s.emptyText}>No providers are available for this filter right now.</Text>
            </View>
          ) : filteredPartners.map((partner) => {
            const minPrice = getMinPrice(partner.id);
            const imgUri = getPartnerImage(partner);
            const liked = likedIds.has(partner.id);
            const tags = getPartnerTags(partner);
            return (
              <TouchableOpacity
                key={partner.id}
                style={s.partnerCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/wellness/${partner.id}` as any)}
              >
                {/* Left image */}
                <View style={s.partnerImgWrapper}>
                  <Image source={{ uri: imgUri }} style={s.partnerImg} />
                  {/* Discount badge */}
                  {!!partner.discountPercent && partner.discountPercent > 0 && (
                    <View style={s.discountBadge}>
                      <Text style={s.discountBadgeText}>{partner.discountPercent}% OFF</Text>
                    </View>
                  )}
                  {/* Heart */}
                  <TouchableOpacity style={s.heartBtn} onPress={() => toggleLike(partner.id)}>
                    <IconHeart size={14} color={liked ? '#ff4d6d' : '#fff'} filled={liked} />
                  </TouchableOpacity>
                </View>

                {/* Right info */}
                <View style={s.partnerInfo}>
                  {/* Row 1: name + price */}
                  <View style={s.partnerRow1}>
                    <Text style={s.partnerName} numberOfLines={1}>{partner.name}</Text>
                    <View style={s.priceBlock}>
                      <Text style={s.priceFrom}>From</Text>
                      <Text style={s.priceVal}>{minPrice ? `₹${Number(minPrice).toLocaleString('en-IN')}` : 'Not added'}</Text>
                    </View>
                  </View>

                  {/* Row 2: rating */}
                  <View style={s.ratingRow}>
                    <IconStar size={12} color={colors.star} />
                    <Text style={s.ratingText}>{partner.rating ? partner.rating.toFixed(1) : '--'}</Text>
                    <Text style={s.reviewCount}>({partner.reviewCount || 0} reviews)</Text>
                  </View>

                  {/* Row 3: location */}
                  <View style={s.locationRow}>
                    <IconPin size={12} color={colors.t2} />
                    <Text style={s.locationText}>{partner.area}, {partner.city}{partner.distanceLabel ? ` • ${partner.distanceLabel}` : ''}</Text>
                  </View>

                  {/* Row 4: tags */}
                  <View style={s.tagsRow}>
                    {tags.slice(0, 3).map((tag, ti) => (
                      <View key={ti} style={s.tagPill}>
                        <Text style={s.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Row 5: View Services button */}
                  <View style={s.viewRow}>
                    <TouchableOpacity
                      style={s.viewBtn}
                      onPress={() => router.push(`/wellness/${partner.id}` as any)}
                      accessibilityRole="button"
                      accessibilityLabel={`View services for ${partner.name}`}
                    >
                      <Text style={s.viewBtnText}>View Services</Text>
                      <IconChevronRight size={12} color={colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Trust Strip */}
        <View style={s.trustStrip}>
          {[
            { icon: 'shield', label: 'Verified Spa Partners' },
            { icon: 'check', label: 'Trained & Certified' },
            { icon: 'shield', label: 'Hygienic & Safe' },
            { icon: 'bolt', label: 'Easy Booking' },
            { icon: 'headphones', label: '24/7 Support' },
          ].map((item, i) => (
            <View key={i} style={s.trustItem}>
              <View style={s.trustIconBox}>
                {item.icon === 'shield' && <IconShield size={12} color={colors.accent} />}
                {item.icon === 'check' && <IconCheck size={12} color={colors.accent} />}
                {item.icon === 'bolt' && <IconBolt size={12} color={colors.accent} />}
                {item.icon === 'headphones' && <IconHeadphones size={12} color={colors.accent} />}
              </View>
              <Text style={s.trustLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 24 : 0 },
  content: { paddingBottom: 16 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  back: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff' },
  headerSubtitle: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginTop: 1 },
  headerRight: { width: 38 },
  cartBadge: {
    position: 'absolute', top: 5, right: 5,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF6B35',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: '#fff' },

  // Hero
  heroContainer: { width: '100%', height: 212, marginBottom: 22 },
  heroSlide: { height: 212, overflow: 'hidden' },
  heroImage: { height: 212, resizeMode: 'cover', backgroundColor: colors.surface },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  heroContent: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  heroKicker: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  heroTitle: { fontFamily: fonts.serif, fontSize: 26, color: '#fff', lineHeight: 30 },
  heroTitleAccent: { fontFamily: fonts.serif, fontSize: 26, color: colors.accent, lineHeight: 30, marginBottom: 8 },
  heroSub: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  heroDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -18, marginBottom: 8 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroDotActive: { backgroundColor: colors.accent, width: 18 },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 20, color: '#fff', paddingHorizontal: 16, marginBottom: 12, marginTop: 4 },
  seeAll: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent },

  // Filter tabs
  filterTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16, marginTop: 4 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: { backgroundColor: 'rgba(0,212,106,0.15)', borderColor: 'rgba(0,212,106,0.4)' },
  filterTabText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t2 },
  filterTabTextActive: { color: colors.accent },

  // Service Type cards — side-by-side
  serviceTypeRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 28 },
  serviceTypeCard: {
    flex: 1, gap: 4,
    backgroundColor: 'rgba(0,212,106,0.05)', borderWidth: 1, borderColor: 'rgba(0,212,106,0.3)',
    borderRadius: 16, padding: 16,
  },
  serviceTypeCardPurple: {
    backgroundColor: 'rgba(130,80,255,0.06)', borderColor: 'rgba(130,80,255,0.3)',
  },
  serviceTypeIconBox: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  serviceTypeText: { flex: 1 },
  serviceTypeName: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', marginBottom: 2 },
  serviceTypeSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },

  // Popular Services scroll
  servicesScroll: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  svcCard: {
    width: 130, borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  svcImage: { width: 130, height: 110, resizeMode: 'cover' },
  svcInfo: { padding: 8 },
  svcName: { fontFamily: fonts.sansBold, fontSize: 12, color: '#fff', marginBottom: 3 },
  svcMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  emptyState: {
    marginHorizontal: 16, marginBottom: 16, padding: 18, alignItems: 'center',
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff', marginBottom: 4 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, textAlign: 'center' },

  // Partner cards
  partnerCard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', overflow: 'hidden',
    minHeight: 166,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  partnerImgWrapper: { width: 122, minHeight: 166, position: 'relative', backgroundColor: colors.surface },
  partnerImg: { width: 122, minHeight: 166, height: '100%', resizeMode: 'cover', backgroundColor: colors.surface },
  discountBadge: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: '#00D46A', paddingHorizontal: 6, paddingVertical: 3,
    borderBottomRightRadius: 8,
  },
  discountBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: '#060606' },
  heartBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },

  partnerInfo: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  partnerRow1: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  partnerName: { flex: 1, minWidth: 0, fontFamily: fonts.sansBold, fontSize: 14, lineHeight: 18, color: '#fff' },
  priceBlock: { alignItems: 'flex-end' },
  priceFrom: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2 },
  priceVal: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.accent },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.star },
  reviewCount: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, flex: 1 },

  tagsRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  tagPill: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2 },

  viewRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 'auto' },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 36,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  viewBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent },

  // Trust strip
  trustStrip: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 16,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 16, gap: 10, justifyContent: 'space-around',
  },
  trustItem: { alignItems: 'center', gap: 6, width: '18%' },
  trustIconBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,212,106,0.1)', borderWidth: 1, borderColor: 'rgba(0,212,106,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  trustLabel: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2, textAlign: 'center' },
});
