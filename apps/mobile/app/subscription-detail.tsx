import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconRefresh, IconFileText, IconCalendar, IconDumbbell, IconBolt } from '../components/Icons';
import { subscriptionsApi } from '../lib/api';
import { subscriptionPlanType } from '../lib/subscriptionAccess';
import { DEFAULT_GYM_IMAGE, firstImage } from '../lib/imageFallbacks';

function calcProgress(startDate: string, endDate: string) {
  const start = dateMs(startDate, false);
  const end = dateMs(endDate, true);
  const now = Date.now();
  if (now >= end) return 1;
  if (now <= start) return 0;
  return (now - start) / (end - start);
}

function daysLeft(endDate: string) {
  const diff = dateMs(endDate, true) - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Expired';
  if (days === 1) return 'Last day';
  return `${days} days left`;
}

function dateMs(value: string, endOfDay: boolean) {
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}${suffix}`) : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

export default function SubscriptionDetail() {
  const {
    subscriptionId,
  } = useLocalSearchParams<{
    subscriptionId?: string;
  }>();
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionsApi.mySubscriptions()
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : data?.subscriptions || data?.data || [];
        const found = list.find((s: any) => (s.id || s._id) === subscriptionId);
        setSub(found || null);
      })
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, [subscriptionId]);

  const resolvedSub = sub;

  if (loading) {
    return (
      <AuroraBackground variant="premium"><SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView></AuroraBackground>
    );
  }

  if (!resolvedSub) {
    return (
      <AuroraBackground variant="premium">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <IconArrowLeft size={18} color={colors.t} />
            </TouchableOpacity>
            <Text style={s.title}>Membership Detail</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
            <IconDumbbell size={48} color={colors.accent} />
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: '#fff', textAlign: 'center' }}>Membership Details Unavailable</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.t2, textAlign: 'center', lineHeight: 20 }}>
              We could not load this membership. Please check your connection and try again.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.accent, borderRadius: radius.xl, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 }}
              onPress={() => router.back()}
            >
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: '#060606' }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  const sub2 = resolvedSub;
  const gymName = sub2.gym?.name || sub2.gymName || 'Gym';
  const planName = sub2.plan?.name || sub2.planName || 'Plan';
  const duration = sub2.durationMonths ? `${sub2.durationMonths} Month${sub2.durationMonths > 1 ? 's' : ''}` : '';
  const status = (sub2.status || 'active').toLowerCase();
  const isActive = status === 'active';
  const img = firstImage(sub2.gym?.images, sub2.gym?.photos, sub2.gym?.coverImage, sub2.gym?.coverPhoto, sub2.coverImage) || DEFAULT_GYM_IMAGE;
  const progress = sub2.progress ?? (sub2.startDate && sub2.endDate ? calcProgress(sub2.startDate, sub2.endDate) : 0);
  const daysLeftStr = sub2.endDate ? daysLeft(sub2.endDate) : (isActive ? 'Active' : 'Expired');
  const left = daysLeftStr;
  const startFmt = sub2.startDate ? new Date(sub2.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const endFmt = sub2.endDate ? new Date(sub2.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const subId = sub2.id || sub2._id;
  const planType = subscriptionPlanType(sub2);
  const gymIds = Array.isArray(sub2.gymIds) ? sub2.gymIds : [];
  const actionGymId = sub2.gym?.id || sub2.gymId || gymIds[0] || '';
  const shouldBrowseGyms = planType === 'multi_gym' || !actionGymId;

  return (
    <AuroraBackground variant="premium">
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <IconArrowLeft size={18} color={colors.t} />
          </TouchableOpacity>
          <Text style={s.title}>Membership Detail</Text>
        </View>

        {/* Hero card */}
        <View style={[s.heroCard, !isActive && { opacity: 0.8 }]}>
          <ImageBackground source={{ uri: img }} style={s.heroImg} imageStyle={{ borderRadius: radius.xl }}>
            <View style={s.heroDark} />
            <View style={s.heroBody}>
              <View>
                <View style={s.tierBadge}>
                  <IconBolt size={10} color={isActive ? colors.accent : colors.t2} />
                  <Text style={[s.tierText, !isActive && { color: colors.t2 }]}>{isActive ? 'Active' : 'Expired'}</Text>
                </View>
                <Text style={s.gymName}>{gymName}</Text>
                <Text style={s.planName}>{planName}{duration ? ` · ${duration}` : ''}</Text>
              </View>
              <View style={s.barWrap}>
                <View style={s.barLabels}>
                  <Text style={s.barLabel}>Started {startFmt}</Text>
                  <Text style={[s.barLabel, isActive ? { color: 'rgba(255,150,50,0.85)' } : { color: 'rgba(255,80,80,0.7)' }]}>{left}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.min(progress * 100, 100)}%` }, !isActive && { opacity: 0.3 }]} />
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Details */}
        <View style={s.detailCard}>
          <View style={s.detailRow}>
            <View style={s.detailIconBox}><IconCalendar size={14} color={colors.accent} /></View>
            <View>
              <Text style={s.detailLabel}>Valid From</Text>
              <Text style={s.detailValue}>{startFmt}</Text>
            </View>
          </View>
          <View style={[s.detailRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={s.detailIconBox}><IconCalendar size={14} color={colors.t} /></View>
            <View>
              <Text style={s.detailLabel}>Valid Until</Text>
              <Text style={s.detailValue}>{endFmt}</Text>
            </View>
          </View>
          <View style={[s.detailRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={s.detailIconBox}><IconDumbbell size={14} color={colors.t} /></View>
            <View>
              <Text style={s.detailLabel}>Gym</Text>
              <Text style={s.detailValue}>{gymName}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {isActive && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => {
              if (shouldBrowseGyms) router.push('/gyms' as any);
              else router.push({ pathname: '/slots', params: { gymId: actionGymId } } as any);
            }}
          >
            <IconCalendar size={16} color="#000" />
            <Text style={s.actionBtnText}>{shouldBrowseGyms ? 'Browse Gyms' : 'Book a Slot'}</Text>
          </TouchableOpacity>
        )}

        {!isActive && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnSecondary]} onPress={() => router.push('/plans')}>
            <IconRefresh size={16} color={colors.accent} />
            <Text style={[s.actionBtnText, { color: colors.accent }]}>Renew Subscription</Text>
          </TouchableOpacity>
        )}

        {/* Download Invoice */}
        <TouchableOpacity
          style={[s.actionBtn, s.actionBtnGhost]}
          onPress={() => router.push({ pathname: '/invoice', params: { subscriptionId: subId } } as any)}
        >
          <IconFileText size={16} color={colors.t} />
          <Text style={[s.actionBtnText, { color: colors.t }]}>Download Invoice</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', letterSpacing: -0.5 },
  heroCard: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: 16 },
  heroImg: { minHeight: 200 },
  heroDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  heroBody: { padding: 18, justifyContent: 'space-between', flex: 1, minHeight: 200 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, marginBottom: 8,
  },
  tierText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.accent, letterSpacing: 0.5 },
  gymName: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', letterSpacing: -0.5 },
  planName: { fontFamily: fonts.sans, fontSize: 12, color: colors.t, marginTop: 4 },
  barWrap: { marginTop: 18 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2 },
  barTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  detailCard: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  detailIconBox: {
    width: 34, height: 34, borderRadius: radius.sm,
    backgroundColor: colors.glassDark, alignItems: 'center', justifyContent: 'center',
  },
  detailLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2, marginBottom: 2 },
  detailValue: { fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff' },
  actionBtn: {
    height: 52, borderRadius: radius.lg,
    backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 10,
  },
  actionBtnSecondary: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder },
  actionBtnGhost: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass },
  actionBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
});
