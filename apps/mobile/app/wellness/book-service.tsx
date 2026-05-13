import { useState, useMemo } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme/brand';
import { IconArrowLeft, IconClock, IconCalendar } from '../../components/Icons';
import { api, getUser } from '../../lib/api';

// ─── Time slot groups ─────────────────────────────────────────────────────────
const TIME_GROUPS = [
  { label: 'Morning', slots: ['9:00', '10:00', '11:00'] },
  { label: 'Afternoon', slots: ['12:00', '13:00', '14:00', '15:00'] },
  { label: 'Evening', slots: ['16:00', '17:00', '18:00', '19:00'] },
];

// Generate next 14 days
function getNext14Days() {
  const days: { date: Date; label: string; dayNum: string; dayName: string }[] = [];
  const now = new Date();
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      date: d,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
      dayNum: String(d.getDate()),
      dayName: i === 0 ? 'Today' : DAY_NAMES[d.getDay()],
    });
  }
  return days;
}

export default function BookServiceScreen() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 34);
  const { serviceId, partnerId, serviceName, price, originalPrice, duration } =
    useLocalSearchParams<{
      serviceId: string; partnerId: string; serviceName: string;
      price: string; originalPrice: string; duration: string;
    }>();

  const days = useMemo(() => getNext14Days(), []);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const priceNum = Number(price) || 0;
  const origPriceNum = originalPrice ? Number(originalPrice) : null;
  const hasDiscount = origPriceNum != null && origPriceNum > priceNum;
  const discPct = hasDiscount ? Math.round(100 - (priceNum / origPriceNum!) * 100) : 0;

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Select Time', 'Please select a time slot to continue.');
      return;
    }
    setLoading(true);
    try {
      const user = await getUser();
      if (!user) {
        Alert.alert('Login Required', 'Please log in to book a service.');
        setLoading(false);
        return;
      }
      const selectedDate = days[selectedDayIdx].date;
      const [hour, minute] = selectedSlot.split(':').map(Number);
      selectedDate.setHours(hour, minute, 0, 0);
      const bookingDate = selectedDate.toISOString();

      const result = await api.post(`/wellness/services/${serviceId}/book`, {
        bookingDate,
        phone: user.phone || '',
      });

      const { payment, booking } = result as any;
      router.push({
        pathname: '/payment-webview',
        params: {
          paymentSessionId: payment?.paymentSessionId || payment?.payment_session_id || '',
          orderId: payment?.orderId || payment?.order_id || booking?.cashfreeOrderId || booking?.id,
          bookingId: booking?.id || '',
          returnRoute: 'wellness',
          serviceName: serviceName || '',
          amount: String(priceNum),
        },
      } as any);
    } catch (e: any) {
      Alert.alert('Booking Failed', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Book Service</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 96 + bottomInset }}
        >
          {/* Service Summary Card */}
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <Text style={s.summaryName}>{serviceName}</Text>
              <View style={s.durBadge}>
                <IconClock size={12} color={colors.t2} />
                <Text style={s.durText}>{duration} min</Text>
              </View>
            </View>
            <View style={s.priceRow}>
              {hasDiscount && (
                <Text style={s.origPrice}>₹{origPriceNum!.toLocaleString()}</Text>
              )}
              <Text style={s.price}>₹{priceNum.toLocaleString()}</Text>
              {hasDiscount && (
                <View style={s.discBadge}>
                  <Text style={s.discText}>{discPct}% OFF</Text>
                </View>
              )}
            </View>
          </View>

          {/* Date Selector */}
          <View style={s.sectionContainer}>
            <View style={s.sectionHeader}>
              <IconCalendar size={16} color={colors.accent} />
              <Text style={s.sectionTitle}>Select Date</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateScroll}>
              {days.map((d, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[s.datePill, selectedDayIdx === idx && s.datePillActive]}
                  onPress={() => setSelectedDayIdx(idx)}
                >
                  <Text style={[s.dateDayName, selectedDayIdx === idx && s.dateDayNameActive]}>
                    {d.dayName}
                  </Text>
                  <Text style={[s.dateDayNum, selectedDayIdx === idx && s.dateDayNumActive]}>
                    {d.dayNum}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Time Slot Selector */}
          <View style={s.sectionContainer}>
            <View style={s.sectionHeader}>
              <IconClock size={16} color={colors.accent} />
              <Text style={s.sectionTitle}>Select Time</Text>
            </View>
            {TIME_GROUPS.map(group => (
              <View key={group.label}>
                <Text style={s.slotGroupLabel}>{group.label}</Text>
                <View style={s.slotGrid}>
                  {group.slots.map(slot => (
                    <TouchableOpacity
                      key={slot}
                      style={[s.slotChip, selectedSlot === slot && s.slotChipActive]}
                      onPress={() => setSelectedSlot(slot)}
                    >
                      <Text style={[s.slotText, selectedSlot === slot && s.slotTextActive]}>
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Note */}
          <View style={s.sectionContainer}>
            <Text style={s.sectionTitle}>Special Requests</Text>
            <TextInput
              style={s.noteInput}
              placeholder="Any special requests or notes?"
              placeholderTextColor={colors.t3}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View style={[s.bottomBar, { paddingBottom: bottomInset + 14 }]}>
          <View>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalPrice}>₹{priceNum.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[s.payBtn, (!selectedSlot || loading) && { opacity: 0.6 }]}
            onPress={handleBook}
            disabled={!selectedSlot || loading}
          >
            {loading
              ? <ActivityIndicator color="#060606" />
              : <Text style={s.payBtnText}>Proceed to Pay ₹{priceNum.toLocaleString()}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff' },

  summaryCard: {
    margin: spacing.lg,
    backgroundColor: colors.glass, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderGlass, padding: spacing.xl,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  summaryName: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff', flex: 1, marginRight: 8 },
  durBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  durText: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  origPrice: { fontFamily: fonts.sans, fontSize: 14, color: colors.t3, textDecorationLine: 'line-through' },
  price: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.accent },
  discBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  discText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent },

  sectionContainer: { marginHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff', marginBottom: 12 },

  dateScroll: { paddingRight: spacing.lg, gap: 8 },
  datePill: {
    width: 56, paddingVertical: 10, borderRadius: radius.xl,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center',
  },
  datePillActive: {
    backgroundColor: colors.accentSoft, borderColor: colors.accent,
  },
  dateDayName: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginBottom: 4 },
  dateDayNameActive: { color: colors.accent },
  dateDayNum: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.t },
  dateDayNumActive: { color: colors.accent },

  slotGroupLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.t2, marginBottom: 8, letterSpacing: 0.5 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  slotChip: {
    width: '30%', paddingVertical: 10, borderRadius: radius.lg,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center',
  },
  slotChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  slotText: { fontFamily: fonts.sansMedium ?? fonts.sans, fontSize: 14, color: colors.t },
  slotTextActive: { color: colors.accent, fontFamily: fonts.sansBold },

  noteInput: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    borderRadius: radius.xl, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontFamily: fonts.sans, fontSize: 14, textAlignVertical: 'top',
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 16,
  },
  totalLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, marginBottom: 2 },
  totalPrice: { fontFamily: fonts.sansBold, fontSize: 20, color: '#fff' },
  payBtn: {
    flex: 1, marginLeft: spacing.lg,
    backgroundColor: colors.accent, borderRadius: radius.xl,
    paddingVertical: 14, alignItems: 'center',
  },
  payBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#060606' },
});
