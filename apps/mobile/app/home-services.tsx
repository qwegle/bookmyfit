import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme/brand';
import { IconArrowLeft, IconStar, IconPin } from '../components/Icons';
import { api } from '../lib/api';
import { wellnessPartnerImage } from '../lib/imageFallbacks';

// ─── Fallback data ────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Massage', 'Facial', 'Hair', 'Cleaning', 'Physio'];

type Provider = {
  id: string; name: string; serviceType: string; city: string; area: string;
  rating: number; reviewCount: number; photos?: string[]; minPrice?: number;
  services?: string[];
};

export default function HomeServicesScreen() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/wellness/partners?serviceType=home&limit=50')
      .then((res: any) => {
        const list: Provider[] = res?.data || (Array.isArray(res) ? res : []);
        setProviders(list);
      })
      .catch((e: any) => {
        setProviders([]);
        setError(e?.message || 'Could not load home service providers.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = providers.filter(p => {
    if (activeCategory === 'All') return true;
    const haystack = [p.serviceType, p.name, ...(p.services || [])].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(activeCategory.toLowerCase());
  });

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>Home Services</Text>
          <Text style={s.headerSubtitle}>Expert services at your doorstep</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catScroll}
        style={s.catScrollWrapper}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.catChip, activeCategory === cat && s.catChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[s.catChipText, activeCategory === cat && s.catChipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}
        >
          {filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>{error || 'No home service providers found'}</Text>
            </View>
          ) : (
            filtered.map(provider => {
              const heroImg = wellnessPartnerImage(provider);
              const services = provider.services?.length ? provider.services : [provider.serviceType || 'Home Service'];
              return (
                <View key={provider.id} style={s.providerCard}>
                  {/* Image header */}
                  <ImageBackground source={{ uri: heroImg }} style={s.cardHero} imageStyle={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
                    <LinearGradient
                      colors={['transparent', 'rgba(6,6,6,0.85)']}
                      style={s.cardGradient}
                    >
                      {/* Rating badge */}
                      <View style={s.ratingBadge}>
                        <IconStar size={12} color={colors.star} />
                        <Text style={s.ratingText}>{provider.rating ? provider.rating.toFixed(1) : '--'}</Text>
                        <Text style={s.reviewText}>({provider.reviewCount || 0})</Text>
                      </View>
                      <Text style={s.providerName}>{provider.name}</Text>
                      <View style={s.locationRow}>
                        <IconPin size={12} color={colors.accent} />
                        <Text style={s.locationText}>{[provider.area, provider.city].filter(Boolean).join(', ') || 'Location not added'}</Text>
                      </View>
                    </LinearGradient>
                  </ImageBackground>

                  {/* Card body */}
                  <View style={s.cardBody}>
                    {/* Service chips */}
                    {services.length > 0 && (
                      <View style={s.serviceChips}>
                        {services.slice(0, 3).map((svc, i) => (
                          <View key={i} style={s.svcChip}>
                            <Text style={s.svcChipText}>{svc}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Price + CTA */}
                    <View style={s.cardFooter}>
                      <View>
                        <Text style={s.fromLabel}>Starting from</Text>
                        <Text style={s.fromPrice} numberOfLines={1}>{provider.minPrice ? `Rs ${provider.minPrice.toLocaleString()}` : 'Pricing not added'}</Text>
                      </View>
                      <TouchableOpacity
                        style={s.bookBtn}
                        onPress={() => router.push({ pathname: '/wellness/[id]', params: { id: provider.id } } as any)}
                      >
                        <Text style={s.bookBtnText} numberOfLines={1}>Services</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff' },
  headerSubtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, marginTop: 2 },

  catScrollWrapper: { flexGrow: 0, paddingTop: 6, paddingBottom: 8 },
  catScroll: { paddingHorizontal: spacing.lg, gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
  },
  catChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  catChipText: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  catChipTextActive: { color: colors.accent, fontFamily: fonts.sansBold },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.t3 },

  providerCard: {
    marginBottom: 20,
    backgroundColor: colors.glass, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderGlass, overflow: 'hidden',
  },
  cardHero: { width: '100%', height: 150 },
  cardGradient: {
    flex: 1, justifyContent: 'flex-end',
    padding: 14, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  ratingText: { fontFamily: fonts.sansBold, fontSize: 12, color: '#fff' },
  reviewText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  providerName: { fontFamily: fonts.serif, fontSize: 18, color: '#fff', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  cardBody: { padding: 14 },
  serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  svcChip: {
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  svcChipText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fromLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginBottom: 2 },
  fromPrice: { maxWidth: 170, fontFamily: fonts.sansBold, fontSize: 16, color: colors.accent },
  bookBtn: {
    minWidth: 90,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bookBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent },
});
