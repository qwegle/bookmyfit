import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { gymStaffApi } from '../../lib/api';
import { colors, fonts, radius, spacing } from '../../theme/brand';
import { IconUser, IconSearch, IconRefresh } from '../../components/Icons';

type Member = {
  id: string;
  name?: string;
  phone?: string;
  planName?: string;
  planTier?: string;
  status: 'active' | 'expired';
  lastVisit?: string;
};

type FilterType = 'all' | 'active' | 'expired';

const TIER_COLORS: Record<string, string> = {
  elite: colors.tierElite,
  premium: colors.tierPremium,
  standard: colors.tierStandard,
  aqua: colors.tierAqua,
};

function getInitials(member: Member): string {
  if (member.name) {
    const parts = member.name.trim().split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0].substring(0, 2).toUpperCase();
  }
  return member.phone?.substring(0, 2) ?? '??';
}

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filtered, setFiltered] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFilters = useCallback((data: Member[], q: string, f: FilterType) => {
    let result = data;
    if (f !== 'all') result = result.filter((m) => m.status === f);
    if (q.trim()) {
      const lower = q.toLowerCase();
      result = result.filter((m) =>
        (m.name?.toLowerCase().includes(lower)) || (m.phone?.includes(lower))
      );
    }
    setFiltered(result);
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const data = await gymStaffApi.myMembers();
      const raw = Array.isArray(data) ? data : data?.members ?? data?.data ?? [];
      const list: Member[] = raw.map((m: any) => ({
        id: m.id ?? m._id ?? String(Math.random()),
        name: m.name ?? m.memberName,
        phone: m.phone ?? m.memberPhone,
        planName: m.planName ?? m.plan?.name ?? 'Standard',
        planTier: (m.planTier ?? m.plan?.tier ?? 'standard').toLowerCase(),
        status: m.status === 'active' ? 'active' : 'expired',
        lastVisit: m.lastVisit ?? m.lastCheckin ?? 'No visits',
      }));
      setMembers(list);
      applyFilters(list, search, filter);
    } catch {
      setError('Could not load members from the API.');
      setMembers([]);
      applyFilters([], search, filter);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, filter, applyFilters]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMembers();
    }, [fetchMembers])
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters(members, text, filter), 300);
  };

  const handleFilter = (f: FilterType) => {
    setFilter(f);
    applyFilters(members, search, f);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const renderMember = ({ item }: { item: Member }) => {
    const tierColor = TIER_COLORS[item.planTier ?? 'standard'] ?? colors.tierStandard;
    return (
      <View style={s.memberRow}>
        <View style={[s.avatar, { borderColor: tierColor + '55' }]}>
          <Text style={[s.avatarText, { color: tierColor }]}>{getInitials(item)}</Text>
        </View>
        <View style={s.memberInfo}>
          <Text style={s.memberName}>{item.name ?? 'Unknown Member'}</Text>
          <Text style={s.memberPhone}>{item.phone ?? ''}</Text>
          <Text style={s.memberVisit}>Last visit: {item.lastVisit}</Text>
        </View>
        <View style={s.memberRight}>
          <View style={[s.planBadge, { backgroundColor: tierColor + '22', borderColor: tierColor + '55' }]}>
            <Text style={[s.planText, { color: tierColor }]}>{item.planName}</Text>
          </View>
          <View style={[s.statusBadge, item.status === 'active' ? s.statusActive : s.statusExpired]}>
            <Text style={[s.statusText, item.status === 'active' ? s.statusTextActive : s.statusTextExpired]}>
              {item.status === 'active' ? 'Active' : 'Expired'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerContainer}>
        <Text style={s.title}>Members</Text>
        {error && (
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchMembers(); }}>
            <IconRefresh size={14} color={colors.accent} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={s.searchContainer}>
        <IconSearch size={16} color={colors.t2} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Search by name or phone"
          placeholderTextColor={colors.t3}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {(['all', 'active', 'expired'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => handleFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={filtered.length === 0 ? s.emptyContainer : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <IconUser size={40} color={colors.t3} />
            <Text style={s.emptyTitle}>No members found</Text>
            <Text style={s.emptySubtitle}>
              {search ? 'Try a different search term' : 'Members will appear here once they join'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loader: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  headerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.text },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retryText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accent },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.text },

  filterRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  filterTab: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterTabActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  filterTabText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.t2 },
  filterTabTextActive: { color: colors.accent },

  errorBanner: {
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,60,60,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,60,60,0.2)',
    borderRadius: radius.sm, padding: spacing.sm,
  },
  errorText: { fontFamily: fonts.sans, fontSize: 12, color: colors.error },

  listContent: { paddingHorizontal: spacing.xl, paddingBottom: 36 },
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.t },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.t2, textAlign: 'center', maxWidth: 220 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, gap: spacing.md,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 15 },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  memberPhone: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  memberVisit: { fontFamily: fonts.sans, fontSize: 11, color: colors.t3 },
  memberRight: { alignItems: 'flex-end', gap: 6 },
  planBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  planText: { fontFamily: fonts.sansBold, fontSize: 10 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  statusActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  statusExpired: { backgroundColor: 'rgba(255,60,60,0.12)', borderColor: 'rgba(255,60,60,0.3)' },
  statusText: { fontFamily: fonts.sansBold, fontSize: 10 },
  statusTextActive: { color: colors.accent },
  statusTextExpired: { color: colors.error },
});
