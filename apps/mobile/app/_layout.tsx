import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { colors } from '../theme/brand';
import { appStorage, getToken, getUser } from '../lib/api';
import AppLoadingScreen from '../components/AppLoadingScreen';

const ONBOARDED_KEY = 'bmf_onboarded';

async function resolveInitialRoute() {
  try {
    const initialUrl = await Linking.getInitialURL();
    if (String(initialUrl || '').toLowerCase().includes('payment-return')) {
      return;
    }

    // First-launch onboarding check
    const onboarded = await appStorage.getItem(ONBOARDED_KEY);
    if (!onboarded) {
      router.replace('/onboarding');
      return;
    }
    const token = await getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    const user = await getUser();
    if (user?.role === 'gym_owner' || user?.role === 'gym_staff') {
      router.replace('/(gym-portal)');
    } else {
      router.replace('/(tabs)');
    }
  } catch {
    router.replace('/login');
  }
}

export default function RootLayout() {
  const [booting, setBooting] = useState(true);
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as any).document;
    if (!doc || doc.getElementById('bmf-mobile-web-root-fix')) return;

    const style = doc.createElement('style');
    style.id = 'bmf-mobile-web-root-fix';
    style.textContent = `
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #060606;
      }
      body {
        overscroll-behavior: none;
      }
      #root {
        display: flex;
        min-height: 0;
      }
      #root > div {
        flex: 1;
        min-height: 0;
      }
    `;
    doc.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    resolveInitialRoute().finally(() => {
      if (active) setBooting(false);
    });
    return () => { active = false; };
  }, [loaded]);

  if (!loaded) {
    return <AppLoadingScreen />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: 'Poppins_700Bold', fontSize: 18 },
        contentStyle: { backgroundColor: colors.bg },
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="otp" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(gym-portal)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="gym/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="qr" options={{ headerShown: false }} />
        <Stack.Screen name="plans" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="duration" options={{ headerShown: false }} />
        <Stack.Screen name="order" options={{ headerShown: false }} />
        <Stack.Screen name="success" options={{ headerShown: false }} />
        <Stack.Screen name="checkin-result" options={{ headerShown: false }} />
        <Stack.Screen name="videos" options={{ headerShown: false }} />
        <Stack.Screen name="review" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="invoice" options={{ headerShown: false }} />
        <Stack.Screen name="trainers" options={{ headerShown: false }} />
        <Stack.Screen name="slots" options={{ headerShown: false }} />
        <Stack.Screen name="wellness" options={{ headerShown: false }} />
        <Stack.Screen name="subscription-detail" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="payment-webview" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="payment-return" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="nearby" options={{ headerShown: false }} />
        <Stack.Screen name="gyms" options={{ headerShown: false }} />
        <Stack.Screen name="wellness/book-service" options={{ headerShown: false }} />
        <Stack.Screen name="home-services" options={{ headerShown: false }} />
        <Stack.Screen name="spa-centres" options={{ headerShown: false }} />
        <Stack.Screen name="multi-gym-network" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ headerShown: false }} />
        <Stack.Screen name="booking-success" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      {booting && (
        <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 999 }}>
          <AppLoadingScreen />
        </View>
      )}
    </>
  );
}
