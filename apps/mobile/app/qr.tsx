import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import AuroraBackground from '../components/AuroraBackground';
import { IconArrowLeft, IconClock } from '../components/Icons';
import { colors, fonts, radius } from '../theme/brand';
import { qrApi } from '../lib/api';

// HH:MM:SS reverse countdown
function formatLong(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

type QrMode = 'loading' | 'slot' | 'empty';

export default function QrScreen() {
  const params = useLocalSearchParams<{
    token?: string; expiresAt?: string; gymId?: string; gymName?: string; bookedAt?: string;
    bookingId?: string; bookingRef?: string; manualCode?: string;
  }>();

  const [mode, setMode] = useState<QrMode>('loading');
  const [token, setToken] = useState<string | null>(params.token || null);
  const [expiresAt, setExpiresAt] = useState<string | null>(params.expiresAt || null);
  const [bookedAt, setBookedAt] = useState<string | null>(params.bookedAt || null);
  const [gymName, setGymName] = useState<string>(params.gymName || '');
  const [manualCode, setManualCode] = useState<string>(params.manualCode || params.bookingRef || params.bookingId || '');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Bootstrap: QR is ONLY shown when a slot/session is actively booked ─────────
  useEffect(() => {
    if (params.token && params.expiresAt) {
      // QR passed via navigation params (e.g. right after booking a slot)
      setMode('slot');
      return;
    }
    (async () => {
      try {
        const booking: any = await qrApi.getActiveBooking();
        if (booking?.active && booking.bookingQr) {
          setToken(booking.bookingQr.token);
          setExpiresAt(booking.bookingQr.expiresAt);
          setBookedAt(booking.bookingQr.bookedAt);
          setGymName(booking.bookingQr.gymName || '');
          setManualCode(booking.bookingQr.manualCode || booking.bookingQr.bookingRef || booking.bookingQr.bookingId || '');
          setMode('slot');
          return;
        }
      } catch { /* network/auth error — show empty */ }

      // No active slot booking → show empty state.
      // Subscriptions alone do NOT generate a QR — user must book a slot first.
      setMode('empty');
    })();
  }, []);

  // ── Reverse timer: counts from now down to expiresAt (= bookedAt + 2 hours) ───
  useEffect(() => {
    if (mode !== 'slot' || !expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [mode, expiresAt]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const isExpired = mode === 'slot' && secondsLeft <= 0 && expiresAt !== null;
  const isLowTime = secondsLeft > 0 && secondsLeft < 600; // < 10 min → red

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <AuroraBackground>
        <SafeAreaView style={s.root}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={[s.sub, { marginTop: 16 }]}>Checking your bookings…</Text>
          </View>
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  // ── No booked slot ────────────────────────────────────────────────────────────
  if (mode === 'empty') {
    return (
      <AuroraBackground>
        <SafeAreaView style={s.root}>
          <View style={s.header}>
            <TouchableOpacity style={s.back} onPress={() => router.back()}>
              <IconArrowLeft size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={s.title}>Check-In QR</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <IconClock size={32} color={colors.t2} />
            </View>
            <Text style={s.emptyTitle}>No Booked Session</Text>
            <Text style={s.emptySub}>
              Book a slot at a gym first. Your check-in QR will appear here once you have an active booking.
            </Text>
            <TouchableOpacity style={s.bookBtn} onPress={() => router.push('/gyms' as any)}>
              <Text style={s.bookBtnText}>Browse Gyms & Book Slot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bookBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderGlass, marginTop: 8 }]}
              onPress={() => router.push('/plans' as any)}
            >
              <Text style={[s.bookBtnText, { color: colors.t }]}>View Plans</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  // ── Active slot booking → show QR ────────────────────────────────────────────
  return (
    <AuroraBackground>
      <SafeAreaView style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.title}>Session QR</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={s.content}>
          {/* Gym name badge */}
          {gymName ? (
            <View style={s.gymBadge}>
              <Text style={s.gymBadgeText}>{gymName}</Text>
            </View>
          ) : null}

          {/* Booking timestamps */}
          {bookedAt && expiresAt && (
            <Text style={s.bookingInfo}>
              Booked {formatDateTime(bookedAt)} · Valid till {formatDateTime(expiresAt)}
            </Text>
          )}

          {manualCode ? (
            <View style={s.manualBox}>
              <Text style={s.manualLabel}>Manual Check-in ID</Text>
              <Text selectable style={s.manualCode}>#{manualCode}</Text>
              <Text style={s.manualHint}>Use this if the QR scan fails.</Text>
            </View>
          ) : null}

          {/* QR code */}
          <View style={[s.qrBox, isExpired && { opacity: 0.5 }]}>
            {isExpired && (
              <View style={s.expiredOverlay}>
                <Text style={s.expiredText}>Session Expired</Text>
              </View>
            )}
            {token ? (
              <QRCode
                value={token}
                size={220}
                color={isExpired ? '#444' : '#fff'}
                backgroundColor="transparent"
              />
            ) : (
              <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            )}
          </View>

          {/* Reverse countdown timer */}
          {!isExpired ? (
            <View style={s.timerBox}>
              <IconClock size={16} color={isLowTime ? '#FF4444' : colors.accent} />
              <Text style={[s.timerText, isLowTime && { color: '#FF4444' }]}>
                {formatLong(secondsLeft)}
              </Text>
              <Text style={s.timerLabel}>remaining</Text>
            </View>
          ) : (
            <View style={[s.timerBox, { borderColor: 'rgba(255,68,68,0.3)' }]}>
              <Text style={[s.timerText, { color: '#FF4444' }]}>00:00:00</Text>
              <Text style={[s.timerLabel, { color: '#FF4444' }]}>expired</Text>
            </View>
          )}

          <Text style={s.notice}>
            Show this QR to the gym staff. Valid for 2 hours from booking time.
          </Text>

          {/* Steps */}
          <View style={s.steps}>
            {[
              'Walk into your booked gym',
              'Show this QR to the gym staff',
              'Staff scans to mark your check-in',
            ].map((step, i) => (
              <View key={i} style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {isExpired && (
            <TouchableOpacity style={s.bookBtn} onPress={() => router.push('/gyms' as any)}>
              <Text style={s.bookBtnText}>Book Another Slot</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingVertical: 12,
  },
  back: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fonts.serif, fontSize: 18, color: '#fff' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 },
  gymBadge: {
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 8,
  },
  gymBadgeText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent },
  bookingInfo: {
    fontFamily: fonts.sans, fontSize: 12, color: colors.t2,
    marginBottom: 20, textAlign: 'center',
  },
  manualBox: {
    width: '100%',
    backgroundColor: 'rgba(204,255,0,0.08)',
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  manualLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.2, color: colors.t2, textTransform: 'uppercase' },
  manualCode: { fontFamily: fonts.sansBold, fontSize: 22, letterSpacing: 2, color: colors.accent, marginTop: 3 },
  manualHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2, marginTop: 3 },
  qrBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24,
    padding: 24, borderWidth: 1, borderColor: colors.borderGlass,
    marginBottom: 16, position: 'relative', overflow: 'hidden',
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.75)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 24,
  },
  expiredText: { fontFamily: fonts.sansBold, fontSize: 18, color: '#FF4444' },
  timerBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accentBorder,
    paddingHorizontal: 20, paddingVertical: 10, marginBottom: 16,
  },
  timerText: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.accent, letterSpacing: 2 },
  timerLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  notice: {
    fontFamily: fonts.sans, fontSize: 12, color: colors.t2,
    textAlign: 'center', marginBottom: 20, lineHeight: 18,
  },
  steps: { width: '100%', gap: 10, marginBottom: 24 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent },
  stepText: { fontFamily: fonts.sans, fontSize: 13, color: colors.t, flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: '#fff', textAlign: 'center' },
  emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center', lineHeight: 20 },
  bookBtn: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  bookBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: '#060606' },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
});
