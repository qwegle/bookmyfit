import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft, IconCheck, IconBolt, IconDumbbell, IconStar, IconPercent, IconShield, IconHeadphones, IconChevronRight, IconCalendar, IconPin, IconCreditCard, IconArrowRight } from '../components/Icons';
import { subscriptionsApi, gymsApi, gymPlansApi } from '../lib/api';
import { getActiveSubscriptionAccess, normalizeSubscriptionList } from '../lib/subscriptionAccess';

const { width: SCREEN_W } = Dimensions.get('window');

const PLANS = [
  {
    id: 'day_pass',
    num: '1',
    name: 'One Day Pass',
    tagline: 'Try before you commit',
    price: '₹99',
    priceUnit: '/ day',
    accent: '#00D46A',
    bg: 'rgba(0,212,106,0.06)',
    border: 'rgba(0,212,106,0.22)',
    img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80',
    cta: 'Explore Gyms',
    badge: null,
    features: [
      'Access to 1 gym for 1 day',
      'All facilities included',
      'No commitment required',
      'Perfect for beginners & travelers',
    ],
  },
  {
    id: 'same_gym',
    num: '2',
    name: 'Same Gym Pass',
    tagline: 'Your local gym, all month',
    price: '₹999',
    priceUnit: '/ month',
    accent: '#60A5FA',
    bg: 'rgba(96,165,250,0.06)',
    border: 'rgba(96,165,250,0.25)',
    img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
    cta: 'View Plans',
    badge: null,
    features: [
      'Access to 1 selected gym',
      'Plans: 1 / 3 / 6 / 12 Months',
      'Best for consistency & transformation',
      'Pause option available',
    ],
  },
  {
    id: 'multi_gym',
    num: '3',
    name: 'Multi Gym Pass',
    tagline: 'Access any gym, anytime',
    price: '₹1,499',
    priceUnit: '/ month',
    accent: '#A78BFA',
    bg: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.25)',
    img: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&q=80',
    cta: 'Continue',
    badge: '🔥 Most Popular',
    features: [
      'Access to 100+ gyms',
      'Switch gyms anytime',
      'No daily check-in limit',
      'Ideal for busy professionals & travelers',
    ],
  },
];

const HOW_STEPS = [
  { num: '1', label: 'Choose Pass' },
  { num: '2', label: 'Select Gym' },
  { num: '3', label: 'Book & Pay' },
  { num: '4', label: 'Start Workout' },
];

type PlanCard = typeof PLANS[number] & { priceNumber?: number | null; unavailableReason?: string | null };

function positiveNumber(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function formatPrice(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatDateLabel(value: any) {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function planMonths(plan: any) {
  return Math.max(1, Math.round(Number(plan?.durationDays || plan?.days || 30) / 30));
}

function minMonthlyPriceFromGymPlans(plans: any[]) {
  const monthlyPrices = plans
    .filter((plan) => plan?.isActive !== false)
    .map((plan) => {
      const price = positiveNumber(plan?.price || plan?.basePrice);
      return price ? price / planMonths(plan) : null;
    })
    .filter((price): price is number => !!price);

  return monthlyPrices.length ? Math.min(...monthlyPrices) : null;
}

export default function PlansScreen() {
  const { gymId, gymName } = useLocalSearchParams<{ gymId?: string; gymName?: string }>();
  const [serverPlans, setServerPlans] = useState<any>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState<any>(null);
  const [gymPlans, setGymPlans] = useState<any[]>([]);
  const [activeGymSubIds, setActiveGymSubIds] = useState<Set<string>>(new Set());
  const [activeGymSubMap, setActiveGymSubMap] = useState<Map<string, any>>(new Map());
  const [hasMultiGymSub, setHasMultiGymSub] = useState(false);

  useEffect(() => {
    let active = true;
    setPlansLoading(true);
    subscriptionsApi.plans()
      .then((data: any) => { if (active) setServerPlans(data || null); })
      .catch(() => { if (active) setServerPlans(null); })
      .finally(() => { if (active) setPlansLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!gymId) {
      setSelectedGym(null);
      setGymPlans([]);
      return () => { active = false; };
    }

    Promise.all([
      gymsApi.getById(gymId).catch(() => null),
      gymPlansApi.forGym(gymId).catch(() => []),
    ]).then(([gymRes, planRes]: any[]) => {
      if (!active) return;
      setSelectedGym(gymRes?.gym || gymRes || null);
      setGymPlans(Array.isArray(planRes) ? planRes : planRes?.plans || []);
    });

    return () => { active = false; };
  }, [gymId]);

  useEffect(() => {
    subscriptionsApi.mySubscriptions()
      .then((data: any) => {
        const state = getActiveSubscriptionAccess(normalizeSubscriptionList(data));
        setActiveGymSubIds(state.gymIds);
        setActiveGymSubMap(state.byGymId);
        setHasMultiGymSub(state.hasMultiGym);
      })
      .catch(() => {
        setActiveGymSubIds(new Set());
        setActiveGymSubMap(new Map());
        setHasMultiGymSub(false);
      });
  }, []);

  const hasSelectedGymAccess = !!gymId && (activeGymSubIds.has(String(gymId)) || hasMultiGymSub);
  const activeSelectedGymSub = gymId ? activeGymSubMap.get(String(gymId)) : null;
  const selectedGymDisplayName = gymName || selectedGym?.name || 'this gym';
  const activeUntil = formatDateLabel(activeSelectedGymSub?.endDate || activeSelectedGymSub?.validUntil);

  const displayPlans: PlanCard[] = useMemo(() => {
    const dayPrice = positiveNumber(selectedGym?.dayPassPrice)
      || positiveNumber(serverPlans?.day_pass?.basePrice);
    const activeGymPlans = gymPlans.filter((plan) => plan?.isActive !== false && positiveNumber(plan?.price || plan?.basePrice));
    const sameMonthly = minMonthlyPriceFromGymPlans(activeGymPlans);
    const sameGymUnavailable = !!gymId && !plansLoading && activeGymPlans.length === 0;
    const multiMonthly = positiveNumber(serverPlans?.multi_gym?.basePrice);

    return PLANS.map((plan) => {
      if (plan.id === 'day_pass') {
        return {
          ...plan,
          price: dayPrice ? formatPrice(dayPrice) : (plansLoading ? 'Loading...' : (gymId ? 'Unavailable' : 'Select gym')),
          priceUnit: '/ day',
          priceNumber: dayPrice,
          features: serverPlans?.day_pass?.features || plan.features,
        };
      }

      if (plan.id === 'same_gym') {
        return {
          ...plan,
          price: sameMonthly ? formatPrice(sameMonthly) : (plansLoading ? 'Loading...' : (gymId ? 'Not set' : 'Select gym')),
          priceUnit: '/ month',
          priceNumber: sameMonthly,
          tagline: sameGymUnavailable ? 'This gym has not added membership plans yet' : plan.tagline,
          features: activeGymPlans.length
            ? (serverPlans?.same_gym?.features || plan.features)
            : (gymId
              ? ['This gym has not configured membership plans yet', 'You can still buy a day pass if available', 'Try Multi Gym Pass for access across partner gyms']
              : plan.features),
          unavailableReason: sameGymUnavailable
            ? `${selectedGymDisplayName} has not added subscription plans yet. Please choose a day pass, multi-gym pass, or check again after the gym adds plans.`
            : null,
        };
      }

      return {
        ...plan,
        price: multiMonthly ? formatPrice(multiMonthly) : (plansLoading ? 'Loading...' : 'Unavailable'),
        priceUnit: '/ month',
        priceNumber: multiMonthly,
        features: serverPlans?.multi_gym?.features || plan.features,
      };
    });
  }, [gymId, gymPlans, plansLoading, selectedGym, selectedGymDisplayName, serverPlans]);

  const handleSelect = (plan: PlanCard) => {
    if (hasSelectedGymAccess && (plan.id === 'same_gym' || plan.id === 'day_pass')) {
      router.push({ pathname: '/slots', params: { gymId } } as any);
      return;
    }
    if ((plan.id === 'same_gym' || plan.id === 'day_pass') && !gymId) {
      router.push('/gyms' as any);
      return;
    }
    if (!plan.priceNumber) {
      Alert.alert('Plan unavailable', plan.unavailableReason || 'This plan does not have active pricing from the server yet. Please try again later.');
      return;
    }
    const selectedGymName = gymName || selectedGym?.name || '';
    const sameGymPlanPayload = plan.id === 'same_gym'
      ? gymPlans
        .filter((gymPlan) => gymPlan?.isActive !== false && positiveNumber(gymPlan?.price || gymPlan?.basePrice))
        .map((gymPlan) => ({
          id: gymPlan.id,
          name: gymPlan.name,
          price: gymPlan.price || gymPlan.basePrice,
          durationDays: gymPlan.durationDays || gymPlan.days || 30,
          features: gymPlan.features || [],
        }))
      : [];
    router.push({
      pathname: '/duration',
      params: {
        planId: plan.id,
        planName: plan.name,
        gymId: gymId || '',
        gymName: selectedGymName,
        basePrice: String(plan.priceNumber),
        isDayPass: plan.id === 'day_pass' ? 'true' : 'false',
        gymPlansJson: sameGymPlanPayload.length ? JSON.stringify(sameGymPlanPayload) : '',
      },
    });
  };

  const ctaLabel = (plan: PlanCard) =>
    hasSelectedGymAccess && (plan.id === 'same_gym' || plan.id === 'day_pass')
      ? 'Book Slot'
      : (plan.id === 'same_gym' || plan.id === 'day_pass') && !gymId
        ? 'Select Gym'
        : (!plan.priceNumber && !plansLoading && plan.id === 'same_gym' && gymId) ? 'Not Available' : plan.cta;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.container}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={s.stepper}>
          {['Choose Pass', 'Select Gym', 'Checkout'].map((label, i) => (
            <View key={label} style={s.stepItem}>
              <View style={[s.stepCircle, i === 0 && s.stepCircleActive]}>
                <Text style={[s.stepNum, i === 0 && s.stepNumActive]}>{i + 1}</Text>
              </View>
              <Text style={[s.stepLabel, i === 0 && s.stepLabelActive]}>{label}</Text>
              {i < 2 && <View style={s.stepLine} />}
            </View>
          ))}
        </View>

        {/* Title */}
        <Text style={s.title}>Choose Your Pass</Text>
        <Text style={s.subtitle}>Pick the perfect pass that fits your fitness journey</Text>

        {gymId && gymName ? (
          <View style={s.gymChip}>
            <Text style={s.gymChipText}>{gymName}</Text>
          </View>
        ) : null}

        {/* Plan cards — vertical stacked */}
        {hasSelectedGymAccess ? (
          <View style={s.activePassNotice}>
            <IconCheck size={14} color={colors.accent} />
            <Text style={s.activePassNoticeText}>
              {hasMultiGymSub
                ? `Your multi-gym pass is active for ${selectedGymDisplayName}.`
                : `You already have an active pass at ${selectedGymDisplayName}${activeUntil ? ` until ${activeUntil}` : ''}.`}
            </Text>
          </View>
        ) : null}

        {displayPlans.map((plan) => (
          <View key={plan.id} style={[s.card, { borderColor: plan.border }]}>
            {/* Card header */}
            <View style={[s.cardHeader, { backgroundColor: plan.bg }]}>
              <View style={[s.numBadge, { backgroundColor: plan.accent }]}>
                <Text style={s.numBadgeText}>{plan.num}</Text>
              </View>
              <View style={s.cardHeaderText}>
                <Text style={s.planName}>{plan.name}</Text>
                <Text style={s.planTagline}>{plan.tagline}</Text>
              </View>
              {plan.badge && (
                <View style={[s.badge, { backgroundColor: plan.accent + '22', borderColor: plan.accent + '44' }]}>
                  <Text style={[s.badgeText, { color: plan.accent }]}>{plan.badge}</Text>
                </View>
              )}
            </View>

            <View style={[s.cardImage, { backgroundColor: plan.bg }]}>
              <IconDumbbell size={34} color={plan.accent} />
            </View>

            {/* Features */}
            <View style={s.featuresSection}>
              {plan.features.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <View style={[s.checkCircle, { backgroundColor: plan.accent + '18' }]}>
                    <IconCheck size={10} color={plan.accent} />
                  </View>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Divider */}
            <View style={s.divider} />

            {/* Price + CTA */}
            <View style={s.priceSection}>
              <View>
                <Text style={s.priceFrom}>From</Text>
                <View style={s.priceRow}>
                  <Text style={[s.priceVal, { color: plan.accent }]}>{plan.price}</Text>
                  <Text style={s.priceUnit}>{plan.priceUnit}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[
                s.ctaBtn,
                { backgroundColor: plan.accent },
                hasSelectedGymAccess && (plan.id === 'same_gym' || plan.id === 'day_pass') && s.ctaBtnSubscribed,
              ]}
              onPress={() => handleSelect(plan)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  s.ctaBtnText,
                  hasSelectedGymAccess && (plan.id === 'same_gym' || plan.id === 'day_pass') && s.ctaBtnTextSubscribed,
                ]}
              >
                {ctaLabel(plan)}
              </Text>
              <IconChevronRight
                size={16}
                color={hasSelectedGymAccess && (plan.id === 'same_gym' || plan.id === 'day_pass') ? colors.accent : '#060606'}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* How it works */}
        <Text style={s.howTitle}>How it works?</Text>
        <View style={s.howRow}>
          {HOW_STEPS.map((step, i) => (
            <View key={i} style={s.howItem}>
              <View style={s.howIconBox}>
                <Text style={s.howStepNum}>{step.num}</Text>
              </View>
              <Text style={s.howLabel}>{step.label}</Text>
              {i < HOW_STEPS.length - 1 && (
                <View style={s.howArrow}>
                  <IconArrowRight size={14} color={colors.t3} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Trust strip */}
        <View style={s.trustRow}>
          {[
            { icon: 'percent', label: 'Best Prices Guaranteed' },
            { icon: 'shield', label: 'Verified Gyms' },
            { icon: 'bolt', label: 'Easy Booking' },
            { icon: 'headphones', label: '24/7 Support' },
          ].map((item) => (
            <View key={item.label} style={s.trustItem}>
              <View style={s.trustIcon}>
                {item.icon === 'percent' && <IconPercent size={13} color={colors.accent} />}
                {item.icon === 'shield' && <IconShield size={13} color={colors.accent} />}
                {item.icon === 'bolt' && <IconBolt size={13} color={colors.accent} />}
                {item.icon === 'headphones' && <IconHeadphones size={13} color={colors.accent} />}
              </View>
              <Text style={s.trustLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060606' },
  container: { paddingBottom: 48 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 20 },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepNum: { fontFamily: fonts.sansBold, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  stepNumActive: { color: '#060606' },
  stepLabel: { fontFamily: fonts.sansMedium, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 6 },
  stepLabelActive: { color: '#fff' },
  stepLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 6 },

  // Title
  title: { fontFamily: fonts.serif, fontSize: 28, color: '#fff', paddingHorizontal: 20, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: 'rgba(255,255,255,0.45)', paddingHorizontal: 20, marginTop: 6, marginBottom: 16 },
  gymChip: {
    alignSelf: 'flex-start', marginHorizontal: 20, marginBottom: 16,
    backgroundColor: 'rgba(0,212,106,0.1)', borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
  },
  gymChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent },
  activePassNotice: {
    marginHorizontal: 20, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,212,106,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,212,106,0.22)',
    borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10,
  },
  activePassNoticeText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t, lineHeight: 17 },

  // Plan card
  card: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  numBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  numBadgeText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#060606' },
  cardHeaderText: { flex: 1 },
  planName: { fontFamily: fonts.sansBold, fontSize: 17, color: '#fff' },
  planTagline: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10 },

  cardImage: { width: '100%', height: 112, alignItems: 'center', justifyContent: 'center' },

  featuresSection: { padding: 16, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureText: { fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16 },

  priceSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  priceFrom: { fontFamily: fonts.sans, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceVal: { fontFamily: fonts.sansBold, fontSize: 28, letterSpacing: -0.5 },
  priceUnit: { fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16, marginTop: 12,
    borderRadius: 12, paddingVertical: 14,
  },
  ctaBtnSubscribed: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  ctaBtnText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#060606' },
  ctaBtnTextSubscribed: { color: colors.accent },

  // How it works
  howTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff', paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  howRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 24, alignItems: 'flex-start', gap: 0 },
  howItem: { flex: 1, alignItems: 'center', position: 'relative' },
  howIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,212,106,0.1)', borderWidth: 1, borderColor: 'rgba(0,212,106,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  howStepNum: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  howLabel: { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  howArrow: { position: 'absolute', top: 14, right: -8 },
  howArrowText: { fontSize: 14, color: 'rgba(255,255,255,0.2)' },

  // Trust
  trustRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16,
  },
  trustItem: { flex: 1, alignItems: 'center', gap: 5 },
  trustIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,212,106,0.1)', borderWidth: 1, borderColor: 'rgba(0,212,106,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  trustLabel: { fontFamily: fonts.sansMedium, fontSize: 9, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
});
