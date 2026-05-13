import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, FlatList, Dimensions, Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { colors, fonts, radius } from '../../theme/brand';
import {
  IconBell, IconPin, IconStar, IconChevronDown,
  IconBolt, IconShield, IconHeadphones, IconPercent,
} from '../../components/Icons';
import { API_BASE, appStorage, subscriptionsApi } from '../../lib/api';
import { accessLabelForSubscription, getActiveSubscriptionAccess, normalizeSubscriptionList } from '../../lib/subscriptionAccess';
import {
  DEFAULT_GYM_IMAGE,
  DEFAULT_HOMEPAGE_HERO_IMAGE,
  DEFAULT_WELLNESS_SERVICE_IMAGE,
  firstImage,
  productImage,
} from '../../lib/imageFallbacks';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import * as Location from 'expo-location';

const { width: W } = Dimensions.get('window');

// ── Category icons ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',      label: 'All Gyms',  color: colors.accent,    bg: colors.accentSoft,            icon: 'dumbbell'  },
  { id: 'strength', label: 'Strength',  color: '#FB923C',         bg: 'rgba(251,146,60,0.15)',       icon: 'strength'  },
  { id: 'cardio',   label: 'Cardio',    color: '#F43F5E',         bg: 'rgba(244,63,94,0.15)',        icon: 'cardio'    },
  { id: 'yoga',     label: 'Yoga',      color: '#22D3EE',         bg: 'rgba(34,211,238,0.15)',       icon: 'yoga'      },
  { id: 'crossfit', label: 'CrossFit',  color: '#A78BFA',         bg: 'rgba(167,139,250,0.15)',      icon: 'crossfit'  },
  { id: 'hiit',     label: 'HIIT',      color: '#FBBF24',         bg: 'rgba(251,191,36,0.15)',       icon: 'bolt'      },
];

function CatIcon({ type, size, color }: { type: string; size: number; color: string }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'dumbbell')  return <Svg {...p}><Path d="M6.5 6.5h11M6.5 17.5h11M2 10v4M22 10v4M5 8v8M19 8v8" /></Svg>;
  if (type === 'strength')  return <Svg {...p}><Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill={color} /></Svg>;
  if (type === 'cardio')    return <Svg {...p}><Path d="M3 12h3l3-9 3 18 3-9h3" /></Svg>;
  if (type === 'yoga')      return <Svg {...p}><Circle cx="12" cy="5" r="2" /><Path d="M12 7v4M8 11c0 2 1.5 4 4 4s4-2 4-4M9 21l3-6 3 6" /></Svg>;
  if (type === 'crossfit')  return <Svg {...p}><Path d="M17 3l-5 5-5-5M17 21l-5-5-5 5M3 7l5 5-5 5M21 7l-5 5 5 5" /></Svg>;
  if (type === 'spa')       return <Svg {...p}><Path d="M12 21c4-4 6-7 6-10a6 6 0 00-12 0c0 3 2 6 6 10z" /><Path d="M12 15c-2-2-3-4-3-6 2 0 4 1 6 3" /></Svg>;
  if (type === 'shop')      return <Svg {...p}><Path d="M6 2l-3 6v12a2 2 0 002 2h14a2 2 0 002-2V8l-3-6z" /><Path d="M3 8h18M16 12a4 4 0 01-8 0" /></Svg>;
  return <Svg {...p}><Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></Svg>; // bolt
}

function categoryMeta(category: any) {
  const text = `${category.id || ''} ${category.label || category.name || ''}`.toLowerCase();
  if (text.includes('yoga') || text.includes('pilates') || text.includes('stretch')) return { icon: 'yoga', color: '#22D3EE', bg: 'rgba(34,211,238,0.14)' };
  if (text.includes('cardio') || text.includes('run') || text.includes('cycle')) return { icon: 'cardio', color: '#F43F5E', bg: 'rgba(244,63,94,0.14)' };
  if (text.includes('cross') || text.includes('hiit') || text.includes('functional')) return { icon: 'bolt', color: '#FBBF24', bg: 'rgba(251,191,36,0.14)' };
  if (text.includes('strength') || text.includes('weight') || text.includes('muscle')) return { icon: 'strength', color: '#FB923C', bg: 'rgba(251,146,60,0.14)' };
  if (text.includes('wellness') || text.includes('spa') || text.includes('physio')) return { icon: 'spa', color: '#A7F3D0', bg: 'rgba(167,243,208,0.12)' };
  if (text.includes('shop') || text.includes('store')) return { icon: 'shop', color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' };
  return { icon: category.icon || 'dumbbell', color: category.color || colors.accent, bg: category.bg || colors.accentSoft };
}


// ── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ h, w, br = 12, style }: { h: number; w?: number | string; br?: number; style?: any }) {
  return <View style={[{ height: h, width: w || '100%', borderRadius: br, backgroundColor: 'rgba(255,255,255,0.06)' }, style]} />;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const CITIES = ['Bhubaneswar', 'Cuttack', 'Puri', 'Rourkela', 'Sambalpur', 'Berhampur', 'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata'];

export default function Home() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('Bhubaneswar');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [wellnessServices, setWellnessServices] = useState<any[]>([]);
  const [homeGyms, setHomeGyms] = useState<any[]>([]);
  const [subscribedGymIds, setSubscribedGymIds] = useState<Set<string>>(new Set());
  const [activeGymSubs, setActiveGymSubs] = useState<Map<string, any>>(new Map());
  const [multiGymSub, setMultiGymSub] = useState<any>(null);
  const [hasMultiGymSub, setHasMultiGymSub] = useState(false);
  const heroRef = useRef<FlatList>(null);

  useEffect(() => {
    // Load saved city first, fall back to GPS detection
    appStorage.getItem('bmf_city').then((saved) => {
      if (saved) {
        setCity(saved);
      } else {
        // Auto-detect from GPS (fire-and-forget, no crash if denied)
        (async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            const c = geo?.city || geo?.subregion || geo?.region;
            if (c) setCity(c);
          } catch {}
        })();
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/homepage/config`)
      .then((r) => r.json())
      .then((data: any) => setConfig(data?.sections ? data : { sections: [] }))
      .catch(() => setConfig({ sections: [] }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/wellness/services/all`)
      .then((r) => r.json())
      .then((data: any) => setWellnessServices(Array.isArray(data) ? data.slice(0, 8) : []))
      .catch(() => setWellnessServices([]));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/gyms?limit=6`)
      .then((r) => r.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.data || data?.gyms || [];
        setHomeGyms(Array.isArray(list) ? list.slice(0, 6) : []);
      })
      .catch(() => setHomeGyms([]));
  }, []);

  useEffect(() => {
    subscriptionsApi.mySubscriptions()
      .then((data: any) => {
        const state = getActiveSubscriptionAccess(normalizeSubscriptionList(data));
        setSubscribedGymIds(state.gymIds);
        setActiveGymSubs(state.byGymId);
        setMultiGymSub(state.multiGymSub);
        setHasMultiGymSub(state.hasMultiGym);
      })
      .catch(() => {
        setSubscribedGymIds(new Set());
        setActiveGymSubs(new Map());
        setMultiGymSub(null);
        setHasMultiGymSub(false);
      });
  }, []);

  const sections: any[] = config
    ? [...(config.sections || [])].filter((s) => s.visible).sort((a: any, b: any) => a.order - b.order)
    : [];

  const heroSection = sections.find((s) => s.type === 'hero');
  const slides = heroSection?.slides || [];
  const featuredGymSection = sections.find((s) => s.type === 'featured_gyms');
  const bottomGymSection = homeGyms.length
    ? { id: 'nearby-gyms', title: 'Gyms Near You', gyms: homeGyms }
    : featuredGymSection;

  // Auto-advance hero
  useEffect(() => {
    if (!slides?.length) return;
    const t = setInterval(() => {
      setHeroIdx((i) => {
        const next = (i + 1) % slides.length;
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [slides?.length]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
          <View style={s.topBar}>
            <View style={s.locationRow}>
              <IconPin size={12} color={colors.accent} />
              <Sk h={13} br={6} style={{ width: 80 }} />
            </View>
          </View>
          <Sk h={200} br={20} style={{ marginBottom: 20 }} />
          <Sk h={60} style={{ marginBottom: 16 }} />
          <Sk h={160} style={{ marginBottom: 16 }} />
          <Sk h={180} style={{ marginBottom: 16 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.locationRow} onPress={() => setShowCityPicker(true)}>
            <IconPin size={12} color={colors.accent} />
            <Text style={s.locationText}>{city}</Text>
            <IconChevronDown size={11} color={colors.t2} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/notifications' as any)}>
              <IconBell size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── City Picker Modal ── */}
        <Modal visible={showCityPicker} transparent animationType="slide" onRequestClose={() => setShowCityPicker(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setShowCityPicker(false)}>
            <View style={s.cityPickerSheet}>
              <View style={s.cityPickerHandle} />
              <Text style={s.cityPickerTitle}>Select City</Text>
              {CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[s.cityRow, city === c && s.cityRowActive]}
                  onPress={() => {
                    setCity(c);
                    appStorage.setItem('bmf_city', c).catch(() => {});
                    setShowCityPicker(false);
                  }}
                >
                  <IconPin size={13} color={city === c ? colors.accent : colors.t2} />
                  <Text style={[s.cityRowText, city === c && { color: colors.accent }]}>{c}</Text>
                  {city === c && <View style={s.cityActiveDot} />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* ── Sections (dynamic) ── */}
        {sections.map((section) => {
          switch (section.type) {
            case 'hero':       return <HeroSection key={section.id} slides={slides} heroIdx={heroIdx} setHeroIdx={setHeroIdx} heroRef={heroRef} />;
            case 'categories': return <CategoriesSection key={section.id} title={section.title} />;
            case 'featured_gyms': return (
              <View key={section.id}>
                <FeaturedGymsSection
                  section={section}
                  subscribedGymIds={subscribedGymIds}
                  activeGymSubs={activeGymSubs}
                  multiGymSub={multiGymSub}
                  hasMultiGymSub={hasMultiGymSub}
                />
                <WellnessServicesSection services={wellnessServices} />
              </View>
            );
            case 'products':   return <ProductsSection key={section.id} section={section} />;
            case 'trust':      return null;
            case 'testimonials': return null;
            default: return null;
          }
        })}

        {bottomGymSection ? (
          <GymListingSection
            section={bottomGymSection}
            subscribedGymIds={subscribedGymIds}
            activeGymSubs={activeGymSubs}
            multiGymSub={multiGymSub}
            hasMultiGymSub={hasMultiGymSub}
          />
        ) : null}

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function hour() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ── Section components ────────────────────────────────────────────────────────

function HeroSection({ slides, heroIdx, setHeroIdx, heroRef }: any) {
  const { width } = useWindowDimensions();
  const cardW = Math.max(1, Math.round(width || W));
  const maxIndex = Math.max(0, slides.length - 1);
  if (!slides?.length) return null;

  return (
    <View style={s.heroWrap}>
      <FlatList
        key={`hero-${cardW}`}
        ref={heroRef}
        data={slides}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_: any, i: number) => String(i)}
        onMomentumScrollEnd={(e: any) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / cardW);
          setHeroIdx(Math.min(maxIndex, Math.max(0, idx)));
        }}
        snapToInterval={cardW}
        getItemLayout={(_: any, index: number) => ({ length: cardW, offset: cardW * index, index })}
        onScrollToIndexFailed={(info: any) => {
          setTimeout(() => heroRef.current?.scrollToOffset({ offset: cardW * info.index, animated: true }), 80);
        }}
        decelerationRate="fast"
        renderItem={({ item }: any) => (
          <ImageBackground source={{ uri: firstImage(item.imageUrl) || DEFAULT_HOMEPAGE_HERO_IMAGE }} style={[s.heroSlide, { width: cardW }]}>
            <View style={s.heroDark} />
            <View style={s.heroContent}>
              <Text style={s.heroKicker}>BOOKMY<Text style={{ color: colors.accent }}>FIT</Text></Text>
              <Text style={s.heroHeadline}>{item.headline}</Text>
              <Text style={s.heroAccent}>{item.headlineAccent}</Text>
              <Text style={s.heroSub}>{item.sub}</Text>
              <TouchableOpacity style={s.heroCta} onPress={() => router.push((item.ctaRoute || '/gyms') as any)}>
                <Text style={s.heroCtaText}>{item.cta}</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        )}
      />
      <View style={s.heroDots}>
        {slides.map((_: any, i: number) => <View key={i} style={[s.dot, i === heroIdx && s.dotActive]} />)}
      </View>
    </View>
  );
}

function CategoriesSection({ title }: { title: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <SectionRow title={title} onViewAll={() => router.push('/gyms' as any)} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={s.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const meta = categoryMeta(cat);
          return (
          <TouchableOpacity key={cat.id} style={[s.catChip, { borderColor: meta.bg }]} onPress={() => router.push(`/gyms?category=${cat.id}` as any)}>
            <View style={[s.catIconWrap, { backgroundColor: meta.bg }]}>
              <CatIcon type={meta.icon} size={16} color={meta.color} />
            </View>
            <Text style={[s.catLabel, { color: meta.color }]}>{cat.label}</Text>
          </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function WellnessServicesSection({ services }: { services: any[] }) {
  const list = services;
  if (!list.length) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <SectionRow title="Wellness Services" onViewAll={() => router.push('/wellness' as any)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {list.map((svc: any) => {
          const img = firstImage(svc.imageUrl, svc.image, svc.images, svc.partner?.photos, svc.partner?.coverPhoto) || DEFAULT_WELLNESS_SERVICE_IMAGE;
          const category = svc.category || svc.partner?.serviceType || 'Wellness';
          const price = Number(svc.price || svc.minPrice || 0);
          return (
            <TouchableOpacity key={svc.id} style={s.wellnessCard} activeOpacity={0.88} onPress={() => router.push('/wellness' as any)}>
              <ImageBackground source={{ uri: img }} style={s.wellnessImg} imageStyle={{ borderRadius: radius.xl }}>
                <View style={s.wellnessDark} />
                <View style={s.wellnessBadge}>
                  <Text style={s.wellnessBadgeText}>{category}</Text>
                </View>
                <View style={s.wellnessBottom}>
                  <Text style={s.wellnessName} numberOfLines={2}>{svc.name || svc.title || 'Wellness Service'}</Text>
                  <Text style={s.wellnessMeta}>{svc.durationMinutes || svc.durationMin || svc.duration || 45} min</Text>
                  {price > 0 && <Text style={s.wellnessPrice}>From Rs {price.toLocaleString('en-IN')}</Text>}
                </View>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function GymListingSection({
  section,
  subscribedGymIds,
  activeGymSubs,
  multiGymSub,
  hasMultiGymSub,
}: {
  section: any;
  subscribedGymIds: Set<string>;
  activeGymSubs: Map<string, any>;
  multiGymSub: any;
  hasMultiGymSub: boolean;
}) {
  const gyms: any[] = (section.gyms || []).slice(0, 5);
  if (!gyms.length) return null;

  return (
    <View style={s.gymListSection}>
      <SectionRow title="Gyms Near You" onViewAll={() => router.push('/gyms' as any)} />
      <View style={s.gymListWrap}>
        {gyms.map((g: any, idx: number) => {
          const img = firstImage(g.images, g.photos, g.coverImage, g.coverPhoto, g.img) || DEFAULT_GYM_IMAGE;
          const gid = g.id || g._id || `nearby-gym-${idx}`;
          const city = [g.area, g.city].filter(Boolean).join(', ');
          const hasAccess = hasMultiGymSub || subscribedGymIds.has(String(gid));
          const accessLabel = accessLabelForSubscription(activeGymSubs.get(String(gid)) || multiGymSub, hasMultiGymSub);

          return (
            <TouchableOpacity
              key={gid}
              style={s.gymListCard}
              activeOpacity={0.88}
              onPress={() => router.push({
                pathname: `/gym/${gid}` as any,
                params: {
                  fallbackName: g.name || '',
                  fallbackAddress: city || g.city || '',
                  fallbackRating: String(g.rating || 0),
                  fallbackTier: g.tier || 'premium',
                },
              })}
            >
              <ImageBackground source={{ uri: img }} style={s.gymListImg} imageStyle={{ borderRadius: radius.lg }}>
                <View style={s.gymListImgDark} />
                {g.rating ? (
                  <View style={s.gymListRating}>
                    <IconStar size={10} color="#FBBF24" />
                    <Text style={s.gymListRatingText}>{Number(g.rating).toFixed(1)}</Text>
                  </View>
                ) : null}
              </ImageBackground>

              <View style={s.gymListBody}>
                <View>
                  <Text style={s.gymListName} numberOfLines={2}>{g.name || 'Gym'}</Text>
                  <View style={s.gymListCityRow}>
                    <IconPin size={11} color={colors.t2} />
                    <Text style={s.gymListCity} numberOfLines={1}>{city || 'Nearby'}</Text>
                  </View>
                  {hasAccess && (
                    <View style={s.gymListSubscribedBadge}>
                      <Text style={s.gymListSubscribedText}>{accessLabel}</Text>
                    </View>
                  )}
                </View>
                <View style={s.gymListBottomRow}>
                  <Text style={s.gymListPrice} numberOfLines={1}>
                    {hasAccess ? 'Ready to book sessions' : (g.dayPassPrice ? `From Rs ${Number(g.dayPassPrice).toLocaleString('en-IN')}/day` : 'View plans')}
                  </Text>
                  <TouchableOpacity
                    style={[s.gymListCta, hasAccess && s.gymListBookCta]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (hasAccess) router.push({ pathname: '/slots', params: { gymId: gid } } as any);
                      else router.push({ pathname: '/plans', params: { gymId: gid, gymName: g.name || 'Gym' } } as any);
                    }}
                  >
                    <Text style={[s.gymListCtaText, hasAccess && s.gymListBookCtaText]}>{hasAccess ? 'Book' : 'View'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function FeaturedGymsSection({
  section,
  subscribedGymIds,
  activeGymSubs,
  multiGymSub,
  hasMultiGymSub,
}: {
  section: any;
  subscribedGymIds: Set<string>;
  activeGymSubs: Map<string, any>;
  multiGymSub: any;
  hasMultiGymSub: boolean;
}) {
  const gyms: any[] = section.gyms || [];
  if (!gyms.length) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <SectionRow title={section.title || 'Featured Gyms'} onViewAll={() => router.push('/gyms' as any)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {gyms.map((g: any, idx: number) => {
          const img = firstImage(g.images, g.photos, g.coverImage, g.coverPhoto, g.img) || DEFAULT_GYM_IMAGE;
          const name = (g.name || 'Gym').split(' ').slice(0, 2).join(' ');
          const gid = g.id || g._id;
          const hasAccess = hasMultiGymSub || subscribedGymIds.has(String(gid));
          const accessLabel = accessLabelForSubscription(activeGymSubs.get(String(gid)) || multiGymSub, hasMultiGymSub);
          return (
            <TouchableOpacity key={gid} style={s.gymFeatOuter} onPress={() => router.push({
              pathname: `/gym/${gid}` as any,
              params: {
                fallbackName: g.name || '',
                fallbackAddress: g.city || '',
                fallbackRating: String(g.rating || 0),
                fallbackTier: 'premium',
              },
            })} activeOpacity={0.85}>
              <RankNumber value={idx + 1} />
              <View style={s.gymFeatCard}>
                <ImageBackground source={{ uri: img }} style={s.gymFeatImg} imageStyle={{ borderRadius: radius.xl }}>
                  <View style={s.gymFeatDark} />
                  <View style={s.gymFeatBottom}>
                  {g.rating ? (
                    <View style={s.gymFeatRating}>
                      <IconStar size={10} color="#FBBF24" />
                      <Text style={s.gymFeatRatingText}>{Number(g.rating).toFixed(1)}</Text>
                    </View>
                  ) : null}
                  <Text style={s.gymFeatName} numberOfLines={1}>{name}</Text>
                  <Text style={s.gymFeatCity} numberOfLines={1}>{g.city || ''}</Text>
                  {hasAccess ? (
                    <Text style={s.gymFeatSubscribed}>{accessLabel}</Text>
                  ) : g.dayPassPrice ? (
                    <Text style={s.gymFeatPrice}>From ₹{g.dayPassPrice}/day</Text>
                  ) : null}
                  </View>
                </ImageBackground>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ProductsSection({ section }: { section: any }) {
  const products: any[] = section.products || [];
  if (!products.length) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <SectionRow title={section.title || 'Shop Products'} onViewAll={() => router.push('/(tabs)/store' as any)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {products.map((p: any) => {
          const img = productImage(p);
          const hasDiscount = p.mrp && Number(p.mrp) > Number(p.price);
          return (
            <TouchableOpacity key={p.id} style={s.productCard} onPress={() => router.push(`/product/${p.id}` as any)} activeOpacity={0.88}>
              <ImageBackground source={{ uri: img }} style={s.productImg} imageStyle={{ borderRadius: radius.lg, resizeMode: 'cover' }}>
                {hasDiscount && (
                  <View style={s.productDiscount}>
                    <Text style={s.productDiscountText}>{Math.round((1 - p.price / p.mrp) * 100)}% OFF</Text>
                  </View>
                )}
              </ImageBackground>
              <View style={s.productBody}>
                <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
                <View style={s.productPriceRow}>
                  <Text style={s.productPrice}>₹{Number(p.price).toLocaleString('en-IN')}</Text>
                  {hasDiscount && <Text style={s.productMrp}>₹{Number(p.mrp).toLocaleString('en-IN')}</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TrustSection() {
  const items = [
    { icon: 'percent',    label: 'Best Prices',    sub: 'Guaranteed' },
    { icon: 'shield',     label: 'Verified Gyms',  sub: 'Quality Assured' },
    { icon: 'bolt',       label: 'Easy Booking',   sub: 'In Few Clicks' },
    { icon: 'headphones', label: '24/7 Support',   sub: "We're Here" },
  ];
  return (
    <View style={s.trustRow}>
      {items.map((item) => (
        <View key={item.label} style={s.trustItem}>
          <View style={s.trustIcon}>
            {item.icon === 'percent'    && <IconPercent    size={13} color={colors.accent} />}
            {item.icon === 'shield'     && <IconShield     size={13} color={colors.accent} />}
            {item.icon === 'bolt'       && <IconBolt       size={13} color={colors.accent} />}
            {item.icon === 'headphones' && <IconHeadphones size={13} color={colors.accent} />}
          </View>
          <Text style={s.trustLabel}>{item.label}</Text>
          <Text style={s.trustSub}>{item.sub}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionRow({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={s.viewAll}>View All ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function RankNumber({ value }: { value: number }) {
  return (
    <View style={s.gymRankWrap} pointerEvents="none">
      <Svg width={78} height={100} viewBox="0 0 78 100">
        <SvgText
          x="2"
          y="78"
          fontSize="78"
          fontWeight="900"
          stroke={colors.accent}
          strokeWidth="2.2"
          fill="rgba(61,255,84,0.03)"
        >
          {String(value)}
        </SvgText>
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  container: { paddingBottom: 36 },

  // Top bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  greeting: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#fff' },
  iconBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass, alignItems: 'center', justifyContent: 'center' },

  // Logo
  logo: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 16 },
  logoDot: { color: colors.accent },

  // Hero
  heroWrap: { marginHorizontal: 0, marginBottom: 24 },
  heroSlide: { height: 200, justifyContent: 'flex-end' },
  heroDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  heroContent: { padding: 18, gap: 2 },
  heroKicker: { fontFamily: fonts.sansBold, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 4 },
  heroHeadline: { fontFamily: fonts.serif, fontSize: 26, color: '#fff', lineHeight: 30 },
  heroAccent:   { fontFamily: fonts.serif, fontSize: 26, color: colors.accent, lineHeight: 30, marginBottom: 6 },
  heroSub:  { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 17, marginBottom: 12 },
  heroCta:  { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, alignSelf: 'flex-start' },
  heroCtaText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#060606' },
  heroDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 18, backgroundColor: colors.accent },

  // Section headers
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 17, color: '#fff', letterSpacing: -0.3 },
  viewAll: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent },

  // Categories
  categoryScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 2 },
  catChip: {
    height: 38,
    minWidth: 92,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  catIconWrap: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catLabel:  { fontFamily: fonts.sansMedium, fontSize: 11 },

  // Wellness
  wellnessCard: { width: 170, height: 190, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface },
  wellnessImg: { flex: 1, justifyContent: 'space-between' },
  wellnessDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  wellnessBadge: {
    alignSelf: 'flex-start',
    margin: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  wellnessBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  wellnessBottom: { padding: 12, gap: 3 },
  wellnessName: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', lineHeight: 18 },
  wellnessMeta: { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.68)' },
  wellnessPrice: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent, marginTop: 2 },

  // Featured gyms
  gymFeatOuter:  { width: 198, height: 208, paddingLeft: 30, position: 'relative' },
  gymFeatCard:   { flex: 1, borderRadius: radius.xl, overflow: 'hidden' },
  gymFeatImg:    { flex: 1, justifyContent: 'space-between', borderRadius: radius.xl, overflow: 'hidden' },
  gymFeatDark:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.46)', borderRadius: radius.xl },
  gymRankWrap:   { position: 'absolute', left: 0, top: 42, zIndex: 3 },
  gymFeatBottom: { padding: 12, paddingLeft: 28, gap: 2 },
  gymFeatRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  gymFeatRatingText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#FBBF24' },
  gymFeatName:   { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  gymFeatCity:   { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  gymFeatPrice:  { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent, marginTop: 2 },
  gymFeatSubscribed: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent, marginTop: 2 },
  gymListSection: { marginBottom: 24 },
  gymListWrap: { marginHorizontal: 20, gap: 12 },
  gymListCard: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden',
  },
  gymListImg: { width: 104, height: 96, justifyContent: 'flex-start' },
  gymListImgDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radius.lg },
  gymListRating: {
    alignSelf: 'flex-start',
    margin: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  gymListRatingText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#FBBF24' },
  gymListBody: { flex: 1, minWidth: 0, justifyContent: 'space-between', paddingVertical: 2 },
  gymListName: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', lineHeight: 18 },
  gymListCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  gymListCity: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  gymListBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gymListPrice: { flex: 1, minWidth: 0, fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent },
  gymListCta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  gymListCtaText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent },
  gymListBookCta: { backgroundColor: colors.accent, borderColor: colors.accent },
  gymListBookCtaText: { color: '#060606' },
  gymListSubscribedBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,212,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,106,0.35)',
  },
  gymListSubscribedText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.accent },

  // Products
  productCard: { width: 148, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  productImg:  { width: 148, height: 130 },
  productBody: { padding: 10, gap: 4 },
  productDiscount: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  productDiscountText: { fontFamily: fonts.sansBold, fontSize: 9, color: '#060606' },
  productName: { fontFamily: fonts.sansMedium, fontSize: 11, color: '#fff', lineHeight: 15 },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productPrice: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent },
  productMrp:  { fontFamily: fonts.sans, fontSize: 10, color: colors.t3, textDecorationLine: 'line-through' },

  // Trust
  trustRow:  { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16 },
  trustItem: { flex: 1, alignItems: 'center', gap: 4 },
  trustIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(61,255,84,0.1)', borderWidth: 1, borderColor: 'rgba(61,255,84,0.18)', alignItems: 'center', justifyContent: 'center' },
  trustLabel: { fontFamily: fonts.sansBold, fontSize: 8, color: '#fff', textAlign: 'center' },
  trustSub:   { fontFamily: fonts.sans, fontSize: 7, color: colors.t2, textAlign: 'center' },

  // Testimonials
  testimonialCard: { width: W * 0.72, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16 },
  testimonialText: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18, fontStyle: 'italic' },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(61,255,84,0.12)', borderWidth: 1, borderColor: 'rgba(61,255,84,0.22)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent },
  authorName: { fontFamily: fonts.sansBold, fontSize: 12, color: '#fff' },
  authorCity: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2 },

  // City picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  cityPickerSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cityPickerHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  cityPickerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff', marginBottom: 16 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  cityRowActive: { borderBottomColor: colors.accentBorder },
  cityRowText: { fontFamily: fonts.sans, fontSize: 15, color: colors.t, flex: 1 },
  cityActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
