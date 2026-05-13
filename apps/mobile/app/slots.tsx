import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconCalendar, IconClock, IconArrowLeft, IconCheck, IconUsers } from '../components/Icons';
import { api, subscriptionsApi } from '../lib/api';
import { getActiveSubscriptionAccess, normalizeSubscriptionList } from '../lib/subscriptionAccess';

const ALL_SESSION_TYPE = { id: 'all', name: 'All', color: colors.accent };

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function dayLabel(d: Date, index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

export default function SlotsScreen() {
  const { gymId } = useLocalSearchParams<{ gymId?: string }>();
  const days = getNext7Days();
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sessionTypes, setSessionTypes] = useState<any[]>([ALL_SESSION_TYPE]);
  const [activeType, setActiveType] = useState('all');
  const [activeSub, setActiveSub] = useState<any>(null);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const loadSlots = async (dayIndex: number) => {
    setLoading(true);
    setError('');
    try {
      const date = formatDate(days[dayIndex]);
      const res: any = await api.get(`/sessions/slots/${gymId}?date=${date}`);
      let items = Array.isArray(res) ? res : res?.slots ?? res?.data ?? [];

      // Filter out past slots for today
      if (dayIndex === 0) {
        const now = new Date();
        const currentHHMM = now.getHours() * 60 + now.getMinutes();
        items = items.filter((slot: any) => {
          const t = slot.startTime || '00:00';
          const [h, m] = t.split(':').map(Number);
          return (h * 60 + m) > currentHHMM;
        });
      }

      setSlots(items);
    } catch (e: any) {
      setSlots([]);
      setError(e?.message || 'Could not load slots for this date.');
    } finally {
      setLoading(false);
    }
  };

  const loadMyBookings = async () => {
    try {
      const res: any = await api.get('/sessions/my-bookings');
      const items = Array.isArray(res) ? res : res?.bookings ?? res?.data ?? [];
      setMyBookings(items);
    } catch {
      setMyBookings([]);
    }
  };

  useEffect(() => {
    loadSlots(selectedDay);
    loadMyBookings();
    // Fetch session types for this gym
    if (gymId) {
      api.get(`/sessions/types/${gymId}`)
        .then((data: any) => {
          const list = Array.isArray(data) ? data : [];
          setSessionTypes([ALL_SESSION_TYPE, ...list]);
        })
        .catch(() => setSessionTypes([ALL_SESSION_TYPE]));

      subscriptionsApi.mySubscriptions()
        .then((data: any) => {
          const access = getActiveSubscriptionAccess(normalizeSubscriptionList(data));
          setActiveSub(access.byGymId.get(String(gymId)) || access.multiGymSub || null);
        })
        .catch(() => setActiveSub(null));
    }
  }, []);

  useEffect(() => {
    loadSlots(selectedDay);
  }, [selectedDay]);

  const handleBook = async (slotId: string) => {
    if (!UUID_RE.test(slotId)) {
      Alert.alert('No Slots Available', 'This gym has not added any slots for this date yet. Please check back later or contact the gym.');
      return;
    }
    if (!activeSub) {
      Alert.alert('No Active Pass', 'You need an active pass at this gym before booking a slot.', [
        { text: 'View Plans', onPress: () => router.push({ pathname: '/plans', params: { gymId: gymId || '' } } as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setBookingId(slotId);
    try {
      const res: any = await api.post('/sessions/book', { slotId, subscriptionId: activeSub?.id || activeSub?._id });
      if (res?.bookingQr) {
        router.replace({
          pathname: '/qr',
          params: {
            token: res.bookingQr.token,
            expiresAt: res.bookingQr.expiresAt,
            bookedAt: res.bookingQr.bookedAt,
            gymId: res.bookingQr.gymId,
            gymName: res.bookingQr.gymName,
          },
        });
      } else {
        Alert.alert('Booking Confirmed!', 'Your slot has been booked.');
        loadSlots(selectedDay);
        loadMyBookings();
      }
    } catch (e: any) {
      Alert.alert('Booking Failed', e?.message || 'Please try again.');
    } finally {
      setBookingId(null);
    }
  };

  const handleCancel = (slotId: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/sessions/cancel/${slotId}`, {});
            loadMyBookings();
            loadSlots(selectedDay);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not cancel.');
          }
        },
      },
    ]);
  };

  return (
    <AuroraBackground variant="gym">
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <IconArrowLeft size={18} color={colors.t} />
          </TouchableOpacity>
          <Text style={s.title}>Book a Slot</Text>
        </View>

        {/* Date picker */}
        <View style={s.sectionHeader}>
          <IconCalendar size={14} color={colors.accent} />
          <Text style={s.sectionTitle}>Select Date</Text>
        </View>
        <FlatList
          horizontal
          data={days}
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 20 }}
          renderItem={({ item: day, index }) => (
            <TouchableOpacity
              style={[s.dayChip, selectedDay === index && s.dayChipActive]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[s.dayChipLabel, selectedDay === index && s.dayChipLabelActive]}>
                {dayLabel(day, index)}
              </Text>
              <Text style={[s.dayChipDate, selectedDay === index && s.dayChipDateActive]}>
                {day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Workout type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8 }}>
          {sessionTypes.map((t) => {
            const isActive = activeType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.typeChip, isActive && { borderColor: t.color + 'AA', backgroundColor: t.color + '1A' }]}
                onPress={() => setActiveType(t.id)}
              >
                <Text style={[s.typeChipText, isActive && { color: t.color }]}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Slots */}
        <View style={s.sectionHeader}>
          <IconClock size={14} color={colors.accent} />
          <Text style={s.sectionTitle}>Available Slots</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (() => {
          const filtered = slots.filter((slot: any) => {
            if (activeType === 'all') return true;
            const st = slot.sessionType;
            const sid = st?.id ?? slot.sessionTypeId ?? '';
            const sname = (st?.name ?? '').toLowerCase();
            const f = activeType.toLowerCase();
            return sid === activeType || sid.toLowerCase() === f || sname.includes(f) || f.includes(sname);
          });
          if (filtered.length === 0) {
            return (
              <View style={s.emptyState}>
                {!!error && <Text style={[s.emptyText, { color: '#ff6b6b', marginBottom: 6 }]}>{error}</Text>}
                <Text style={s.emptyText}>
                  {slots.length === 0
                    ? 'No slots available for this date'
                    : `No ${activeType === 'all' ? '' : sessionTypes.find(t => t.id === activeType)?.name ?? activeType} slots on this date`}
                </Text>
              </View>
            );
          }
          return filtered.map((slot: any) => {            const isFull = slot.isFull || (slot.booked >= slot.capacity);
            const available = (slot.capacity || 0) - (slot.booked || 0);
            const isBooking = bookingId === (slot.id || slot._id);
            const stColor = slot.sessionType?.color || colors.accent;
            const stName = slot.sessionType?.name || '';
            return (
              <View key={slot.id || slot._id} style={[s.slotCard, isFull && s.slotCardFull]}>
                <View style={[s.slotAccentBar, { backgroundColor: stColor }]} />
                <View style={s.slotLeft}>
                  <View style={s.slotTimeRow}>
                    <IconClock size={13} color={isFull ? colors.t3 : stColor} />
                    <Text style={[s.slotTime, isFull && s.slotTimeFull]}>
                      {slot.startTime} – {slot.endTime}
                    </Text>
                  </View>
                  {stName ? (
                    <Text style={[s.slotTypePill, { color: stColor }]}>{stName}</Text>
                  ) : null}
                  <View style={s.slotCapRow}>
                    <IconUsers size={12} color={colors.t2} />
                    <Text style={s.slotCap}>
                      {isFull ? 'Full' : `${available} spots left`}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.bookBtn, isFull && s.bookBtnFull]}
                  disabled={isFull || isBooking}
                  onPress={() => handleBook(slot.id || slot._id)}
                >
                  {isBooking
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={[s.bookBtnText, isFull && s.bookBtnTextFull]}>
                        {isFull ? 'Full' : 'Book'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            );
          });
        })()}

        {/* My Bookings */}
        {myBookings.length > 0 && (
          <>
            <View style={[s.sectionHeader, { marginTop: 24 }]}>
              <IconCheck size={14} color={colors.accent} />
              <Text style={s.sectionTitle}>My Bookings</Text>
            </View>
            {myBookings.map((bk: any) => {
              const gymName = bk.gym?.name || bk.gymName || 'Gym';
              const date = bk.slot?.date || bk.date || '';
              const start = bk.slot?.startTime || bk.startTime || '';
              const end = bk.slot?.endTime || bk.endTime || '';
              const status = (bk.status || 'confirmed').toLowerCase();
              return (
                <View key={bk.id || bk._id} style={s.bookingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bookingGym}>{gymName}</Text>
                    <Text style={s.bookingTime}>{date} · {start} – {end}</Text>
                  </View>
                  <View style={[s.statusBadge, status === 'cancelled' && s.statusBadgeCancelled]}>
                    <Text style={[s.statusText, status === 'cancelled' && s.statusTextCancelled]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </View>
                  {status !== 'cancelled' && (
                    <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(bk.id || bk._id)}>
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}
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
  title: { fontFamily: fonts.serif, fontSize: 24, color: '#fff', letterSpacing: -0.5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 18, color: '#fff', letterSpacing: -0.3 },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', minWidth: 72,
  },
  dayChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  dayChipLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.t2, letterSpacing: 0.5, textTransform: 'uppercase' },
  dayChipLabelActive: { color: colors.accent },
  dayChipDate: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.t, marginTop: 3 },
  dayChipDateActive: { color: '#fff' },
  slotCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.lg, padding: 14, marginBottom: 10, overflow: 'hidden',
  },
  slotAccentBar: {
    width: 3, height: '100%', borderRadius: 2, marginRight: 12,
    position: 'absolute', left: 0, top: 0, bottom: 0,
  },
  slotCardFull: { opacity: 0.5 },
  slotLeft: { flex: 1, paddingLeft: 6 },
  slotTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  slotTime: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff' },
  slotTimeFull: { color: colors.t2 },
  slotCapRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  slotCap: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  slotTypePill: { fontFamily: fonts.sansMedium, fontSize: 10, marginBottom: 4 },
  bookBtn: {
    paddingHorizontal: 20, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', minWidth: 72,
  },
  bookBtnFull: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bookBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#000' },
  bookBtnTextFull: { color: colors.t3 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.t2 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
  },
  typeChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t2 },
  bookingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.lg, padding: 14, marginBottom: 10, gap: 10,
  },
  bookingGym: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', marginBottom: 3 },
  bookingTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
  },
  statusBadgeCancelled: { backgroundColor: 'rgba(255,60,60,0.1)', borderColor: 'rgba(255,60,60,0.2)' },
  statusText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent },
  statusTextCancelled: { color: 'rgba(255,100,100,0.9)' },
  cancelBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,60,60,0.1)', borderWidth: 1, borderColor: 'rgba(255,60,60,0.2)',
  },
  cancelBtnText: { fontFamily: fonts.sansBold, fontSize: 10, color: 'rgba(255,100,100,0.9)' },
});
