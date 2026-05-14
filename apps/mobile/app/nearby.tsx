import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { colors, fonts, radius } from '../theme/brand';
import { IconChevronLeft, IconStar, IconPin } from '../components/Icons';
import { API_BASE } from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W = W * 0.72;
const MAP_H = H * 0.52;

interface NearbyGym {
  id: string; name: string; address?: string; city?: string;
  latitude?: number; longitude?: number; lat?: number; lng?: number;
  rating?: number; tier?: string; minPrice?: number;
}

const TIER_COLORS: Record<string, string> = {
  elite: '#FBBF24', pro: colors.accent, individual: '#60A5FA',
};

// Bhubaneswar bounding box
const MIN_LAT = 20.22, MAX_LAT = 20.40, MIN_LNG = 85.74, MAX_LNG = 85.90;

function toScreen(lat: number, lng: number) {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * (W - 60) + 16;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (MAP_H - 80) + 24;
  return { x, y };
}

function gymLat(gym: NearbyGym) {
  const num = Number(gym.lat ?? gym.latitude);
  return Number.isFinite(num) && num !== 0 ? num : null;
}

function gymLng(gym: NearbyGym) {
  const num = Number(gym.lng ?? gym.longitude);
  return Number.isFinite(num) && num !== 0 ? num : null;
}

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const [gyms, setGyms] = useState<NearbyGym[]>([]);
  const [userPos, setUserPos] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let lat = 20.2961, lng = 85.8245;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch {}
      }
      setUserPos(toScreen(lat, lng));

      try {
        const res = await fetch(`${API_BASE}/api/v1/gyms?limit=20`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.data || data?.gyms || data?.items || [];
          const items: NearbyGym[] = list.filter((g: NearbyGym) => gymLat(g) !== null && gymLng(g) !== null);
          setGyms(items);
          setError(null);
        } else {
          setGyms([]);
          setError('Could not load gyms from the API.');
        }
      } catch {
        setGyms([]);
        setError('Could not load gyms from the API.');
      }
      setLoading(false);
    })();
  }, []);

  const selectGym = (gym: NearbyGym) => {
    setSelectedId(gym.id);
    const idx = gyms.findIndex((g) => g.id === gym.id);
    if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  };

  return (
    <View style={s.root}>
      {/* ── Custom map canvas ── */}
      <View style={[s.mapCanvas, { height: MAP_H }]}>
        {/* Grid — simulates map tiles */}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <View key={`h${f}`} style={[s.gridH, { top: MAP_H * f }]} />
        ))}
        {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f) => (
          <View key={`v${f}`} style={[s.gridV, { left: W * f }]} />
        ))}
        {/* Simulated roads */}
        <View style={[s.road, { top: MAP_H * 0.38, width: W * 0.7, left: W * 0.15 }]} />
        <View style={[s.road, { top: MAP_H * 0.62, width: W * 0.55, left: W * 0.2 }]} />
        <View style={[s.roadV, { left: W * 0.45, height: MAP_H * 0.6, top: MAP_H * 0.1 }]} />
        <View style={[s.roadV, { left: W * 0.68, height: MAP_H * 0.5, top: MAP_H * 0.25 }]} />

        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={s.loadingText}>Finding gyms near you…</Text>
          </View>
        )}

        {/* User location dot */}
        {!loading && userPos && (
          <View style={[s.userDot, { left: userPos.x - 10, top: userPos.y - 10 }]}>
            <View style={s.userPulse} />
            <View style={s.userCore} />
          </View>
        )}

        {/* Gym pins */}
        {!loading && gyms.map((gym) => {
          const lat = gymLat(gym);
          const lng = gymLng(gym);
          if (lat === null || lng === null) return null;
          const { x, y } = toScreen(lat, lng);
          const tc = TIER_COLORS[gym.tier || 'individual'] ?? colors.accent;
          const sel = selectedId === gym.id;
          return (
            <TouchableOpacity key={gym.id} style={[s.pinWrap, { left: x - 32, top: y - 38 }]} onPress={() => selectGym(gym)} activeOpacity={0.8}>
              <View style={[s.pinBubble, { borderColor: sel ? tc : tc + '60', backgroundColor: sel ? tc : 'rgba(12,12,18,0.92)' }]}>
                <Text style={[s.pinLabel, { color: sel ? '#000' : tc }]} numberOfLines={1}>
                  {gym.name.split(' ')[0]}
                </Text>
              </View>
              <View style={[s.pinTail, { borderTopColor: sel ? tc : tc + '60' }]} />
            </TouchableOpacity>
          );
        })}

        {/* City label */}
        <View style={s.cityLabel}>
          <View style={[s.cityDot, { backgroundColor: colors.accent }]} />
          <Text style={s.cityText}>Bhubaneswar</Text>
        </View>
      </View>

      {/* ── Back + header overlay ── */}
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity style={[s.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()} activeOpacity={0.8}>
          <IconChevronLeft size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[s.headerWrap, { top: insets.top + 10 }]}>
          <Text style={s.headerTitle}>Gyms Near You</Text>
          <Text style={s.headerSub}>{gyms.length} found · Tap pin to select</Text>
        </View>
      </SafeAreaView>

      {/* ── Bottom sheet ── */}
      <View style={s.sheet}>
        <View style={s.sheetPill} />
        <FlatList
          ref={flatRef}
          data={gyms}
          keyExtractor={(g) => g.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item }) => {
            const sel = selectedId === item.id;
            const tc = TIER_COLORS[item.tier || 'individual'] ?? colors.accent;
            return (
              <TouchableOpacity style={[s.card, sel && { borderColor: tc + '55', backgroundColor: tc + '08' }]} onPress={() => selectGym(item)} activeOpacity={0.88}>
                <View style={[s.cardBar, { backgroundColor: tc }]} />
                <View style={s.cardBody}>
                  <View style={s.cardRow}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.tier === 'elite' && (
                      <View style={s.eliteBadge}><Text style={s.eliteBadgeText}>Elite</Text></View>
                    )}
                  </View>
                  <View style={s.locRow}>
                    <IconPin size={10} color={colors.t2} />
                    <Text style={s.locText} numberOfLines={1}>{item.address || 'Bhubaneswar'}</Text>
                  </View>
                  {item.rating && (
                    <View style={s.ratingRow}>
                      <IconStar size={11} color="#FBBF24" />
                      <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={[s.viewBtn, sel && { borderColor: tc, backgroundColor: tc + '18' }]} onPress={() => router.push({ pathname: '/gym/[id]', params: { id: item.id } } as any)} activeOpacity={0.85}>
                    <Text style={[s.viewBtnText, sel && { color: tc }]}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={!loading ? (
            <View style={s.emptyState}>
              <Text style={s.emptyTitle}>{error ? 'Gyms unavailable' : 'No mapped gyms found'}</Text>
              <Text style={s.emptySub}>{error || 'Gyms with latitude and longitude will appear here.'}</Text>
            </View>
          ) : null}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Map canvas
  mapCanvas: { width: W, backgroundColor: '#080810', overflow: 'hidden', position: 'relative' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  road:  { position: 'absolute', height: 2, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 1 },
  roadV: { position: 'absolute', width: 2,  backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 1 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },

  // User location
  userDot:   { position: 'absolute', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  userPulse: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#60A5FA18', borderWidth: 1, borderColor: '#60A5FA44' },
  userCore:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#60A5FA', borderWidth: 2, borderColor: '#fff' },

  // Gym pins
  pinWrap:   { position: 'absolute', alignItems: 'center' },
  pinBubble: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 16, borderWidth: 1.5, minWidth: 64, alignItems: 'center' },
  pinLabel:  { fontFamily: fonts.sansBold, fontSize: 10 },
  pinTail:   { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },

  cityLabel: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  cityDot:   { width: 6, height: 6, borderRadius: 3 },
  cityText:  { fontFamily: fonts.sansMedium, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 },

  // Back button + header
  backBtn: { position: 'absolute', left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  headerWrap:  { position: 'absolute', left: W / 2 - 90, width: 180, alignItems: 'center' },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  headerSub:   { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.55)', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  // Sheet
  sheet:     { flex: 1, backgroundColor: '#0e0e14', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingTop: 12 },
  sheetPill: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },

  // Cards
  card:     { width: CARD_W, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row' },
  cardBar:  { width: 3 },
  cardBody: { flex: 1, padding: 14, gap: 7 },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', flex: 1 },
  eliteBadge: { backgroundColor: '#FBBF2415', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#FBBF2440' },
  eliteBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: '#FBBF24' },
  locRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#FBBF24' },
  viewBtn:     { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  viewBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.t2 },
  emptyState: { width: W - 36, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff', marginBottom: 6 },
  emptySub: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, textAlign: 'center' },
});
