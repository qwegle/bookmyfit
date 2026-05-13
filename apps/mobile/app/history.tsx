import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconBolt, IconCheck, IconClock, IconDumbbell } from '../components/Icons';
import { checkinApi } from '../lib/api';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getMonthGroup(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function calcDuration(start: string, end: string | null) {
  if (!end) return null;
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 1) return null;
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function calcStreak(visits: any[]) {
  if (!visits.length) return 0;
  const sorted = [...visits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  let streak = 0;
  let prevDate: Date | null = null;
  for (const v of sorted) {
    if (v.status !== 'success') continue;
    const d = new Date(v.createdAt);
    d.setHours(0, 0, 0, 0);
    if (!prevDate) { streak = 1; prevDate = d; continue; }
    const diff = (prevDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) { streak++; prevDate = d; }
    else break;
  }
  return streak;
}

export default function HistoryScreen() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkinApi.history(50)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.checkins || data?.data || [];
        setVisits(list);
      })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, []);

  const streak = calcStreak(visits);
  const successCount = visits.filter((v) => v.status === 'success' || v.status === 'checked_out').length;

  // Group visits by month
  const grouped = visits.reduce((acc: Record<string, any[]>, v) => {
    const month = getMonthGroup(v.createdAt);
    if (!acc[month]) acc[month] = [];
    acc[month].push(v);
    return acc;
  }, {});

  return (
    <AuroraBackground variant="default">
    <SafeAreaView style={{ flex: 1 }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Visit History</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Summary strip */}
      <View style={s.summaryRow}>
        <View style={s.summaryBox}>
          <Text style={s.summaryVal}>{loading ? '—' : successCount}</Text>
          <Text style={s.summaryLabel}>Total Visits</Text>
        </View>
        <View style={s.summaryBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconBolt size={14} color="#FF8C42" />
            <Text style={[s.summaryVal, { color: '#FF8C42' }]}>{loading ? '--' : streak}</Text>
          </View>
          <Text style={s.summaryLabel}>Day Streak</Text>
        </View>
        <View style={s.summaryBox}>
          <Text style={s.summaryVal}>{loading ? '—' : (visits.length > 0 ? `${Math.ceil(visits.length / 4)}w` : '0w')}</Text>
          <Text style={s.summaryLabel}>This Month</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : visits.length === 0 ? (
        <View style={s.emptyState}>
          <IconDumbbell size={44} color={colors.accent} />
          <Text style={s.emptyTitle}>No visits yet</Text>
          <Text style={s.emptyBody}>Check in at a gym to start tracking</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {Object.entries(grouped).map(([month, monthVisits]) => (
            <View key={month}>
              <Text style={s.monthHeader}>{month}</Text>
              {(monthVisits as any[]).map((v: any, i: number) => {
                const gymName = v.gym?.name || v.gymName || 'Gym';
                const planName = v.plan?.name || v.planName || '';
                const isSuccess = v.status === 'success' || v.status === 'checked_out';
                const duration = calcDuration(v.createdAt, v.checkoutAt);
                const timeStr = formatTime(v.createdAt);
                const dateStr = formatDate(v.createdAt);
                return (
                  <View key={v.id || v._id || i} style={s.visitCard}>
                    <View style={s.visitIcon}>
                      <IconDumbbell size={16} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.visitGym}>{gymName}</Text>
                      <Text style={s.visitTime}>{timeStr}{planName ? ` · ${planName}` : ''}</Text>
                      <View style={s.visitMeta}>
                        {duration && (
                          <View style={s.chip}>
                            <IconClock size={9} color={colors.t2} />
                            <Text style={s.chipText}>{duration}</Text>
                          </View>
                        )}
                        <View style={s.chip}>
                          <IconCheck size={9} color={isSuccess ? colors.accent : colors.error} />
                          <Text style={[s.chipText, { color: isSuccess ? colors.accent : colors.error }]}>
                            {isSuccess ? 'Success' : 'Failed'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.visitDate}>{dateStr}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 12 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.serif, fontSize: 18, color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginBottom: 16 },
  summaryBox: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.lg,
  },
  summaryVal: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  summaryLabel: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2, marginTop: 2 },
  monthHeader: {
    fontFamily: fonts.sansBold, fontSize: 10, color: colors.t2,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  list: { paddingHorizontal: 22, paddingBottom: 40 },
  visitCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.lg, padding: 14, marginBottom: 10,
  },
  visitIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  visitGym: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff' },
  visitTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginTop: 2 },
  visitMeta: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  chipText: { fontFamily: fonts.sans, fontSize: 9, color: colors.t2 },
  visitDate: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.t2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
});
