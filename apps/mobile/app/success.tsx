import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconCheck, IconCalendar, IconCreditCard } from '../components/Icons';
import { subscriptionsApi } from '../lib/api';

export default function Success() {
  const { planName, gymName, validUntil, amountPaid, subscriptionId, orderId, planId, gymId } =
    useLocalSearchParams<{
      planName: string; gymName?: string; validUntil: string;
      amountPaid: string; subscriptionId: string; orderId?: string; planId?: string; gymId?: string;
    }>();

  const isStoreOrder = planId === 'store_order';
  const isPtSession = planId === 'pt_session' || planId === 'pt_monthly';
  const hasSingleGymAccess = !!gymId && planId !== 'multi_gym';

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Verify + activate subscription (only for real subscription orders)
    if (!isStoreOrder && !isPtSession && subscriptionId && subscriptionId !== 'NEW' && subscriptionId !== 'BMF-NEW') {
      subscriptionsApi.verify(subscriptionId).catch(() => {});
    }
  }, []);

  const details = isStoreOrder
    ? [
        { label: 'Order', value: 'Store Purchase' },
        { label: 'Order ID', value: orderId || '—' },
        { label: 'Amount Paid', value: `₹${Number(amountPaid || 0).toLocaleString('en-IN')}` },
      ]
    : isPtSession
    ? [
        { label: 'Session Type', value: 'Personal Training' },
        { label: 'Booking ID', value: orderId || '—' },
        { label: 'Amount Paid', value: `₹${Number(amountPaid || 0).toLocaleString('en-IN')}` },
      ]
    : [
        { label: 'Gym Access', value: gymName || 'Multi-gym Access' },
        { label: 'Plan', value: planName || 'Standard Plan' },
        { label: 'Valid Until', value: validUntil || '—' },
        { label: 'Amount Paid', value: `₹${Number(amountPaid || 0).toLocaleString('en-IN')}` },
      ];

  const titleText = isStoreOrder ? 'Order Placed!' : isPtSession ? 'Session Booked!' : "You're In!";
  const subtitleText = isStoreOrder
    ? 'Your order has been placed successfully. We\'ll notify you when it ships.'
    : isPtSession
    ? 'Your PT session has been booked. Your trainer will contact you soon.'
    : `Your ${planName || 'Standard Plan'} membership is active.`;

  return (
    <AuroraBackground variant="premium">
    <SafeAreaView style={s.root}>
      {/* Radial glow bg */}
      <Animated.View style={[s.glowCircle, { opacity: glowAnim, transform: [{ scale: glowAnim }] }]} />
      <Animated.View style={[s.glowCircleInner, { opacity: glowAnim }]} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Check icon */}
        <Animated.View style={[s.checkWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.checkCircle}>
            <IconCheck size={44} color="#060606" />
          </View>
        </Animated.View>

        <Text style={s.kicker}>Payment Successful</Text>
        <Text style={s.title}>{titleText}</Text>
        <Text style={s.subtitle}>{subtitleText}</Text>

        {/* Details card */}
        <View style={s.card}>
          {details.map((d, i) => (
            <View key={d.label} style={[s.detailRow, i < details.length - 1 && s.detailRowBorder]}>
              <Text style={s.detailLabel}>{d.label}</Text>
              <Text style={[s.detailVal, d.label === 'Amount Paid' && { color: colors.accent }]}>
                {d.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Subscription / Order ID */}
        <Text style={s.subId}>
          {orderId ? `Order ID · ${orderId}` : `Subscription ID · ${subscriptionId || 'BMF-NEW'}`}
        </Text>

        {/* Buttons — context-aware */}
        {isStoreOrder ? (
          <TouchableOpacity style={s.btnPrimary} onPress={() => router.replace('/(tabs)/store' as any)}>
            <Text style={s.btnPrimaryText}>Continue Shopping</Text>
          </TouchableOpacity>
        ) : isPtSession ? (
          <TouchableOpacity style={s.btnPrimary} onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={s.btnPrimaryText}>Go to Home</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => {
              if (hasSingleGymAccess) router.replace({ pathname: '/slots', params: { gymId } } as any);
              else router.replace('/gyms' as any);
            }}
          >
            <Text style={s.btnPrimaryText}>{hasSingleGymAccess ? 'Book Your First Slot' : 'Browse Gyms'}</Text>
          </TouchableOpacity>
        )}

        {!isStoreOrder && (
          <TouchableOpacity
            style={s.btnGhost}
            onPress={() => router.replace('/(tabs)/subscriptions')}
          >
            <Text style={s.btnGhostText}>View My Subscriptions</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  glowCircle: {
    position: 'absolute', top: '10%', alignSelf: 'center',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(0,212,106,0.08)',
  },
  glowCircleInner: {
    position: 'absolute', top: '14%', alignSelf: 'center',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(0,212,106,0.06)',
  },
  scroll: {
    alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40,
  },
  checkWrap: { marginBottom: 24 },
  checkCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
    color: colors.accent, fontFamily: fonts.sansBold, marginBottom: 10,
  },
  title: {
    fontFamily: fonts.serif, fontSize: 38, color: '#fff',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontFamily: fonts.sans, fontSize: 15, color: colors.t,
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  card: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: radius.xl, marginBottom: 16, overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
  },
  detailRowBorder: { borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  detailLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
  detailVal: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff' },
  subId: {
    fontFamily: fonts.sans, fontSize: 11, color: colors.t3,
    letterSpacing: 0.5, marginBottom: 28,
  },
  btnPrimary: {
    width: '100%', height: 54, borderRadius: 30,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  btnPrimaryText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#060606' },
  btnGhost: {
    width: '100%', height: 54, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#fff' },
});
