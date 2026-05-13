import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconBell, IconBolt, IconCheck, IconDumbbell, IconCreditCard } from '../components/Icons';
import { miscApi, api } from '../lib/api';
import AuroraBackground from '../components/AuroraBackground';

const TYPE_COLOR: Record<string, string> = {
  subscription_expiry: 'rgba(255,138,0,0.9)',
  check_in: colors.accent,
  payment: 'rgba(0,175,255,0.9)',
  promotional: 'rgba(155,0,255,0.9)',
};

function getTypeIcon(type: string) {
  switch (type) {
    case 'check_in': return IconCheck;
    case 'subscription_expiry': return IconCreditCard;
    case 'payment': return IconBolt;
    case 'promotional': return IconDumbbell;
    default: return IconBell;
  }
}

function groupNotifications(notifs: any[]) {
  const now = Date.now();
  const groups: Record<string, any[]> = { Today: [], 'This Week': [], Earlier: [] };
  notifs.forEach((n) => {
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : now;
    const diff = now - ts;
    if (diff < 86400000) groups.Today.push(n);
    else if (diff < 7 * 86400000) groups['This Week'].push(n);
    else groups.Earlier.push(n);
  });
  return groups;
}

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    miscApi.notifications()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.notifications || data?.data || [];
        setNotifs(list);
      })
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
  };

  const markOneRead = async (n: any) => {
    if (n.read ?? n.isRead) return;
    const id = n.id || n._id;
    setNotifs((prev) => prev.map((x) => (x.id || x._id) === id ? { ...x, read: true, isRead: true } : x));
    try {
      if (id) await api.post(`/notifications/${id}/read`);
    } catch {}
  };

  const unreadCount = notifs.filter((n) => !(n.read ?? n.isRead)).length;
  const grouped = groupNotifications(notifs);

  if (!loading && notifs.length === 0) {
    return (
      <AuroraBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={s.header}>
            <TouchableOpacity style={s.back} onPress={() => router.back()}>
              <IconArrowLeft size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Notifications</Text>
            <View style={{ width: 80 }} />
          </View>
          <View style={s.emptyState}>
            <IconBell size={44} color={colors.accent} />
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptyBody}>No new notifications</Text>
          </View>
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={s.markAll}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {Object.entries(grouped).map(([group, groupNotifs]) => {
            if (groupNotifs.length === 0) return null;
            return (
              <View key={group}>
                <Text style={s.groupHeader}>{group}</Text>
                {groupNotifs.map((n: any, i: number) => {
                  const Icon = getTypeIcon(n.type || n.notificationType || '');
                  const ic = TYPE_COLOR[n.type || n.notificationType || ''] || colors.t;
                  const isRead = n.read ?? n.isRead ?? false;
                  const title = n.title || n.subject || '';
                  const body = n.body || n.message || n.description || '';
                  const time = n.time || (n.createdAt ? new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
                  return (
                    <TouchableOpacity key={n.id || n._id || i} style={[s.card, !isRead && s.cardUnread]} onPress={() => markOneRead(n)} activeOpacity={0.75}>
                      <View style={[s.iconWrap, { borderColor: ic + '44' }]}>
                        <Icon size={14} color={ic} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.titleRow}>
                          <Text style={s.title} numberOfLines={1}>{title}</Text>
                          {!isRead && <View style={s.dot} />}
                        </View>
                        <Text style={s.body} numberOfLines={2}>{body}</Text>
                        <Text style={s.time}>{time}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 12 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.serif, fontSize: 18, color: '#fff' },
  markAll: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accent },
  groupHeader: {
    fontFamily: fonts.sansBold, fontSize: 10, color: colors.t2,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 6,
  },
  list: { paddingHorizontal: 22, paddingBottom: 40 },
  card: {
    flexDirection: 'row', gap: 12, padding: 14, marginBottom: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  },
  cardUnread: { borderColor: colors.accentBorder, backgroundColor: 'rgba(0,212,106,0.04)' },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.sansBold, fontSize: 13, color: '#fff', flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  body: { fontFamily: fonts.sans, fontSize: 12, color: colors.t, marginTop: 3, lineHeight: 17 },
  time: { fontFamily: fonts.sans, fontSize: 10, color: colors.t3, marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: '#fff' },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2 },
});
