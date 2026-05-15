import { useEffect } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { api } from '../lib/api';

const VERIFY_DELAYS_MS = [0, 1000, 2000, 3000, 5000, 8000, 12000];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentReturnScreen() {
  const params = useLocalSearchParams<{
    order_id?: string;
    orderId?: string;
    order_status?: string;
  }>();

  useEffect(() => {
    let active = true;
    const orderId = String(params.order_id || params.orderId || '');

    async function confirmPayment() {
      if (!orderId) {
        router.replace('/(tabs)/subscriptions' as any);
        return;
      }

      try {
        let paid = false;
        for (const delayMs of VERIFY_DELAYS_MS) {
          if (delayMs > 0) await wait(delayMs);
          const result: any = await api.post(`/payments/verify/${orderId}`, {});
          const status = String(result?.paymentStatus || result?.status || result?.orderStatus || '').toUpperCase();
          paid = result?.paid === true || status === 'PAID' || status === 'SUCCESS';
          if (paid || /(FAILED|DROPPED|CANCELLED|CANCELED|EXPIRED)/.test(status)) break;
        }
        if (!active) return;

        if (paid) {
          Alert.alert('Payment successful', 'Your payment has been confirmed.', [
            { text: 'OK', onPress: () => router.replace('/(tabs)/subscriptions' as any) },
          ]);
        } else {
          Alert.alert('Payment is being confirmed', 'Please check My Memberships shortly.', [
            { text: 'OK', onPress: () => router.replace('/(tabs)/subscriptions' as any) },
          ]);
        }
      } catch {
        if (!active) return;
        Alert.alert('Payment is being confirmed', 'Please check My Memberships shortly.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/subscriptions' as any) },
        ]);
      }
    }

    confirmPayment();
    return () => {
      active = false;
    };
  }, [params.orderId, params.order_id]);

  return <AppLoadingScreen />;
}
