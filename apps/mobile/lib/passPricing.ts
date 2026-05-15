export type PassCommissionConfig = {
  mode?: 'percent' | 'fixed' | string;
  value?: number | string | null;
} | null | undefined;

export function positiveNumber(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function applyPassCommission(baseAmount: number | null | undefined, commission: PassCommissionConfig) {
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base <= 0) return null;

  const value = Number(commission?.value || 0);
  if (!Number.isFinite(value) || value <= 0) return Math.round(base);

  const addition = commission?.mode === 'fixed' ? value : base * (value / 100);
  return Math.max(1, Math.round(base + addition));
}
