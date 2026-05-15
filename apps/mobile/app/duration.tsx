import { useEffect, useMemo, useState } from 'react';
import {
  Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AuroraBackground from '../components/AuroraBackground';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, fonts, radius } from '../theme/brand';
import { IconArrowLeft } from '../components/Icons';
import { api, trainersApi } from '../lib/api';
import { applyPassCommission } from '../lib/passPricing';

const PT_DURATION_OPTIONS = [1, 3, 6, 12];

type DurationOption = {
  months: number;
  label: string;
  sublabel: string;
  price: number;
  save: string | null;
  isDayPass: boolean;
  hot: boolean;
  gymPlanId?: string;
};

type GymPlanOption = {
  id?: string;
  name?: string;
  price?: number | string;
  durationDays?: number | string;
};

type TrainerOption = {
  id?: string;
  _id?: string;
  name?: string;
  specialization?: string;
  specialty?: string;
  monthlyPrice?: number | string;
  monthlyPriceInr?: number | string;
  sessionRateInr?: number | string;
  pricePerSession?: number | string;
};

function money(value: number) {
  return `Rs ${Math.round(value).toLocaleString('en-IN')}`;
}

function monthsLabel(months: number) {
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export default function Duration() {
  const insets = useSafeAreaInsets();
  const { planId, planName, gymId, gymName, basePrice, isDayPass: isDayPassParam, gymPlansJson } = useLocalSearchParams<{
    planId: string; planName: string; gymId?: string; gymName?: string; basePrice?: string; isDayPass?: string; gymPlansJson?: string;
  }>();

  const routeBase = Number(basePrice);
  const monthlyBase = Number.isFinite(routeBase) && routeBase > 0 ? routeBase : null;
  const isPlanDayPass = planId === 'day_pass' || isDayPassParam === 'true';
  const gymPlanOptions = useMemo(() => {
    if (!gymPlansJson || planId !== 'same_gym') return [];
    try {
      const parsed = JSON.parse(String(gymPlansJson));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((plan: GymPlanOption) => {
          const price = Number(plan.price);
          const days = Number(plan.durationDays || 30);
          if (!plan.id || !Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) return null;
          return { id: plan.id, name: plan.name, price, days };
        })
        .filter(Boolean) as { id: string; name?: string; price: number; days: number }[];
    } catch {
      return [];
    }
  }, [gymPlansJson, planId]);

  const DURATIONS: DurationOption[] = useMemo(() => {
    if (isPlanDayPass) {
      return monthlyBase
        ? [{ months: 0, label: '1 Day Pass', sublabel: 'Single visit', price: monthlyBase, save: null, isDayPass: true, hot: false }]
        : [];
    }
    if (planId === 'same_gym' && gymPlanOptions.length > 0) {
      return gymPlanOptions
        .slice()
        .sort((a, b) => a.days - b.days)
        .map((plan) => {
          const months = Math.max(1, Math.round(plan.days / 30));
          const rackTotal = (monthlyBase || (plan.price / months)) * months;
          const savePct = rackTotal > plan.price ? Math.round((1 - plan.price / rackTotal) * 100) : 0;
          return {
            months,
            label: `${months} ${months === 1 ? 'Month' : 'Months'}`,
            sublabel: plan.name || 'Gym managed plan',
            price: Math.round(plan.price),
            save: savePct > 0 ? `Save ${savePct}%` : null,
            isDayPass: false,
            hot: false,
            gymPlanId: plan.id,
          };
        });
    }
    if (planId === 'same_gym') return [];
    if (!monthlyBase) return [];
    return [
      { months: 1, label: '1 Month', sublabel: 'Most flexible', price: monthlyBase, save: null, isDayPass: false, hot: false },
      { months: 3, label: '3 Months', sublabel: 'Quarterly access', price: Math.round(monthlyBase * 3), save: null, isDayPass: false, hot: false },
      { months: 6, label: '6 Months', sublabel: 'Half-year access', price: Math.round(monthlyBase * 6), save: null, isDayPass: false, hot: false },
      { months: 12, label: '12 Months', sublabel: 'Annual access', price: Math.round(monthlyBase * 12), save: null, isDayPass: false, hot: false },
    ];
  }, [monthlyBase, isPlanDayPass, planId, gymPlanOptions]);

  const [selected, setSelected] = useState(0);
  const [ptAddon, setPtAddon] = useState(false);
  const [ptDurationMonths, setPtDurationMonths] = useState(1);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(false);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [serverPlans, setServerPlans] = useState<any>(null);

  const dur = DURATIONS[selected] || { months: 0, label: 'No active plan', sublabel: '', price: 0, save: null, isDayPass: true, hot: false };
  const base = dur.price;
  const selectedTrainer = trainers.find((trainer) => String(trainer.id || trainer._id) === selectedTrainerId) || null;
  const selectedTrainerMonthly = Number(
    selectedTrainer?.monthlyPriceInr
      ?? selectedTrainer?.monthlyPrice
      ?? selectedTrainer?.sessionRateInr
      ?? selectedTrainer?.pricePerSession
      ?? 0,
  );
  const fallbackPtMonthly = trainers.length
    ? Math.min(...trainers.map((trainer) => Number(trainer.monthlyPriceInr ?? trainer.monthlyPrice ?? trainer.sessionRateInr ?? trainer.pricePerSession ?? 0)).filter((price) => Number.isFinite(price) && price > 0))
    : 0;
  const ptMonthlyPrice = selectedTrainer && Number.isFinite(selectedTrainerMonthly) && selectedTrainerMonthly > 0
    ? selectedTrainerMonthly
    : fallbackPtMonthly;
  const ptBaseCost = !dur.isDayPass && ptAddon && selectedTrainer ? ptMonthlyPrice * ptDurationMonths : 0;
  const ptCost = ptBaseCost ? (applyPassCommission(ptBaseCost, serverPlans?.personal_training?.commission) || ptBaseCost) : 0;
  const subtotal = base + ptCost;
  const total = subtotal;
  const bottomInset = Math.max(insets.bottom, 34);
  const availablePtDurations = useMemo(
    () => PT_DURATION_OPTIONS.filter((months) => months <= Math.max(dur.months || 1, 1)),
    [dur.months],
  );

  useEffect(() => {
    if (selected >= DURATIONS.length) setSelected(0);
  }, [DURATIONS.length, selected]);

  useEffect(() => {
    let active = true;
    api.get('/subscriptions/plans')
      .then((data) => { if (active) setServerPlans(data); })
      .catch(() => { if (active) setServerPlans(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dur.isDayPass) setPtDurationMonths(dur.months || 1);
  }, [dur.isDayPass, dur.months]);

  useEffect(() => {
    if (ptAddon && trainers.length === 0) setPtAddon(false);
  }, [ptAddon, trainers.length]);

  useEffect(() => {
    let active = true;
    if (!gymId || isPlanDayPass) {
      setTrainers([]);
      setSelectedTrainerId('');
      setPtAddon(false);
      return () => { active = false; };
    }

    setTrainersLoading(true);
    setSelectedTrainerId('');
    trainersApi.listByGym(String(gymId))
      .then((data: any) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : data?.data || data?.trainers || [];
        const priced = list.filter((trainer: TrainerOption) => {
          const price = Number(trainer.monthlyPriceInr ?? trainer.monthlyPrice ?? trainer.sessionRateInr ?? trainer.pricePerSession ?? 0);
          return Number.isFinite(price) && price > 0;
        });
        setTrainers(priced);
        setSelectedTrainerId((current) => current || String(priced[0]?.id || priced[0]?._id || ''));
      })
      .catch(() => {
        if (active) setTrainers([]);
      })
      .finally(() => {
        if (active) setTrainersLoading(false);
      });

    return () => { active = false; };
  }, [gymId, isPlanDayPass]);

  const handleCheckout = () => {
    if (DURATIONS.length === 0 || dur.price <= 0) {
      Alert.alert('Plan unavailable', 'This plan does not have active pricing from the server yet. Please go back and choose another plan.');
      return;
    }
    router.push({
      pathname: '/order',
      params: {
        planId: planId || '',
        planName: planName || 'Standard Plan',
        gymId: gymId || '',
        gymName: gymName || '',
        durationMonths: String(dur.months),
        totalAmount: String(total),
        ptAddon: ptAddon && !dur.isDayPass ? 'true' : 'false',
        ptDurationMonths: String(ptAddon && !dur.isDayPass ? ptDurationMonths : 0),
        ptTrainerId: ptAddon && !dur.isDayPass ? selectedTrainerId : '',
        ptTrainerName: ptAddon && !dur.isDayPass ? (selectedTrainer?.name || '') : '',
        ptMonthlyPrice: ptAddon && !dur.isDayPass ? String(ptMonthlyPrice) : '',
        ptTotal: ptAddon && !dur.isDayPass ? String(ptCost) : '',
        isDayPass: dur.isDayPass ? 'true' : 'false',
        gymPlanId: dur.gymPlanId || '',
      },
    });
  };

  return (
    <AuroraBackground>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <IconArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Choose Duration</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 204 + bottomInset }]}>
          <Text style={s.kicker}>Membership Duration</Text>

          {DURATIONS.length === 0 && (
            <View style={s.ptCard}>
              <Text style={s.ptTitle}>No active pricing found</Text>
              <Text style={s.ptSub}>This plan cannot be purchased until pricing is configured in the backend.</Text>
            </View>
          )}

          {DURATIONS.map((d, i) => {
            const active = i === selected;
            return (
              <TouchableOpacity
                key={d.isDayPass ? 'daypass' : d.gymPlanId || d.months}
                style={[s.optionCard, active && s.optionCardActive, d.hot && s.optionCardHot]}
                onPress={() => setSelected(i)}
                activeOpacity={0.8}
              >
                {d.hot && (
                  <View style={s.hotBadge}>
                    <Text style={s.hotBadgeText}>HOT</Text>
                  </View>
                )}

                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>

                <View style={s.optionInfo}>
                  <View style={s.optionLabelRow}>
                    <Text style={[s.optionLabel, active && { color: '#fff' }]} numberOfLines={1}>{d.label}</Text>
                    {d.sublabel && !d.hot && <Text style={s.optionSublabel} numberOfLines={1}>{d.sublabel}</Text>}
                  </View>
                  <Text style={[s.optionPrice, active && { color: d.hot ? '#ff6b35' : colors.accent }]} numberOfLines={1}>
                    {money(d.price)}
                    <Text style={s.optionPricePer}>{d.isDayPass ? '/day' : ' total'}</Text>
                  </Text>
                  {!d.isDayPass && (
                    <Text style={s.billingHint} numberOfLines={1}>
                      {money(Math.round(d.price / d.months))}/mo billed every {monthsLabel(d.months)}
                    </Text>
                  )}
                </View>

                {d.save && (
                  <View style={s.savePill}>
                    <Text style={s.savePillText}>{d.save}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {!dur.isDayPass && (
            <View style={s.ptCard}>
              <View style={s.ptHeaderRow}>
                <View style={s.ptLeft}>
                  <Text style={s.ptTitle}>Personal Trainer Add-on</Text>
                  <Text style={s.ptSub} numberOfLines={2}>
                    {trainersLoading
                      ? 'Loading trainers from this gym'
                      : selectedTrainer
                        ? `${selectedTrainer.name} | ${monthsLabel(ptDurationMonths)} PT`
                        : 'Choose a gym trainer for monthly PT pricing'}
                  </Text>
                </View>
                <View style={s.ptRight}>
                  <Text style={s.ptPrice}>{trainersLoading ? 'Loading' : trainers.length ? `${money(ptMonthlyPrice)}/mo` : 'No trainers'}</Text>
                  <Switch
                    value={ptAddon}
                    onValueChange={(value) => {
                      if (value && trainers.length === 0) {
                        Alert.alert('No trainers available', 'This gym has not added monthly trainer pricing yet.');
                        return;
                      }
                      setPtAddon(value);
                    }}
                    disabled={trainersLoading || trainers.length === 0}
                    trackColor={{ false: colors.border, true: colors.accentBorder }}
                    thumbColor={ptAddon ? colors.accent : 'rgba(255,255,255,0.4)'}
                  />
                </View>
              </View>

              {ptAddon && (
                <View style={s.ptDurationBlock}>
                  <Text style={s.ptDurationLabel}>Choose trainer</Text>
                  <View style={s.trainerPicker}>
                    {trainers.map((trainer) => {
                      const trainerId = String(trainer.id || trainer._id || '');
                      const active = trainerId === selectedTrainerId;
                      const price = Number(trainer.monthlyPriceInr ?? trainer.monthlyPrice ?? trainer.sessionRateInr ?? trainer.pricePerSession ?? 0);
                      return (
                        <TouchableOpacity
                          key={trainerId}
                          style={[s.trainerOption, active && s.trainerOptionActive]}
                          onPress={() => setSelectedTrainerId(trainerId)}
                          activeOpacity={0.82}
                        >
                          <Text style={[s.trainerOptionName, active && { color: '#fff' }]} numberOfLines={1}>
                            {trainer.name || 'Trainer'}
                          </Text>
                          <Text style={[s.trainerOptionPrice, active && { color: colors.accent }]} numberOfLines={1}>
                            {money(price)}/mo
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={s.ptDurationLabel}>Trainer duration within {monthsLabel(dur.months)} plan</Text>
                  <View style={s.ptDurationChips}>
                    {availablePtDurations.map((months) => {
                      const active = ptDurationMonths === months;
                      return (
                        <TouchableOpacity
                          key={months}
                          style={[s.ptDurationChip, active && s.ptDurationChipActive]}
                          onPress={() => setPtDurationMonths(months)}
                          activeOpacity={0.82}
                        >
                          <Text style={[s.ptDurationChipText, active && s.ptDurationChipTextActive]}>
                            {months} Mo
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={s.scrollEndSpacer} />
        </ScrollView>

        <View style={[s.footer, { paddingBottom: bottomInset + 14 }]}>
          <View style={s.breakdown}>
            <View style={s.breakRow}>
              <Text style={s.breakLabel} numberOfLines={1}>{dur.label}</Text>
              <Text style={s.breakVal}>{money(base)}</Text>
            </View>
            {ptAddon && !dur.isDayPass && (
              <View style={s.breakRow}>
                <Text style={s.breakLabel} numberOfLines={1}>PT Add-on ({selectedTrainer?.name || ptDurationMonths + ' mo'})</Text>
                <Text style={s.breakVal}>{money(ptCost)}</Text>
              </View>
            )}
            <View style={[s.breakRow, s.totalRow]}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalVal}>{money(total)}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.btnPrimary} onPress={handleCheckout}>
            <Text style={s.btnPrimaryText}>
              {dur.isDayPass ? 'Buy Day Pass' : 'Proceed to Checkout'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  back: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.borderGlass, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.serif, fontSize: 20, color: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  scrollEndSpacer: { height: 8 },
  kicker: {
    fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
    color: colors.accent, fontFamily: fonts.sansBold, marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: radius.xl, padding: 14, marginBottom: 12, overflow: 'hidden',
  },
  optionCardActive: {
    borderColor: colors.accent, backgroundColor: 'rgba(0,212,106,0.06)',
  },
  optionCardHot: {
    borderColor: 'rgba(255,107,53,0.6)', backgroundColor: 'rgba(255,107,53,0.08)',
  },
  hotBadge: {
    position: 'absolute', top: 10, right: 12,
    backgroundColor: 'rgba(255,107,53,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.5)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  hotBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#ff6b35' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  optionInfo: { flex: 1, minWidth: 0 },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  optionLabel: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: colors.t },
  optionSublabel: { flexShrink: 1, fontFamily: fonts.sans, fontSize: 10, color: colors.t3 },
  optionPrice: { fontFamily: fonts.sansBold, fontSize: 18, color: '#fff' },
  optionPricePer: { fontFamily: fonts.sans, fontSize: 11, color: colors.t2 },
  billingHint: { marginTop: 2, fontFamily: fonts.sans, fontSize: 10, color: colors.t3 },
  savePill: {
    flexShrink: 0,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4,
  },
  savePillText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accent },
  ptCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: radius.xl, padding: 16, marginTop: 8,
  },
  ptHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ptLeft: { flex: 1, minWidth: 0 },
  ptTitle: { fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff', marginBottom: 3 },
  ptSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.t2, lineHeight: 17 },
  ptRight: { alignItems: 'flex-end', gap: 6 },
  ptPrice: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent },
  ptDurationBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  ptDurationLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.t2, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 1 },
  trainerPicker: { gap: 8, marginBottom: 14 },
  trainerOption: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  trainerOptionActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  trainerOptionName: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.t, marginBottom: 3 },
  trainerOptionPrice: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t2 },
  ptDurationChips: { flexDirection: 'row', gap: 8 },
  ptDurationChip: {
    flex: 1,
    minWidth: 0,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ptDurationChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  ptDurationChipText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.t2 },
  ptDurationChipTextActive: { color: colors.accent },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(6,6,6,0.96)',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 20, paddingTop: 12,
  },
  breakdown: { marginBottom: 10 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 },
  breakLabel: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: 12, color: colors.t2 },
  breakVal: { flexShrink: 0, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.t, textAlign: 'right' },
  totalRow: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.09)', paddingTop: 8, marginTop: 3 },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: '#fff' },
  totalVal: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.accent },
  btnPrimary: {
    height: 52, borderRadius: 30, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#060606' },
});
