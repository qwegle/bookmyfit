import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../../theme/brand';
import { IconArrowLeft, IconDollar, IconBolt, IconShopping, IconDumbbell } from '../../components/Icons';
import { gymStaffApi, api } from '../../lib/api';

const EMPTY_EARNINGS = {
  totalEarned: 0,
  month: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  growthPercent: 0,
  breakdown: [
    { label: 'Same Gym Subscriptions', subLabel: 'This month', amount: 0, color: colors.accent, aurora: 'rgba(0,212,106,0.1)' },
    { label: 'Day Passes', subLabel: 'This month', amount: 0, color: 'rgba(180,100,255,0.9)', aurora: 'rgba(155,0,255,0.1)' },
    { label: 'Multi Gym Allocation', subLabel: 'Visit-based share', amount: 0, color: 'rgba(0,200,255,0.9)', aurora: 'rgba(0,180,255,0.1)' },
  ],
  commission: 0,
  netPayout: 0,
  recentSettlements: [] as any[],
};

type EarningsData = typeof EMPTY_EARNINGS;

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function Earnings() {
  const [data, setData] = useState<EarningsData>(EMPTY_EARNINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gymStaffApi.settlements()
      .then((res: any) => {
        const current = res?.current || {};
        const history = Array.isArray(res?.history) ? res.history : Array.isArray(res) ? res : [];
        const total = Number(current.grossRevenue || 0);
        const comm = Number(current.commission || 0);
        setData({
          ...EMPTY_EARNINGS,
          totalEarned: total,
          netPayout: Number(current.netPayout || total - comm),
          commission: comm,
          breakdown: [
            { ...EMPTY_EARNINGS.breakdown[0], amount: Number(current.individualPool || 0) },
            { ...EMPTY_EARNINGS.breakdown[1], amount: Number(current.dayPassPool || 0) },
            { ...EMPTY_EARNINGS.breakdown[2], amount: Number(current.multiGymPool || 0) },
          ],
          recentSettlements: history.slice(0, 5),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRequestPayout = async () => {
    try {
      await api.post('/settlements/request-payout', {});
      Alert.alert('Request Submitted', 'Your payout request has been submitted. Settlements are processed every Monday.');
    } catch {
      Alert.alert('Request Failed', 'Could not submit the payout request. Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero card */}
          <View style={s.heroCard}>
            <View style={s.heroAurora} />
            <View style={s.heroDark} />
            <View style={s.heroBody}>
              <Text style={s.heroLabel}>Total Earned · {data.month}</Text>
              <Text style={s.heroAmount}>{fmt(data.totalEarned)}</Text>
              <Text style={s.heroSub}>+{data.growthPercent}% vs last month</Text>
            </View>
          </View>

          {/* Breakdown */}
          <Text style={s.sectionLabel}>Breakdown</Text>

          {data.breakdown.map((item) => (
            <View key={item.label} style={s.row}>
              <View style={[s.rowIcon, { backgroundColor: item.aurora }]}>
                <IconBolt size={14} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{item.label}</Text>
                <Text style={s.rowSub}>{item.subLabel}</Text>
              </View>
              <Text style={[s.rowAmount, { color: '#fff' }]}>{fmt(item.amount)}</Text>
            </View>
          ))}

          {/* Commission deduction */}
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(255,60,60,0.08)' }]}>
              <IconDollar size={14} color="rgba(255,100,100,0.8)" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Platform Commission</Text>
              <Text style={s.rowSub}>15% of revenue</Text>
            </View>
            <Text style={[s.rowAmount, { color: 'rgba(255,100,100,0.9)' }]}>-{fmt(data.commission)}</Text>
          </View>

          {/* Net payout */}
          <View style={s.netCard}>
            <Text style={s.netLabel}>Net Payout</Text>
            <Text style={s.netAmount}>{fmt(data.netPayout)}</Text>
          </View>

          {/* Recent settlements */}
          {data.recentSettlements.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>Recent Settlements</Text>
              {data.recentSettlements.map((st: any) => (
                <View key={st.id} style={s.settleRow}>
                  <View style={[s.rowIcon, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <IconDumbbell size={14} color={colors.t2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{st.period || 'Settlement'}</Text>
                    <Text style={s.rowSub}>{st.status || 'Pending'}</Text>
                  </View>
                  <Text style={[s.rowAmount, { color: st.status === 'paid' ? colors.accent : '#fff' }]}>
                    {fmt(Number(st.netAmount) || 0)}
                  </Text>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={s.payoutBtn} onPress={handleRequestPayout}>
            <IconDollar size={16} color="#000" />
            <Text style={s.payoutBtnText}>Request Payout</Text>
          </TouchableOpacity>

          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  back: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36 },
  heroCard: {
    height: 160, borderRadius: radius.xl, overflow: 'hidden',
    marginBottom: 24, position: 'relative',
  },
  heroAurora: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Aurora layers
    opacity: 0.9,
  },
  heroDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroBody: {
    flex: 1, padding: 20, justifyContent: 'flex-end', zIndex: 2,
    backgroundColor: 'rgba(6,6,6,0.7)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, letterSpacing: 0.5, marginBottom: 4 },
  heroAmount: { fontFamily: fonts.sansBold, fontSize: 34, color: '#fff', letterSpacing: -1 },
  heroSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent, marginTop: 4 },
  sectionLabel: {
    fontFamily: fonts.sansBold, fontSize: 10, color: colors.t2,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#fff' },
  rowSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginTop: 2 },
  rowAmount: { fontFamily: fonts.sansBold, fontSize: 15 },
  netCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: 'rgba(0,212,106,0.06)', borderWidth: 1, borderColor: 'rgba(0,212,106,0.2)',
    borderRadius: radius.lg, padding: 14,
  },
  netLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  netAmount: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.accent },
  settleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  payoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 30, backgroundColor: colors.accent, marginTop: 24,
  },
  payoutBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
});
