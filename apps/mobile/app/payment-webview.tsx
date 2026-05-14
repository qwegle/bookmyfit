import { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { colors, fonts, radius, spacing } from '../theme/brand';
import { IconArrowLeft, IconCheck } from '../components/Icons';
import { subscriptionsApi, api, API_BASE } from '../lib/api';
import { clearCart } from './cart';

const CASHFREE_BASE_URL: string =
  (Constants.expoConfig?.extra as any)?.cashfreeBaseUrl ?? 'https://sandbox.cashfree.com';

export default function PaymentWebview() {
  const {
    orderId, sessionId, paymentSessionId,
    planId, planName, gymId, gymName, subId, amountPaid, validUntil,
    bookingId, returnRoute, serviceName, amount,
  } = useLocalSearchParams<{
    orderId: string; sessionId?: string; paymentSessionId?: string;
    planId?: string; planName?: string; gymId?: string; gymName?: string; subId?: string; amountPaid?: string; validUntil?: string;
    bookingId?: string; returnRoute?: string; serviceName?: string; amount?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [mockConfirming, setMockConfirming] = useState(false);
  const webviewRef = useRef<any>(null);

  // Support both old 'sessionId' param and new 'paymentSessionId' param
  const effectiveSessionId = paymentSessionId || sessionId || '';
  const isMock = effectiveSessionId.startsWith('mock_session_');
  const allowMockPayment = __DEV__ || API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1');

  // Build Cashfree checkout URL; use session-based URL when session ID available
  const checkoutUrl = effectiveSessionId && !isMock
    ? `${CASHFREE_BASE_URL}/pg/view/order?session_id=${effectiveSessionId}&order_id=${orderId}`
    : `${CASHFREE_BASE_URL}/pg/orders/pay?order_id=${orderId}`;

  const handleSuccess = async () => {
    // Confirm wellness booking if bookingId present
    if (bookingId) {
      try { await api.post(`/wellness/bookings/${bookingId}/confirm`, {}); } catch {}
    }
    // Verify + activate subscription if subId available
    let verifiedSub: any = null;
    if (subId) {
      try {
        const verifyRes: any = await subscriptionsApi.verify(subId);
        verifiedSub = verifyRes?.subscription || null;
        if (verifyRes?.success === false) {
          Alert.alert('Payment is being confirmed', 'Your payment was received but the subscription is still pending confirmation. Please check My Subscriptions shortly.');
          router.replace('/(tabs)/subscriptions' as any);
          return;
        }
      } catch {}
    }
    // Route to correct success screen
    if (returnRoute === 'wellness') {
      router.replace({
        pathname: '/booking-success',
        params: { bookingId: bookingId || '', orderId, serviceName: serviceName || '', amount: amount || '' },
      } as any);
    } else if (returnRoute === 'store') {
      clearCart();
      router.replace({
        pathname: '/success',
        params: {
          orderId,
          planId: 'store_order',
          planName: 'Store Purchase',
          amountPaid: amountPaid || amount || String(verifiedSub?.amountPaid || 0),
          subscriptionId: '',
        },
      } as any);
    } else {
      router.replace({
        pathname: '/success',
        params: {
          orderId,
          planId: planId || '',
          planName: planName || verifiedSub?.planLabel || 'Standard Plan',
          gymId: gymId || '',
          gymName: gymName || verifiedSub?.gymName || '',
          subscriptionId: subId || '',
          validUntil: validUntil || verifiedSub?.endDate || '',
          amountPaid: amountPaid || String(verifiedSub?.amountPaid || 0),
        },
      });
    }
  };

  // Mock payment flow — show a simulated payment page in-app
  const handleMockPay = async () => {
    setMockConfirming(true);
    await new Promise(r => setTimeout(r, 1500)); // simulate API delay
    setMockConfirming(false);
    await handleSuccess();
  };

  const handleNavigationChange = (navState: any) => {
    const url = navState.url || '';
    if (
      url.includes('bookmyfit://payment-success') ||
      url.includes('payment_status=SUCCESS') ||
      url.includes('payment-return') ||
      (url.includes('success') && !url.includes('cashfree'))
    ) {
      handleSuccess();
    } else if (url.includes('payment_status=FAILED') || url.includes('payment_status=USER_DROPPED')) {
      Alert.alert('Payment Failed', 'Your payment was not completed. Please try again.', [
        { text: 'Try Again', onPress: () => webviewRef.current?.reload() },
        { text: 'Cancel', onPress: () => router.back() },
      ]);
    }
  };

  const injectedJs = `
    window.cashfreePaymentSuccess = function(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS', data}));
    };
    window.cashfreePaymentFailure = function(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'FAILURE', data}));
    };
    true;
  `;

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SUCCESS') handleSuccess();
      else if (msg.type === 'FAILURE') {
        Alert.alert('Payment Failed', 'Please try again.', [
          { text: 'Try Again', onPress: () => webviewRef.current?.reload() },
          { text: 'Cancel', onPress: () => router.back() },
        ]);
      }
    } catch {}
  };

  // ── Mock Payment Screen (dev / sandbox without Cashfree keys) ────────────
  if (isMock && !allowMockPayment) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Payment unavailable</Text>
        </View>
        <View style={s.loadingOverlay}>
          <Text style={s.loadingText}>This payment session is not valid for production checkout.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isMock) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => {
            Alert.alert('Cancel Payment?', 'Are you sure you want to cancel?', [
              { text: 'Continue', style: 'cancel' },
              { text: 'Cancel', style: 'destructive', onPress: () => router.back() },
            ]);
          }}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Secure Payment</Text>
          <View style={s.devBadge}><Text style={s.devBadgeText}>DEV MODE</Text></View>
        </View>

        <ScrollView contentContainerStyle={s.mockContent}>
          <View style={s.mockCard}>
            <View style={s.mockLogo}><Text style={s.mockLogoText}>cf</Text></View>
            <Text style={s.mockTitle}>Cashfree Checkout</Text>
            <Text style={s.mockSubtitle}>Sandbox / Development Mode</Text>

            <View style={s.mockDivider} />

            <View style={s.mockRow}>
              <Text style={s.mockLabel}>Order ID</Text>
              <Text style={s.mockValue}>{orderId}</Text>
            </View>
            {serviceName ? (
              <View style={s.mockRow}>
                <Text style={s.mockLabel}>Service</Text>
                <Text style={s.mockValue}>{serviceName}</Text>
              </View>
            ) : null}
            {amount ? (
              <View style={s.mockRow}>
                <Text style={s.mockLabel}>Amount</Text>
                <Text style={s.mockAmtValue}>₹{Number(amount).toLocaleString()}</Text>
              </View>
            ) : null}

            <View style={s.mockDivider} />

            <Text style={s.mockNote}>
              ⚠️ This is a simulated payment. Configure Cashfree credentials in .env to process real payments.
            </Text>

            <TouchableOpacity
              style={[s.mockPayBtn, mockConfirming && { opacity: 0.7 }]}
              onPress={handleMockPay}
              disabled={mockConfirming}
            >
              {mockConfirming
                ? <><ActivityIndicator color="#060606" size="small" /><Text style={s.mockPayBtnText}>  Processing…</Text></>
                : <><IconCheck size={16} color="#060606" /><Text style={s.mockPayBtnText}>  Simulate Successful Payment</Text></>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.mockCancelBtn} onPress={() => router.back()}>
              <Text style={s.mockCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Real Cashfree WebView ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => {
          Alert.alert('Cancel Payment?', 'Are you sure you want to cancel?', [
            { text: 'Continue', style: 'cancel' },
            { text: 'Cancel', style: 'destructive', onPress: () => router.back() },
          ]);
        }}>
          <IconArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Secure Payment</Text>
        <View style={s.securityBadge}>
          <Text style={s.securityText}>SSL Secured</Text>
        </View>
      </View>

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Loading secure payment…</Text>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: checkoutUrl }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigationChange}
        onMessage={handleMessage}
        injectedJavaScript={injectedJs}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="compatibility"
        style={{ flex: 1, backgroundColor: colors.bg }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 15, color: '#fff', marginLeft: 12 },
  securityBadge: {
    backgroundColor: 'rgba(0,212,106,0.12)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: colors.accentBorder,
  },
  securityText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },
  devBadge: {
    backgroundColor: 'rgba(255,180,0,0.15)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,180,0,0.4)',
  },
  devBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#ffb400', letterSpacing: 0.5 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, zIndex: 10,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  loadingText: { fontFamily: fonts.sans, fontSize: 14, color: colors.t2 },

  // Mock styles
  mockContent: { padding: spacing.lg, paddingTop: 32 },
  mockCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center',
  },
  mockLogo: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a1a2e',
    borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  mockLogoText: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.accent },
  mockTitle: { fontFamily: fonts.sansBold, fontSize: 20, color: '#fff', marginBottom: 4 },
  mockSubtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, marginBottom: 16 },
  mockDivider: { height: 1, backgroundColor: colors.border, width: '100%', marginVertical: 14 },
  mockRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  mockLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
  mockValue: { fontFamily: fonts.sansMedium ?? fonts.sans, fontSize: 13, color: '#fff', maxWidth: '60%', textAlign: 'right' },
  mockAmtValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  mockNote: { fontFamily: fonts.sans, fontSize: 12, color: '#ffb400', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  mockPayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: radius.xl, paddingVertical: 14, paddingHorizontal: 28,
    width: '100%', marginBottom: 12,
  },
  mockPayBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#060606' },
  mockCancelBtn: { paddingVertical: 10 },
  mockCancelText: { fontFamily: fonts.sans, fontSize: 14, color: colors.t2 },
});

