export type CommissionMode = 'percent' | 'fixed';
export type ServiceCommissionKey = 'day_pass' | 'same_gym' | 'multi_gym' | 'wellness' | 'personal_training';

export type CommissionConfig = {
  mode: CommissionMode;
  value: number;
  useGlobal?: boolean;
};

export const PLATFORM_PRICING_CONFIG_KEY = 'multigym_plans';

export const DEFAULT_PLATFORM_PRICING_CONFIG: any = {
  globalCommission: { mode: 'percent', value: 0 },
  day_pass: {
    basePrice: 149,
    commission: { useGlobal: true, mode: 'percent', value: 0 },
  },
  same_gym: {
    commission: { useGlobal: true, mode: 'percent', value: 0 },
  },
  multi_gym: {
    name: 'Multi Gym Pass',
    subtitle: 'Unlimited access to every partner gym',
    basePrice: 1499,
    gymLimit: null,
    features: ['Unlimited gyms, unlimited visits', 'QR Check-in', 'Priority support', 'All gym tiers', 'PT session add-on eligible'],
    commission: { useGlobal: true, mode: 'percent', value: 0 },
  },
  wellness: {
    commission: { useGlobal: true, mode: 'percent', value: 0 },
  },
  personal_training: {
    commission: { useGlobal: true, mode: 'percent', value: 0 },
  },
};

export function normalizeBaseCommission(value: any): CommissionConfig {
  const mode: CommissionMode = value?.mode === 'fixed' ? 'fixed' : 'percent';
  const rawValue = Number(value?.value);
  return { mode, value: Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0 };
}

export function normalizeServiceCommission(value: any, global: CommissionConfig): CommissionConfig {
  const base = normalizeBaseCommission(value);
  const hasExplicitUseGlobal = typeof value?.useGlobal === 'boolean';
  const useGlobal = hasExplicitUseGlobal ? value.useGlobal !== false : base.value <= 0;
  return {
    useGlobal,
    mode: useGlobal ? global.mode : base.mode,
    value: useGlobal ? global.value : base.value,
  };
}

export function effectiveCommission(setting: any, global: CommissionConfig): CommissionConfig {
  const normalized = normalizeServiceCommission(setting, global);
  return normalized.useGlobal
    ? { mode: global.mode, value: global.value }
    : { mode: normalized.mode, value: normalized.value };
}

export function normalizePlatformPricingConfig(value: any) {
  const defaults = DEFAULT_PLATFORM_PRICING_CONFIG;
  const globalCommission = normalizeBaseCommission(value?.globalCommission || defaults.globalCommission);
  const normalized: any = {
    globalCommission,
    day_pass: {
      ...defaults.day_pass,
      ...(value?.day_pass || {}),
      commission: normalizeServiceCommission(value?.day_pass?.commission, globalCommission),
    },
    same_gym: {
      ...defaults.same_gym,
      ...(value?.same_gym || {}),
      commission: normalizeServiceCommission(value?.same_gym?.commission, globalCommission),
    },
    multi_gym: {
      ...defaults.multi_gym,
      ...(value?.multi_gym || {}),
      commission: normalizeServiceCommission(value?.multi_gym?.commission, globalCommission),
    },
    wellness: {
      ...defaults.wellness,
      ...(value?.wellness || {}),
      commission: normalizeServiceCommission(value?.wellness?.commission, globalCommission),
    },
    personal_training: {
      ...defaults.personal_training,
      ...(value?.personal_training || {}),
      commission: normalizeServiceCommission(value?.personal_training?.commission, globalCommission),
    },
  };

  normalized.day_pass.basePrice = Math.max(1, Math.round(Number(normalized.day_pass.basePrice) || defaults.day_pass.basePrice));
  normalized.multi_gym.basePrice = Math.max(1, Math.round(Number(normalized.multi_gym.basePrice) || defaults.multi_gym.basePrice));
  return normalized;
}

export function platformPricingResponse(config: any) {
  const normalized = normalizePlatformPricingConfig(config);
  const response: any = { ...normalized };
  (['day_pass', 'same_gym', 'multi_gym', 'wellness', 'personal_training'] as ServiceCommissionKey[]).forEach((key) => {
    const setting = normalized[key]?.commission;
    response[key] = {
      ...normalized[key],
      commissionSetting: setting,
      commission: effectiveCommission(setting, normalized.globalCommission),
    };
  });
  return response;
}

export function serviceCommission(config: any, key: ServiceCommissionKey): CommissionConfig {
  const normalized = normalizePlatformPricingConfig(config);
  return effectiveCommission(normalized[key]?.commission, normalized.globalCommission);
}

export function commissionAmount(baseAmount: number, commission: CommissionConfig | null | undefined) {
  const base = Number(baseAmount);
  const value = Math.max(0, Number(commission?.value) || 0);
  if (!Number.isFinite(base) || base <= 0 || value <= 0) return 0;
  return commission?.mode === 'fixed' ? value : base * (value / 100);
}

export function applyCheckoutCommission(baseAmount: number, commission: CommissionConfig | null | undefined) {
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.max(1, Math.round(base + commissionAmount(base, commission)));
}
