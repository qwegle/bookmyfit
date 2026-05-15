import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, ImageBackground,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconCheck, IconLock, IconTag } from '../components/Icons';
import { subscriptionsApi, couponsApi } from '../lib/api';

function formatDateLabel(value: any) {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Order() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 34);
  const { planId, planName, gymId, gymName, durationMonths, totalAmount, ptAddon, ptDurationMonths, ptTrainerId, ptTrainerName, ptMonthlyPrice, ptTotal: ptTotalParam, maxGyms, isDayPass: isDayPassParam, gymPlanId } =
    useLocalSearchParams<{
      planId: string; planName: string; gymId?: string; gymName?: string;
      durationMonths: string; totalAmount: string; ptAddon?: string; ptDurationMonths?: string; ptTrainerId?: string; ptTrainerName?: string; ptMonthlyPrice?: string; ptTotal?: string; maxGyms?: string; isDayPass?: string; gymPlanId?: string;
    }>();

  const hasPt = ptAddon === 'true';
  const isDayPassRoute = isDayPassParam === 'true' || planId === 'day_pass';
  const months = Number(durationMonths) || 1;
  const ptMonths = Math.max(1, Number(ptDurationMonths) || 1);
  const ptTotal = hasPt ? (Number(ptTotalParam) || ((Number(ptMonthlyPrice) || 0) * ptMonths)) : 0;
  const total = Number(totalAmount) || 0;
  const planBase = Math.max(0, total - ptTotal);
  const isMultigym = planId === 'multi_gym';
  const selectedGymName = gymName || (isMultigym ? 'Any gym on BookMyFit' : 'Selected Gym');

  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedGyms, setSelectedGyms] = useState<string[]>([]);
  const gymLimit = isMultigym ? (Number(maxGyms) || 999) : 1;

  const toggleGym = (id: string) => {
    setSelectedGyms((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id);
      if (prev.length >= gymLimit) {
        Alert.alert('Limit Reached', `You can select up to ${gymLimit} gym${gymLimit > 1 ? 's' : ''} with this plan.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const result: any = await couponsApi.validate(coupon, total, planId || 'subscription');
      const d = Math.min(total, Math.round(Number(result?.discount || 0)));
      setDiscount(d);
      setCouponApplied(true);
      Alert.alert('Coupon Applied!', `Rs ${d.toLocaleString('en-IN')} discount added.`);
    } catch {
      Alert.alert('Invalid Coupon', 'This code is not valid or has expired.');
    }
  };

  const finalTotal = Math.max(1, total - discount);

  const handlePay = async () => {
    setLoading(true);
    try {
      const result: any = await subscriptionsApi.createOrder({
        planId: planId || '',
        gymId: isMultigym ? undefined : (gymId || undefined),
        gymPlanId: planId === 'same_gym' && gymPlanId ? String(gymPlanId) : undefined,
        durationMonths: months,
        ptAddon: hasPt,
        ptDurationMonths: hasPt ? ptMonths : 0,
        ptTrainerId: hasPt ? (ptTrainerId || undefined) : undefined,
        couponCode: couponApplied ? coupon : undefined,
        totalAmount: finalTotal,
        isDayPass: isDayPassRoute,
      });

      // New API returns { subscription, payment }
      const subRecord = result?.subscription || result;
      const paymentInfo = result?.payment || result;
      const subId = subRecord?.id || subRecord?._id;
      const orderId = paymentInfo?.orderId || result?.orderId;
      const sessionId = paymentInfo?.paymentSessionId || result?.paymentSessionId;
      const validUntil = formatDateLabel(subRecord?.endDate)
        || new Date(Date.now() + Math.max(months, 1) * 30 * 24 * 3600 * 1000)
          .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const paidAmount = String(subRecord?.amountPaid ?? finalTotal);

      if (sessionId && orderId && !paymentInfo?.mock) {
        router.push({
          pathname: '/payment-webview',
          params: {
            orderId,
            sessionId,
            planId: planId || '',
            planName: planName || 'Standard Plan',
            gymId: gymId || '',
            gymName: selectedGymName,
            subId: subId || '',
            amountPaid: paidAmount,
            validUntil,
          },
        });
      } else {
        // Dev mode or mock payment — subscription already activated by backend
        router.replace({
          pathname: '/success',
          params: {
            orderId: orderId || 'N/A',
            planName: planName || 'Standard Plan',
            gymName: selectedGymName,
            validUntil,
            amountPaid: paidAmount,
            subscriptionId: subId || 'NEW',
            planId: planId || '',
            gymId: gymId || '',
          },
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to create order. Please try again.';
      if (/active pass|already have/i.test(msg)) {
        Alert.alert('Already Subscribed', msg, [
          ...(gymId ? [{ text: 'Book Slot', onPress: () => router.replace({ pathname: '/slots', params: { gymId } } as any) }] : []),
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Payment Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Order Summary</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 24 }]}>
        {/* Plan card */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=70' }}
          style={s.planCard}
          imageStyle={{ borderRadius: radius.xl, opacity: 0.3 }}
        >
          <View style={s.planCardOverlay}>
            <View style={s.planBadge}>
              <Text style={s.planBadgeText}>
                {isDayPassRoute ? '🌶️ DAY PASS' : `${durationMonths} MONTH${Number(durationMonths) > 1 ? 'S' : ''}`}
              </Text>
            </View>
            <Text style={s.planName}>{planName || 'Standard Plan'}</Text>
            <Text style={s.planGym}>
              {isMultigym ? 'Any gym in our network - no restrictions' : (gymId ? selectedGymName : 'Gym Access')}
            </Text>
          </View>
        </ImageBackground>

        {/* Multi-gym access notice */}
        {isMultigym && (
          <View style={[s.card, { borderColor: colors.accentBorder }]}>
            <Text style={[s.sectionLabel, { marginBottom: 6 }]}>Multi-Gym Access Included</Text>
            <Text style={s.rowLabel}>
              With this plan you can check in at <Text style={{ color: colors.accent, fontFamily: fonts.sansMedium }}>any BookMyFit gym</Text>. No pre-selection needed — just browse gyms, generate your QR, and walk in.
            </Text>
          </View>
        )}

        {/* Breakdown */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Price Breakdown</Text>

          <View style={s.row}>
            <Text style={s.rowLabel}>Plan Price</Text>
            <Text style={s.rowVal}>₹{planBase.toLocaleString('en-IN')}</Text>
          </View>
          {hasPt && (
            <View style={s.row}>
              <Text style={s.rowLabel}>PT Add-on ({ptTrainerName || `${ptMonths} mo`})</Text>
              <Text style={s.rowVal}>Rs {ptTotal.toLocaleString('en-IN')}</Text>
            </View>
          )}
          <Text style={s.taxIncludedText}>All displayed prices are inclusive of GST.</Text>
          {couponApplied && (
            <View style={s.row}>
              <Text style={[s.rowLabel, { color: colors.accent }]}>Discount ({coupon.toUpperCase()})</Text>
              <Text style={[s.rowVal, { color: colors.accent }]}>-₹{discount.toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.totalLabel}>Total Payable</Text>
            <Text style={s.totalVal}>₹{finalTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Coupon */}
        <View style={s.couponRow}>
          <View style={s.couponInputWrap}>
            <IconTag size={14} color={colors.t2} />
            <TextInput
              style={s.couponInput}
              placeholder="Enter coupon code"
              placeholderTextColor={colors.t3}
              value={coupon}
              onChangeText={setCoupon}
              autoCapitalize="characters"
              editable={!couponApplied}
            />
          </View>
          <TouchableOpacity
            style={[s.applyBtn, couponApplied && s.applyBtnDone]}
            onPress={couponApplied ? undefined : applyCoupon}
          >
            {couponApplied
              ? <IconCheck size={16} color={colors.accent} />
              : <Text style={s.applyBtnText}>Apply</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Security badge */}
        <View style={s.securedRow}>
          <IconLock size={12} color={colors.t2} />
          <Text style={s.securedText}>Secured by Cashfree · 256-bit SSL encryption</Text>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: bottomInset + 14 }]}>
        <TouchableOpacity style={s.payBtn} onPress={handlePay} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#060606" />
            : <Text style={s.payBtnText}>Pay ₹{finalTotal.toLocaleString('en-IN')}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  back: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  planCard: {
    height: 140, borderRadius: radius.xl, marginBottom: 16, overflow: 'hidden',
  },
  planCardOverlay: {
    flex: 1, backgroundColor: 'rgba(6,6,6,0.55)', borderRadius: radius.xl,
    padding: 20, justifyContent: 'flex-end',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  planBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentBorder,
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  planBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent, letterSpacing: 2 },
  planName: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', marginBottom: 4 },
  planGym: { fontFamily: fonts.sans, fontSize: 13, color: colors.t },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)', borderRadius: radius.xl, padding: 18, marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
    color: colors.accent, fontFamily: fonts.sansBold, marginBottom: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.t2 },
  rowVal: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.t },
  taxIncludedText: { fontFamily: fonts.sans, fontSize: 11, color: colors.t3, marginBottom: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.09)', marginVertical: 10 },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff' },
  totalVal: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.accent },
  couponRow: {
    flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14,
  },
  couponInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)', borderRadius: radius.md, paddingHorizontal: 14,
    height: 48,
  },
  couponInput: {
    flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff',
  },
  applyBtn: {
    height: 48, paddingHorizontal: 20, borderRadius: radius.md,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDone: { backgroundColor: 'rgba(255,255,255,0.05)' },
  applyBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.accent },
  securedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginBottom: 16,
  },
  securedText: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  gymSelectRow: { flexDirection: 'row' }, // kept for TS but unused
  gymSelectRowActive: {},
  gymSelectLeft: { flexDirection: 'row' },
  gymSelectName: { fontFamily: fonts.sans, fontSize: 14, color: colors.t },
  gymSelectCity: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  checkBox: { width: 22, height: 22 },
  checkBoxActive: {},
  footer: {
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(6,6,6,0.95)',
  },
  payBtn: {
    height: 54, borderRadius: 30, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  payBtnText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#060606' },
});
