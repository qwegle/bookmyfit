import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../../theme/brand';
import { IconUser, IconBell, IconLock, IconInfo, IconChevronRight, IconBolt, IconCreditCard, IconClock, IconShopping, IconCalendar, IconShield } from '../../components/Icons';
import { usersApi, logout } from '../../lib/api';
import AuroraBackground from '../../components/AuroraBackground';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.me()
      .then((data: any) => setUser(data?.user || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const name = user?.name || 'Member';
  const phone = user?.phone || user?.phoneNumber || '';
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2024';
  const totalCheckins = user?.totalCheckins || user?.checkinsCount || 0;
  const activePlans = user?.activePlansCount || user?.activeSubscriptions || 0;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const MENU_ITEMS = [
    { label: 'My Subscriptions', icon: IconCreditCard, onPress: () => router.push('/(tabs)/subscriptions') },
    { label: 'My Session Bookings', icon: IconCalendar, onPress: () => router.push('/my-bookings') },
    { label: 'Visit History', icon: IconClock, onPress: () => router.push('/history') },
    { label: 'Store Orders', icon: IconShopping, onPress: () => router.push('/(tabs)/store') },
    { label: 'Notifications', icon: IconBell, onPress: () => router.push('/notifications') },
    { label: 'Rate App', icon: IconBolt, onPress: () => Alert.alert('Rate App', 'Thank you for your support!') },
    { label: 'Help & Support', icon: IconInfo, onPress: () => Alert.alert('Help & Support', 'Email us at support@bookmyfit.in') },
    { label: 'Edit Profile', icon: IconUser, onPress: () => router.push('/edit-profile') },
    { label: 'Privacy & Security', icon: IconLock, onPress: () => Alert.alert('Privacy', 'Your data is safe with us.') },
    { label: 'Refund Policy', icon: IconShield, onPress: () => {
      Alert.alert(
        'No Refund Policy',
        'All purchases on BookMyFit are final. We do not offer refunds on any passes, subscriptions, or wellness bookings once purchased.\n\nFor session bookings, you may cancel up to 2 hours before the booking time. Cancelled sessions do not entitle you to a refund — they count as used sessions.\n\nFor queries, contact support@bookmyfit.in',
        [{ text: 'Understood' }],
      );
    }},
  ];

  return (
    <AuroraBackground>
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Avatar & Name */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <View style={s.avatarSection}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <Text style={s.name}>{name}</Text>
            {!!phone && <Text style={s.email}>{phone}</Text>}
            <View style={s.badges}>
              <View style={s.badgeGreen}>
                <IconBolt size={10} color={colors.accent} />
                <Text style={s.badgeGreenText}>BMF Member</Text>
              </View>
              <View style={s.badgeGlass}>
                <Text style={s.badgeGlassText}>Since {memberSince}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.accent }]}>{loading ? '—' : totalCheckins}</Text>
            <Text style={s.statLabel}>Check-ins</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{loading ? '—' : activePlans}</Text>
            <Text style={s.statLabel}>Active{'\n'}Plans</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{memberSince}</Text>
            <Text style={s.statLabel}>Member{'\n'}Since</Text>
          </View>
        </View>

        {/* Menu */}
        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[s.menuItem, i < MENU_ITEMS.length - 1 && s.menuBorder]}
              onPress={item.onPress}
            >
              <View style={s.menuIconWrap}><item.icon size={16} color={colors.t} /></View>
              <Text style={s.menuText}>{item.label}</Text>
              <IconChevronRight size={14} color={colors.t3} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.logout} onPress={handleLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 36 },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.accentSoft,
    borderWidth: 2, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.accent },
  name: { fontFamily: fonts.sansBold, fontSize: 22, color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  email: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badgeGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  badgeGreenText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.accent, letterSpacing: 0.5 },
  badgeGlass: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  badgeGlassText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.t, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  },
  statNum: { fontFamily: fonts.sansBold, fontSize: 14, color: '#fff', marginBottom: 4 },
  statLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.t2, textAlign: 'center', lineHeight: 14 },
  sectionLabel: {
    fontFamily: fonts.sansBold, fontSize: 10, color: colors.t2,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 6,
  },
  menuCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  menuText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: '#fff' },
  logout: {
    marginTop: 10, height: 50, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,60,60,0.1)', borderWidth: 1, borderColor: 'rgba(255,60,60,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 14, color: 'rgba(255,100,100,0.9)' },
});
