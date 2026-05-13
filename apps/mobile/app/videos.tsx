import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ImageBackground, Alert, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconPlay, IconLock, IconClock } from '../components/Icons';
import { miscApi } from '../lib/api';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const FILTERS = ['All', 'Free', 'Premium', 'Cardio', 'Yoga', 'HIIT'];

export default function Videos() {
  const [filter, setFilter] = useState('All');
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await miscApi.videos();
      const raw = Array.isArray(data) ? data : data?.videos || data?.data || [];
      setVideos(raw.map((v: any) => ({
        ...v,
        id: v._id || v.id || String(Math.random()),
        duration: v.duration || (v.durationSeconds ? `${Math.floor(v.durationSeconds / 60)} min` : '--'),
        instructor: v.instructor || v.instructorName || '--',
        category: v.category || v.type || 'General',
        thumb: v.thumb || v.thumbnail || v.thumbnailUrl || '',
        premium: v.premium || v.isPremium || false,
      })));
    } catch (e: any) {
      setVideos([]);
      setError(e?.message || 'Could not load workout videos.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = videos.filter((v) => {
    if (filter === 'All') return true;
    if (filter === 'Free') return !v.premium;
    if (filter === 'Premium') return v.premium;
    return v.category === filter;
  });

  const handleVideoPress = (video: any) => {
    if (video.premium) {
      Alert.alert('Premium Content', 'Upgrade to Pro or Elite plan to unlock this video.', [
        { text: 'Upgrade', onPress: () => router.push('/plans') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const videoUrl = video.url ?? video.videoUrl ?? '';
    if (!videoUrl) {
      Alert.alert('Video unavailable', 'This workout video does not have a playable URL yet.');
      return;
    }
    router.push({
      pathname: '/video-player',
      params: { url: videoUrl, title: video.title, instructor: video.instructor, duration: video.duration },
    } as any);
  };

  return (
    <AuroraBackground variant="default">
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Workout Videos</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={s.filterScroll}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} style={[s.pill, filter === f && s.pillActive]} onPress={() => setFilter(f)}>
              <Text style={[s.pillText, filter === f && s.pillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.grid}>
          {!loading && filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyTitle}>No videos found</Text>
              <Text style={s.emptyText}>{error || 'No workout videos are available for this filter right now.'}</Text>
            </View>
          ) : filtered.map((video) => (
            <TouchableOpacity key={video.id} style={s.videoCard} onPress={() => handleVideoPress(video)} activeOpacity={0.85}>
              <ImageBackground source={video.thumb ? { uri: video.thumb } : undefined as any} style={s.thumb} imageStyle={{ borderRadius: radius.lg }}>
                <View style={s.thumbOverlay} />
                <View style={s.durationBadge}>
                  <IconClock size={10} color="#fff" />
                  <Text style={s.durationText}>{video.duration}</Text>
                </View>
                <View style={s.playBtn}>
                  {video.premium ? <IconLock size={16} color="#fff" /> : <IconPlay size={16} color="#060606" />}
                </View>
                {video.premium && (
                  <View style={s.premiumBadge}>
                    <Text style={s.premiumBadgeText}>PRO</Text>
                  </View>
                )}
              </ImageBackground>
              <Text style={s.videoTitle} numberOfLines={2}>{video.title || 'Untitled video'}</Text>
              <Text style={s.instructor}>{video.instructor}</Text>
              <View style={[s.freeBadge, video.premium && s.proBadge]}>
                <Text style={[s.freeBadgeText, video.premium && s.proBadgeText]}>{video.premium ? 'Premium' : 'Free'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  filterScroll: { maxHeight: 52 },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass },
  pillActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.t },
  pillTextActive: { color: colors.accent },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  emptyState: { width: '100%', padding: 24, borderRadius: radius.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff', marginBottom: 6 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center' },
  videoCard: { width: CARD_W },
  thumb: { width: CARD_W, height: CARD_W * 0.65, borderRadius: radius.lg, marginBottom: 8, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: colors.surface },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  durationBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 12, margin: 8 },
  durationText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#fff' },
  playBtn: { position: 'absolute', alignSelf: 'center', top: '38%', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  premiumBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(155,0,255,0.85)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  premiumBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: '#fff' },
  videoTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff', lineHeight: 17, minHeight: 34 },
  instructor: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginTop: 2 },
  freeBadge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0,212,106,0.13)' },
  freeBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.accent },
  proBadge: { backgroundColor: 'rgba(155,0,255,0.15)' },
  proBadgeText: { color: '#c084fc' },
});
