import { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme/brand';
import { IconCalendar, IconQR, IconClock, IconPin, IconReceipt } from '../../components/Icons';
import { qrApi, api } from '../../lib/api';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: colors.accent,
  pending: '#ffb400',
  cancelled: '#ff5a5a',
  completed: colors.t2,
};

export default function BookingsTab() {
  const [activeTab, setActiveTab] = useState<'gym' | 'wellness'>('gym');
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [wellnessBookings, setWellnessBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wellnessLoading, setWellnessLoading] = useState(false);

  function loadGymBooking() {
    return qrApi.getActiveBooking()
      .then((res: any) => {
        if (res?.active && res.bookingQr) setActiveBooking(res.bookingQr);
        else setActiveBooking(null);
      })
      .catch(() => setActiveBooking(null));
  }

  function loadWellnessBookings() {
    setWellnessLoading(true);
    return api.get('/wellness/bookings/my')
      .then((res: any) => setWellnessBookings(Array.isArray(res) ? res : []))
      .catch(() => setWellnessBookings([]))
      .finally(() => setWellnessLoading(false));
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([loadGymBooking(), loadWellnessBookings()])
      .finally(() => setLoading(false));
  }, []));

  function handleCancelGym() {
    Alert.alert('Cancel Booking', 'Are you sure? This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/sessions/cancel/${activeBooking.id}`, {});
            loadGymBooking();
            Alert.alert('Cancelled', 'Your booking has been cancelled.');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not cancel booking.');
          }
        },
      },
    ]);
  }

  async function handleViewInvoice(bookingId: string) {
    try {
      const inv: any = await api.get(`/wellness/bookings/${bookingId}/invoice`);
      Alert.alert(
        `Invoice ${inv.invoiceNumber}`,
        `Service: ${inv.service?.name || '—'}\n` +
        `Provider: ${inv.partner?.name || '—'}\n` +
        `Date: ${formatDate(inv.bookingDate)}\n` +
        `Amount: ₹${Number(inv.amount).toLocaleString()}\n` +
        `Status: ${inv.status}`,
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Invoice', 'Could not load invoice. Please try again.');
    }
  }

  const secsLeft = activeBooking
    ? Math.max(0, Math.floor((new Date(activeBooking.expiresAt).getTime() - Date.now()) / 1000))
    : 0;
  const hrs = Math.floor(secsLeft / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.headerRow}>
        <Text style={s.pageTitle}>My Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['gym', 'wellness'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'gym' ? 'Gym Sessions' : 'Wellness'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.centre}><ActivityIndicator color={colors.accent} /></View>
        ) : activeTab === 'gym' ? (
          // ─── Gym Bookings ─────────────────────────────────────────────────
          activeBooking ? (
            <TouchableOpacity
              style={s.activeCard}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/qr', params: {
                token: activeBooking.token,
                expiresAt: activeBooking.expiresAt,
                bookedAt: activeBooking.bookedAt,
                gymName: activeBooking.gymName || '',
              }})}
            >
              <View style={s.activeTop}>
                <View style={s.statusDot} />
                <Text style={s.statusText}>Active Session</Text>
              </View>
              <Text style={s.gymNameText}>{activeBooking.gymName || 'Booked Gym'}</Text>
              <View style={s.metaRow}>
                <IconCalendar size={13} color={colors.t2} />
                <Text style={s.metaText}>{formatDate(activeBooking.bookedAt)} · {formatTime(activeBooking.bookedAt)}</Text>
              </View>
              {secsLeft > 0 && (
                <View style={s.timerRow}>
                  <IconClock size={13} color={colors.accent} />
                  <Text style={s.timerText}>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`} remaining</Text>
                </View>
              )}
              <View style={s.qrBtnRow}>
                <View style={s.qrBtn}>
                  <IconQR size={16} color="#060606" />
                  <Text style={s.qrBtnText}>Show QR</Text>
                </View>
              </View>
              <TouchableOpacity style={s.cancelBtn} onPress={(e) => { e.stopPropagation(); handleCancelGym(); }}>
                <Text style={s.cancelBtnText}>Cancel Booking</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}><IconCalendar size={32} color={colors.t2} /></View>
              <Text style={s.emptyTitle}>No Active Sessions</Text>
              <Text style={s.emptySub}>Book a gym slot to see your active session here.</Text>
              <TouchableOpacity style={s.browseBtn} onPress={() => router.push('/(tabs)/explore' as any)}>
                <Text style={s.browseBtnText}>Browse Gyms</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          // ─── Wellness Bookings ─────────────────────────────────────────────
          wellnessLoading ? (
            <View style={s.centre}><ActivityIndicator color={colors.accent} /></View>
          ) : wellnessBookings.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}><IconPin size={32} color={colors.t2} /></View>
              <Text style={s.emptyTitle}>No Wellness Bookings</Text>
              <Text style={s.emptySub}>Book a spa session or home service to see it here.</Text>
              <TouchableOpacity style={s.browseBtn} onPress={() => router.push('/(tabs)/explore' as any)}>
                <Text style={s.browseBtnText}>Explore Wellness</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {wellnessBookings.map((b) => {
                const statusColor = STATUS_COLORS[b.status] || colors.t2;
                return (
                  <View key={b.id} style={s.wellnessCard}>
                    <View style={s.wellnessCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.wellnessServiceName}>{b.service?.name || 'Wellness Service'}</Text>
                        <Text style={s.wellnessPartnerName}>{b.partner?.name || ''}</Text>
                      </View>
                      <View style={[s.statusBadge, { borderColor: statusColor + '50', backgroundColor: statusColor + '15' }]}>
                        <Text style={[s.statusBadgeText, { color: statusColor }]}>
                          {(b.status || 'pending').charAt(0).toUpperCase() + (b.status || 'pending').slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={s.wellnessMeta}>
                      <View style={s.metaRow}>
                        <IconCalendar size={12} color={colors.t2} />
                        <Text style={s.metaText}>{formatDate(b.bookingDate)} · {formatTime(b.bookingDate)}</Text>
                      </View>
                      {b.service?.durationMinutes ? (
                        <View style={s.metaRow}>
                          <IconClock size={12} color={colors.t2} />
                          <Text style={s.metaText}>{b.service.durationMinutes} min</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={s.wellnessFooter}>
                      <Text style={s.wellnessAmount}>₹{Number(b.amount || 0).toLocaleString()}</Text>
                      <TouchableOpacity
                        style={s.invoiceBtn}
                        onPress={() => handleViewInvoice(b.id)}
                      >
                        <IconReceipt size={13} color={colors.accent} />
                        <Text style={s.invoiceBtnText}>Invoice</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 4 },
  pageTitle: { fontFamily: fonts.serif, fontSize: 26, color: '#fff' },

  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginVertical: 14,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.lg,
  },
  tabActive: { backgroundColor: colors.accentSoft },
  tabText: { fontFamily: fonts.sansMedium ?? fonts.sans, fontSize: 13, color: colors.t2 },
  tabTextActive: { fontFamily: fonts.sansBold, color: colors.accent },

  container: { paddingHorizontal: spacing.lg, paddingBottom: 16 },
  centre: { paddingTop: 60, alignItems: 'center' },

  // Gym session card
  activeCard: {
    backgroundColor: 'rgba(0,212,106,0.06)', borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.25)', padding: 20, gap: 10,
  },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  statusText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  gymNameText: { fontFamily: fonts.sansBold, fontSize: 22, color: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.accent },
  qrBtnRow: { marginTop: 4 },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10,
  },
  qrBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#060606' },
  cancelBtn: {
    borderWidth: 1, borderColor: 'rgba(255,80,80,0.4)',
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4,
  },
  cancelBtnText: { fontFamily: fonts.sansMedium ?? fonts.sans, fontSize: 12, color: 'rgba(255,100,100,0.9)' },

  // Wellness cards
  wellnessCard: {
    backgroundColor: colors.glass, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderGlass, padding: 16,
  },
  wellnessCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  wellnessServiceName: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff', marginBottom: 3 },
  wellnessPartnerName: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  statusBadge: {
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
  wellnessMeta: { gap: 5, marginBottom: 12 },
  wellnessFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12,
  },
  wellnessAmount: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff' },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  invoiceBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent },

  // Empty state
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: '#fff' },
  emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center', maxWidth: 240, lineHeight: 20 },
  browseBtn: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: 8,
  },
  browseBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: '#060606' },
});

