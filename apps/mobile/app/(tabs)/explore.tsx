import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../../theme/brand';
import { IconPin, IconArrowRight } from '../../components/Icons';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width: W } = Dimensions.get('window');
const HALF = (W - 52) / 2;

// ── Category icon (inline) ─────────────────────────────────────────────────
function CatSvg({ type, size, color }: { type: string; size: number; color: string }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'dumbbell')  return <Svg {...p}><Path d="M6.5 6.5h11M6.5 17.5h11M2 10v4M22 10v4M5 8v8M19 8v8" /></Svg>;
  if (type === 'cardio')    return <Svg {...p}><Path d="M3 12h3l3-9 3 18 3-9h3" /></Svg>;
  if (type === 'yoga')      return <Svg {...p}><Circle cx="12" cy="5" r="2" /><Path d="M12 7v4M8 11c0 2 1.5 4 4 4s4-2 4-4M9 21l3-6 3 6" /></Svg>;
  if (type === 'crossfit')  return <Svg {...p}><Path d="M17 3l-5 5-5-5M17 21l-5-5-5 5M3 7l5 5-5 5M21 7l-5 5 5 5" /></Svg>;
  if (type === 'hiit')      return <Svg {...p}><Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></Svg>;
  if (type === 'strength')  return <Svg {...p}><Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill={color} /></Svg>;
  if (type === 'spa')       return <Svg {...p}><Circle cx="12" cy="12" r="3" /><Path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></Svg>;
  if (type === 'store')     return <Svg {...p}><Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><Path d="M3 6h18M16 10a4 4 0 01-8 0" /></Svg>;
  if (type === 'trainers')  return <Svg {...p}><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Svg>;
  if (type === 'videos')    return <Svg {...p}><Rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><Path d="M17 2l-5 5-5-5" /></Svg>;
  if (type === 'corporate') return <Svg {...p}><Rect x="2" y="7" width="20" height="14" rx="2" /><Path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></Svg>;
  // pin / nearby
  return <Svg {...p}><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><Circle cx="12" cy="10" r="3" /></Svg>;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const GYM_CATS = [
  { id: 'all',      label: 'All Gyms',  color: colors.accent,  bg: colors.accentSoft,          icon: 'dumbbell', img: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400&q=80' },
  { id: 'strength', label: 'Strength',  color: '#FB923C',       bg: 'rgba(251,146,60,0.15)',     icon: 'strength', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&q=80' },
  { id: 'cardio',   label: 'Cardio',    color: '#F43F5E',       bg: 'rgba(244,63,94,0.15)',      icon: 'cardio',   img: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=400&q=80' },
  { id: 'yoga',     label: 'Yoga',      color: '#22D3EE',       bg: 'rgba(34,211,238,0.15)',     icon: 'yoga',     img: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&q=80' },
  { id: 'crossfit', label: 'CrossFit',  color: '#A78BFA',       bg: 'rgba(167,139,250,0.15)',    icon: 'crossfit', img: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&q=80' },
  { id: 'hiit',     label: 'HIIT',      color: '#FBBF24',       bg: 'rgba(251,191,36,0.15)',     icon: 'hiit',     img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80' },
];

const BIG_CARDS = [
  {
    id: 'wellness',
    label: 'Spa & Recovery',
    sub: 'Massage · Physio · Yoga',
    color: '#F9A8D4',
    bg: 'rgba(249,168,212,0.12)',
    icon: 'spa',
    img: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=600&q=80',
    route: '/wellness',
  },
  {
    id: 'home-services',
    label: 'Home Services',
    sub: 'Beauty · Massage · Grooming',
    color: '#FCD34D',
    bg: 'rgba(252,211,77,0.12)',
    icon: 'spa',
    img: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&q=80',
    route: '/home-services',
  },
  {
    id: 'store',
    label: 'Fitness Store',
    sub: 'Supplements · Gear · Apparel',
    color: colors.accent,
    bg: colors.accentSoft,
    icon: 'store',
    img: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=80',
    route: '/(tabs)/store',
  },
];

const SMALL_CARDS = [
  { id: 'trainers',  label: 'Trainers',          sub: 'Personal coaching',  color: '#60A5FA', icon: 'trainers',  route: '/trainers' },
  { id: 'videos',    label: 'Workout Videos',    sub: 'Free & premium',     color: '#F87171', icon: 'videos',    route: '/videos' },
  { id: 'corporate', label: 'Corporate Wellness',sub: 'For teams & offices', color: '#A78BFA', icon: 'corporate', route: null },
  { id: 'nearby',    label: 'Gyms Near Me',       sub: 'Location-based',    color: '#34D399', icon: 'nearby',    route: '/nearby' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExploreHub() {
  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Explore</Text>
          <View style={s.locRow}>
            <IconPin size={12} color={colors.accent} />
            <Text style={s.locText}>Bhubaneswar</Text>
          </View>
        </View>

        {/* ── Gym categories grid ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Browse by Category</Text>
          <TouchableOpacity onPress={() => router.push('/gyms' as any)}>
            <Text style={s.viewAll}>All Gyms ›</Text>
          </TouchableOpacity>
        </View>
        <View style={s.catGrid}>
          {GYM_CATS.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[s.catCard, { borderColor: cat.color + '44' }]}
              onPress={() => router.push(`/gyms?category=${cat.id}` as any)}
              activeOpacity={0.82}
            >
              <ImageBackground source={{ uri: cat.img }} style={s.catCardImg} imageStyle={{ borderRadius: radius.lg }}>
                <View style={[s.catCardDark, { backgroundColor: 'rgba(0,0,0,0.52)' }]} />
                <View style={[s.catIconWrap, { backgroundColor: cat.bg }]}>
                  <CatSvg type={cat.icon} size={18} color={cat.color} />
                </View>
                <Text style={s.catCardLabel}>{cat.label}</Text>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Wellness + Store (big cards) – first 2 side by side, rest full-width ── */}
        <Text style={s.sectionTitle2}>Wellness & More</Text>
        <View style={s.bigCardsRow}>
          {BIG_CARDS.slice(0, 2).map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[s.bigCard, { borderColor: card.color + '44' }]}
              onPress={() => router.push(card.route as any)}
              activeOpacity={0.82}
            >
              <ImageBackground source={{ uri: card.img }} style={s.bigCardImg} imageStyle={{ borderRadius: radius.xl }}>
                <View style={s.bigCardDark} />
                <View style={s.bigCardContent}>
                  <View style={[s.bigCardIcon, { backgroundColor: card.bg }]}>
                    <CatSvg type={card.icon} size={20} color={card.color} />
                  </View>
                  <Text style={s.bigCardLabel}>{card.label}</Text>
                  <Text style={s.bigCardSub}>{card.sub}</Text>
                  <View style={[s.bigCardCta, { borderColor: card.color + '66', backgroundColor: card.color + '18' }]}>
                    <Text style={[s.bigCardCtaText, { color: card.color }]}>Explore</Text>
                    <IconArrowRight size={12} color={card.color} />
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>
        {BIG_CARDS.slice(2).map((card) => (
          <TouchableOpacity
            key={card.id}
            style={[s.bigCardFull, { borderColor: card.color + '44', marginBottom: 10 }]}
            onPress={() => router.push(card.route as any)}
            activeOpacity={0.82}
          >
            <ImageBackground source={{ uri: card.img }} style={s.bigCardImg} imageStyle={{ borderRadius: radius.xl }}>
              <View style={s.bigCardDark} />
              <View style={s.bigCardContent}>
                <View style={[s.bigCardIcon, { backgroundColor: card.bg }]}>
                  <CatSvg type={card.icon} size={20} color={card.color} />
                </View>
                <Text style={s.bigCardLabel}>{card.label}</Text>
                <Text style={s.bigCardSub}>{card.sub}</Text>
                <View style={[s.bigCardCta, { borderColor: card.color + '66', backgroundColor: card.color + '18' }]}>
                  <Text style={[s.bigCardCtaText, { color: card.color }]}>Explore</Text>
                  <IconArrowRight size={12} color={card.color} />
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ))}

        {/* ── Small service cards ── */}
        <Text style={s.sectionTitle2}>More Services</Text>
        <View style={s.smallGrid}>
          {SMALL_CARDS.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[s.smallCard, { borderColor: card.color + '33' }]}
              onPress={() => { if (card.route) router.push(card.route as any); }}
              activeOpacity={0.82}
            >
              <View style={[s.smallIconWrap, { backgroundColor: card.color + '15' }]}>
                <CatSvg type={card.icon} size={22} color={card.color} />
              </View>
              <Text style={s.smallCardLabel}>{card.label}</Text>
              <Text style={s.smallCardSub}>{card.sub}</Text>
              {!card.route && (
                <View style={s.comingSoon}><Text style={s.comingSoonText}>Soon</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 },

  // Header
  header:   { marginBottom: 20 },
  title:    { fontFamily: fonts.serif, fontSize: 28, color: '#fff', letterSpacing: -0.5 },
  locRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locText:  { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t2 },

  // Section rows
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 17, color: '#fff', letterSpacing: -0.3 },
  sectionTitle2:{ fontFamily: fonts.serif, fontSize: 17, color: '#fff', letterSpacing: -0.3, marginTop: 24, marginBottom: 12 },
  viewAll:      { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent },

  // Gym category grid (3 columns)
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  catCard: {
    width: (W - 52) / 3,
    height: 88,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  catCardImg:  { flex: 1, justifyContent: 'flex-end', padding: 8 },
  catCardDark: { ...StyleSheet.absoluteFillObject, borderRadius: radius.lg },
  catIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catCardLabel:{ fontFamily: fonts.sansBold, fontSize: 10, color: '#fff', lineHeight: 13 },

  // Big cards (2 side by side)
  bigCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bigCard: {
    flex: 1,
    height: 170,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  bigCardFull: {
    width: '100%',
    height: 120,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  bigCardImg:     { flex: 1 },
  bigCardDark:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  bigCardContent: { flex: 1, justifyContent: 'flex-end', padding: 14, gap: 3 },
  bigCardIcon:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bigCardLabel:   { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff' },
  bigCardSub:     { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  bigCardCta:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  bigCardCtaText: { fontFamily: fonts.sansBold, fontSize: 11 },

  // Small service grid (2 columns)
  smallGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  smallCard: {
    width: HALF,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    position: 'relative',
  },
  smallIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  smallCardLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  smallCardSub:   { fontFamily: fonts.sans, fontSize: 10, color: colors.t2 },
  comingSoon: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  comingSoonText: { fontFamily: fonts.sansBold, fontSize: 8, color: colors.t3 },
});
