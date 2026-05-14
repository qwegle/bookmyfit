import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconChevronRight, IconPin, IconStar } from '../components/Icons';
import { api } from '../lib/api';
import { wellnessPartnerImage } from '../lib/imageFallbacks';

const CATEGORIES = ['All', 'Spa', 'Massage', 'Physio', 'Recovery'];

type Partner = {
  id: string;
  name: string;
  serviceType?: string;
  city?: string;
  area?: string;
  rating?: number;
  reviewCount?: number;
  photos?: string[];
  minPrice?: number | null;
  serviceCount?: number;
};

function isHomeService(partner: Partner) {
  return String(partner.serviceType || '').toLowerCase().includes('home');
}

export default function SpaCentresScreen() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/wellness/partners?limit=100')
      .then((res: any) => {
        if (!active) return;
        const raw: Partner[] = Array.isArray(res) ? res : res?.data || [];
        const spaCentres = raw.filter((partner) => !isHomeService(partner));
        setPartners(spaCentres);
      })
      .catch((e: any) => {
        if (active) {
          setPartners([]);
          setError(e?.message || 'Could not load spa centres.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (category === 'All') return partners;
    const q = category.toLowerCase();
    return partners.filter((partner) => [partner.serviceType, partner.name].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [category, partners]);

  return (
    <SafeAreaView style={s.root} edges={['left', 'right', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>Spa Centres Near You</Text>
          <Text style={s.subtitle}>{filtered.length}+ verified wellness partners</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {CATEGORIES.map((item) => {
            const active = item === category;
            return (
              <TouchableOpacity key={item} style={[s.chip, active && s.chipActive]} onPress={() => setCategory(item)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <View style={[s.chipDot, !active && s.chipDotInactive]} />
                <Text style={[s.chipText, active && s.chipTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {filtered.map((partner, index) => {
            const image = wellnessPartnerImage(partner);
            return (
              <TouchableOpacity
                key={partner.id}
                style={s.card}
                activeOpacity={0.88}
                onPress={() => router.push({ pathname: '/wellness/[id]', params: { id: partner.id } } as any)}
              >
                <ImageBackground source={{ uri: image }} style={s.hero} imageStyle={{ borderRadius: radius.xl }}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.86)']} style={s.heroShade}>
                    <View style={s.ratingPill}>
                      <IconStar size={12} color={colors.star} />
                    <Text style={s.ratingText}>{partner.rating ? Number(partner.rating).toFixed(1) : '--'}</Text>
                      <Text style={s.reviewText}>({partner.reviewCount || 0})</Text>
                    </View>
                    <Text style={s.cardTitle} numberOfLines={1}>{partner.name}</Text>
                    <View style={s.locationRow}>
                      <IconPin size={12} color={colors.accent} />
                      <Text style={s.locationText} numberOfLines={1}>{[partner.area, partner.city].filter(Boolean).join(', ') || 'Location not added'}</Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>

                <View style={s.cardFooter}>
                  <View>
                    <Text style={s.metaLabel}>{partner.serviceCount || 0} services available</Text>
                    <Text style={s.price} numberOfLines={1}>{partner.minPrice ? `From Rs ${Number(partner.minPrice).toLocaleString('en-IN')}` : 'Pricing not added'}</Text>
                  </View>
                  <View style={s.viewBtn}>
                    <Text style={s.viewText} numberOfLines={1}>Services</Text>
                    <IconChevronRight size={13} color={colors.accent} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No spa centres found</Text>
              <Text style={s.emptyText}>{error || 'Try another category.'}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 24 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  back: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: '#fff' },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, marginTop: 2 },
  chipsWrap: { flexGrow: 0, marginBottom: 6 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 34, paddingHorizontal: 14, borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  chipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  chipDotInactive: { backgroundColor: 'transparent' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t2 },
  chipTextActive: { color: colors.accent },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 44, gap: 14 },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glass,
    overflow: 'hidden',
  },
  hero: { height: 170 },
  heroShade: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8,
  },
  ratingText: { fontFamily: fonts.sansBold, fontSize: 12, color: '#fff' },
  reviewText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 19, color: '#fff', marginBottom: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14 },
  metaLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginBottom: 3 },
  price: { maxWidth: 180, fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minWidth: 90,
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  viewText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent },
  empty: { alignItems: 'center', paddingTop: 70 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff', marginBottom: 6 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
});
