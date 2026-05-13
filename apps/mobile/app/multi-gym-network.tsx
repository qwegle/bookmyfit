import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ImageBackground, ActivityIndicator, Dimensions, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconStar, IconPin, IconSearch } from '../components/Icons';
import { gymsApi } from '../lib/api';
import { DEFAULT_GYM_IMAGE, firstImage } from '../lib/imageFallbacks';

const { width: W } = Dimensions.get('window');

function SkRow() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
      <View style={{ width: 90, height: 90, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
        <View style={{ height: 16, width: '65%', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ height: 12, width: '45%', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ height: 12, width: '35%', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      </View>
    </View>
  );
}

export default function MultiGymNetwork() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeArea, setActiveArea] = useState('All Areas');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gymsApi.list({ page: 1, limit: 50 })
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.gyms || data?.data || [];
        setGyms(list);
        setError(null);
      })
      .catch(() => {
        setGyms([]);
        setError('Could not load partner gyms from the API.');
      })
      .finally(() => setLoading(false));
  }, []);

  const areaFilters = useMemo(() => {
    const seen = new Set<string>();
    const areas = gyms
      .map((gym: any) => gym.area || gym.location?.area || '')
      .filter((area: string) => {
        if (!area || seen.has(area)) return false;
        seen.add(area);
        return true;
      });
    return ['All Areas', ...areas];
  }, [gyms]);

  const filtered = gyms.filter((gym: any) => {
    const area = gym.area || gym.location?.area || '';
    const matchArea = activeArea === 'All Areas' || area.toLowerCase().includes(activeArea.toLowerCase());
    if (!matchArea) return false;
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (gym.name || '').toLowerCase().includes(q) ||
      (gym.city || '').toLowerCase().includes(q) ||
      area.toLowerCase().includes(q) ||
      (gym.amenities || []).some((a: string) => a.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <IconArrowLeft size={18} color={colors.t} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Partner Gyms</Text>
          <Text style={s.headerSub}>{loading ? '...' : `${filtered.length} gyms in network`}</Text>
        </View>
      </View>

      {/* Network badge */}
      <View style={s.networkBadge}>
        <View style={s.networkDot} />
        <Text style={s.networkText}>Multi Gym Pass — valid at all locations below</Text>
      </View>

      {/* Search bar */}
      <View style={s.searchRow}>
        <IconSearch size={14} color={colors.t3} />
        <TextInput
          style={s.searchInput}
          placeholder="Search gym, area, amenity…"
          placeholderTextColor={colors.t3}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Area filter chips */}
      <FlatList
        data={areaFilters}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={a => a}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 }}
        renderItem={({ item: area }) => {
          const active = activeArea === area;
          return (
            <TouchableOpacity
              style={[s.areaChip, active && s.areaChipActive]}
              onPress={() => setActiveArea(area)}
            >
              <Text style={[s.areaChipText, active && s.areaChipTextActive]}>{area}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          [1,2,3,4].map(i => <SkRow key={i} />)
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: '#fff' }}>No gyms found</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center' }}>{error || 'Try a different search or area'}</Text>
          </View>
        ) : (
          filtered.map((gym: any) => {
            const gymId = gym.id || gym._id;
            const name = gym.name || 'Gym';
            const city = gym.city || '';
            const area = gym.area || gym.location?.area || '';
            const rating = Number(gym.rating || gym.avgRating || 0);
            const img = firstImage(gym.images, gym.photos, gym.coverImage, gym.coverPhoto) || DEFAULT_GYM_IMAGE;
            const amenities: string[] = (gym.amenities || []).slice(0, 3);

            return (
              <TouchableOpacity
                key={gymId}
                style={s.gymCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/gym/[id]', params: { id: gymId } } as any)}
              >
                <ImageBackground source={{ uri: img }} style={s.gymThumb} imageStyle={{ borderRadius: radius.md }}>
                  <View style={s.thumbDark} />
                </ImageBackground>
                <View style={s.gymInfo}>
                  <Text style={s.gymName} numberOfLines={1}>{name}</Text>
                  <View style={s.metaRow}>
                    <IconPin size={10} color={colors.t2} />
                    <Text style={s.metaText} numberOfLines={1}>{area ? `${area}, ` : ''}{city}</Text>
                  </View>
                  {rating > 0 && (
                    <View style={s.ratingRow}>
                      <IconStar size={11} color="#FBBF24" />
                      <Text style={s.ratingText}>{rating.toFixed(1)}</Text>
                    </View>
                  )}
                  {amenities.length > 0 && (
                    <View style={s.tagsRow}>
                      {amenities.map((a) => (
                        <View key={a} style={s.tag}><Text style={s.tagText}>{a}</Text></View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={s.checkBadge}>
                  <Text style={s.checkText}>✓</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginTop: 1 },
  networkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8,
  },
  networkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  networkText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.accent },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: '#fff' },
  areaChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.borderGlass,
  },
  areaChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  areaChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.t2 },
  areaChipTextActive: { color: colors.accent },
  container: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  gymCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 10, marginBottom: 12, alignItems: 'center',
  },
  gymThumb: { width: 80, height: 80, borderRadius: radius.md, overflow: 'hidden' },
  gymThumbEmpty: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass, alignItems: 'center', justifyContent: 'center' },
  thumbDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  gymInfo: { flex: 1, gap: 4 },
  gymName: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.sansBold, fontSize: 11, color: '#FBBF24' },
  tagsRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2 },
  checkBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  checkText: { fontSize: 12, color: colors.accent },
});
