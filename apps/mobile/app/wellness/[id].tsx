import { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Image, ImageBackground, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../../theme/brand';
import { IconArrowLeft, IconStar, IconPin, IconClock, IconShare } from '../../components/Icons';
import { api } from '../../lib/api';
import { wellnessPartnerImage, wellnessServiceImage } from '../../lib/imageFallbacks';

type Partner = {
  id: string; name: string; serviceType?: string; city?: string; area?: string;
  address?: string; rating?: number; reviewCount?: number; distanceLabel?: string;
  photos?: string[]; discountPercent?: number;
};

type Service = {
  id: string; name: string; description?: string; price: number;
  originalPrice?: number | null; durationMinutes: number; imageUrl?: string; category?: string;
};

function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce((acc, svc) => {
    const cat = svc.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {} as Record<string, Service[]>);
}

export default function WellnessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/wellness/partners/${id}`).catch((e) => {
        setError(e?.message || 'Could not load wellness partner.');
        return null;
      }),
      api.get(`/wellness/partners/${id}/services`).catch(() => []),
    ]).then(([pRes, svcs]) => {
      setPartner(pRes?.partner || pRes || null);
      setServices(Array.isArray(svcs) ? svcs : (svcs?.data || []));
    }).finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${partner?.name || 'this wellness partner'} on BookMyFit!` });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.heroTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.glassCircle}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[s.center, { padding: 24 }]}>
          <Text style={s.emptyTitle}>Wellness partner not found</Text>
          <Text style={s.emptyText}>{error || 'This partner is not available from the server right now.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const heroUri = wellnessPartnerImage(partner);
  const grouped = groupByCategory(services);

  return (
    <SafeAreaView style={s.screen} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={s.heroContainer}>
          <ImageBackground source={{ uri: heroUri }} style={s.heroImg}>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(6,6,6,0.92)']} locations={[0.3, 0.65, 1]} style={s.heroGradient}>
              <View style={s.heroTopRow}>
                <TouchableOpacity onPress={() => router.back()} style={s.glassCircle}>
                  <IconArrowLeft size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={s.glassCircle}>
                  <IconShare size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={s.heroBottom}>
                {(partner.discountPercent ?? 0) > 0 && (
                  <View style={s.discountBadge}>
                    <Text style={s.discountBadgeText}>{partner.discountPercent}% OFF</Text>
                  </View>
                )}
                <Text style={s.heroName}>{partner.name}</Text>
                <View style={s.heroMetaRow}>
                  <View style={s.heroMetaChip}>
                    <IconStar size={13} color={colors.star} />
                    <Text style={s.heroMetaText} numberOfLines={1}>{partner.rating ? partner.rating.toFixed(1) : '--'} ({partner.reviewCount ?? 0})</Text>
                  </View>
                  <View style={s.heroMetaChip}>
                    <IconPin size={13} color={colors.accent} />
                    <Text style={s.heroMetaText} numberOfLines={1}>{[partner.area, partner.city].filter(Boolean).join(', ') || 'Location not added'}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        <View style={s.statsRow}>
          <View style={s.statChip}>
            <Text style={s.statLabel}>Rating</Text>
            <Text style={s.statValue}>{partner.rating ? `${partner.rating.toFixed(1)} star` : '--'}</Text>
          </View>
          <View style={[s.statChip, s.statChipMiddle]}>
            <Text style={s.statLabel}>Services</Text>
            <Text style={s.statValue}>{services.length}</Text>
          </View>
          <View style={s.statChip}>
            <Text style={s.statLabel}>Distance</Text>
            <Text style={s.statValue}>{partner.distanceLabel || '--'}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <Text style={s.aboutText}>{partner.address || 'No description has been added yet.'}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Services</Text>
          {services.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No services are configured for this partner yet.</Text>
            </View>
          ) : Object.entries(grouped).map(([category, catServices]) => (
            <View key={category}>
              <Text style={s.categoryLabel}>{category}</Text>
              {catServices.map((svc) => {
                const img = wellnessServiceImage({ ...svc, partner });
                const hasDiscount = svc.originalPrice != null && Number(svc.originalPrice) > Number(svc.price);
                const pct = hasDiscount ? Math.round(100 - (Number(svc.price) / Number(svc.originalPrice!)) * 100) : 0;
                return (
                  <View key={svc.id} style={s.svcCard}>
                    <Image source={{ uri: img }} style={s.svcImg} />
                    <View style={s.svcBody}>
                      <Text style={s.svcName} numberOfLines={1}>{svc.name}</Text>
                      <View style={s.svcBadgeRow}>
                        <View style={s.svcCatBadge}><Text style={s.svcCatText}>{svc.category || 'Wellness'}</Text></View>
                        <View style={s.svcDurBadge}>
                          <IconClock size={11} color={colors.t2} />
                          <Text style={s.svcDurText}>{svc.durationMinutes} min</Text>
                        </View>
                      </View>
                      <View style={s.svcPriceRow}>
                        {hasDiscount && <Text style={s.svcOriginal}>₹{Number(svc.originalPrice).toLocaleString()}</Text>}
                        <Text style={s.svcPrice}>₹{Number(svc.price).toLocaleString()}</Text>
                        {hasDiscount && <View style={s.discBadge}><Text style={s.discText}>{pct}%</Text></View>}
                      </View>
                      <TouchableOpacity
                        style={s.bookBtn}
                        onPress={() => router.push({
                          pathname: '/wellness/book-service',
                          params: {
                            serviceId: svc.id,
                            partnerId: id,
                            serviceName: svc.name,
                            price: String(svc.price),
                            originalPrice: svc.originalPrice ?? '',
                            duration: String(svc.durationMinutes),
                          },
                        } as any)}
                      >
                        <Text style={s.bookBtnText}>Book Now</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroContainer: { width: '100%' },
  heroImg: { width: '100%', height: 300, backgroundColor: colors.surface },
  heroGradient: { flex: 1, height: 300, justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  glassCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroBottom: { gap: 10 },
  discountBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  discountBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, color: '#060606' },
  heroName: { fontFamily: fonts.serif, fontSize: 31, color: '#fff', lineHeight: 36 },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroMetaChip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  heroMetaText: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: '#fff' },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: -20, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statChip: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statChipMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2, marginBottom: 4 },
  statValue: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', marginBottom: 12 },
  aboutText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.t2 },
  categoryLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent, marginBottom: 10, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
  emptyCard: { padding: 16, borderRadius: radius.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.t2, textAlign: 'center', lineHeight: 20 },
  svcCard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  svcImg: { width: 86, height: 104, borderRadius: radius.md, backgroundColor: colors.bg },
  svcBody: { flex: 1 },
  svcName: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff', marginBottom: 8 },
  svcBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  svcCatBadge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  svcCatText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent },
  svcDurBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.glass, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  svcDurText: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.t2 },
  svcPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  svcOriginal: { fontFamily: fonts.sans, fontSize: 12, color: colors.t3, textDecorationLine: 'line-through' },
  svcPrice: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.accent },
  discBadge: { backgroundColor: 'rgba(255,107,107,0.16)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  discText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#ff6b6b' },
  bookBtn: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  bookBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: '#060606' },
});
