import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconUser, IconStar, IconClock, IconCheck } from '../components/Icons';
import { trainersApi, usersApi } from '../lib/api';

interface Trainer {
  id: string;
  name: string;
  specialization: string;
  monthlyPriceInr?: number;
  monthlyPrice?: number;
  pricePerSession?: number;
  totalSessions?: number;
  rating?: number;
  gymId?: string;
  bio?: string;
  status?: string;
}

export default function TrainersScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Trainer | null>(null);
  const [durationMonths, setDurationMonths] = useState('1');
  const [date, setDate] = useState('');
  const [booking, setBooking] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    usersApi.me().then((d: any) => setUser(d?.user || d)).catch(() => {});
    if (!gymId) { setLoading(false); return; }
    trainersApi.listByGym(gymId as string)
      .then((d: any) => {
        const rows = Array.isArray(d) ? d : d?.data ?? [];
        setTrainers(rows.filter((t: any) => t.status !== 'inactive' && t.isActive !== false));
      })
      .catch(() => setTrainers([]))
      .finally(() => setLoading(false));
  }, [gymId]);

  const handleBook = async () => {
    if (!selected || !user) return;
    const months = Math.max(1, parseInt(durationMonths) || 1);
    const startDate = date.trim() || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const monthlyPrice = Number(selected.monthlyPriceInr || selected.monthlyPrice || selected.pricePerSession || 0);
    const totalPrice = Math.max(0, monthlyPrice * months);
    setBooking(true);
    try {
      // trainersApi.book creates booking + Cashfree order in one call
      const res: any = await trainersApi.book(selected.id, {
        userId: user.id,
        durationMonths: months,
        startDate,
        phone: user.phone || user.phoneNumber || '',
      });
      const orderId: string = res?.payment?.orderId || res?.payment?.cfOrderId || res?.booking?.cashfreeOrderId || '';
      const sessionId: string = res?.payment?.cfSessionId || res?.payment?.paymentSessionId || '';
      setSelected(null);
      if (orderId) {
        router.push({
          pathname: '/payment-webview',
          params: {
            orderId,
            sessionId,
            planId: 'pt_monthly',
            planName: `${months} month trainer plan`,
            gymId: selected.gymId || (gymId as string) || '',
            amountPaid: String(totalPrice),
          },
        } as any);
      } else {
        // No payment gateway configured — booking created directly
        Alert.alert('Trainer Added', `Your monthly trainer plan with ${selected.name} has been requested. They will contact you shortly.`);
      }
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.message || 'Please try again');
    } finally {
      setBooking(false);
    }
  };

  return (
    <AuroraBackground variant="gym">
    <SafeAreaView style={s.container}>
      <View style={s.aurora} />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Personal Trainers</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : trainers.length === 0 ? (
        <View style={s.center}>
          <IconUser size={40} color={colors.t3} />
          <Text style={s.emptyTitle}>No Trainers Available</Text>
          <Text style={s.emptyText}>This gym hasn't listed personal trainers yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={s.sectionTitle}>Available at this Gym</Text>
          {trainers.map((t) => (
            <View key={t.id} style={s.card}>
              <View style={s.cardRow}>
                <View style={s.avatar}>
                  <IconUser size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.trainerName}>{t.name}</Text>
                  <Text style={s.spec}>{t.specialization || 'General Fitness'}</Text>
                  {t.bio ? <Text style={s.bio} numberOfLines={2}>{t.bio}</Text> : null}
                </View>
              </View>
              <View style={s.cardMeta}>
                <View style={s.metaItem}>
                  <IconStar size={12} color={colors.accent} />
                  <Text style={s.metaText}>{t.rating ? t.rating.toFixed(1) : 'New'}</Text>
                </View>
                {t.totalSessions ? (
                  <View style={s.metaItem}>
                    <IconClock size={12} color={colors.t2} />
                    <Text style={s.metaText}>{t.totalSessions}+ members</Text>
                  </View>
                ) : null}
                <Text style={s.price}>Rs {Number(t.monthlyPriceInr || t.monthlyPrice || t.pricePerSession || 0).toLocaleString()}/month</Text>
              </View>
              <TouchableOpacity
                style={s.bookBtn}
                onPress={() => { setSelected(t); setDurationMonths('1'); setDate(''); }}
                activeOpacity={0.8}
              >
                <Text style={s.bookBtnText}>Choose Monthly Plan</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Booking Modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Start Monthly Training</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={{ color: colors.t3, fontSize: 20 }}>×</Text>
              </TouchableOpacity>
            </View>
            {selected && (
              <>
                <Text style={s.modalTrainer}>{selected.name}</Text>
                <Text style={s.modalSpec}>{selected.specialization || 'General Fitness'}</Text>

                <Text style={s.label}>Duration in Months</Text>
                <TextInput
                  style={s.input}
                  value={durationMonths}
                  onChangeText={setDurationMonths}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={colors.t3}
                />

                <Text style={s.label}>Preferred Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={s.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  placeholderTextColor={colors.t3}
                />

                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Total Cost</Text>
                  <Text style={s.totalValue}>
                    Rs {((parseInt(durationMonths) || 1) * Number(selected.monthlyPriceInr || selected.monthlyPrice || selected.pricePerSession || 0)).toLocaleString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.confirmBtn, booking && { opacity: 0.6 }]}
                  onPress={handleBook}
                  disabled={booking}
                  activeOpacity={0.85}
                >
                  {booking ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <IconCheck size={14} color="#000" />
                      <Text style={s.confirmText}>Confirm Booking</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  aurora: {
    position: 'absolute', top: 0, left: '10%', width: 300, height: 300,
    borderRadius: 150, backgroundColor: 'rgba(0,212,106,0.08)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.t },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.t, marginTop: 16, marginBottom: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  card: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.lg, padding: 16, marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,212,106,0.1)', borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  trainerName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.t, marginBottom: 2 },
  spec: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent, marginBottom: 4 },
  bio: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, lineHeight: 17 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  price: { marginLeft: 'auto', fontFamily: fonts.sansBold, fontSize: 13, color: colors.t },
  bookBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center',
  },
  bookBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#000' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.glass, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: colors.borderGlass, padding: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.t },
  modalTrainer: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.t, marginBottom: 2 },
  modalSpec: { fontFamily: fonts.sans, fontSize: 12, color: colors.accent, marginBottom: 20 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.sans, fontSize: 14, color: colors.t, marginBottom: 16,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
  totalValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  confirmBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  confirmText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#000' },
});
