export { createDefaultPricingOption } from "./paymentEditor";
export type { PricingOptionFormItem } from "./paymentEditor";
import type { PricingOptionFormItem } from "./paymentEditor";

const INTERVAL_DAYS: Record<string, number> = {
  "7d": 7,
  "14d": 14,
  "1m": 30,
  "3m": 90,
  "1y": 365,
};

const INTERVAL_BILLING: Record<string, string> = {
  "1m": "month",
  "3m": "quarter",
  "1y": "year",
};

/** Days of access a recurring option grants per period; null for one-time. */
export function accessDaysFor(opt: PricingOptionFormItem): number | null {
  if (opt.paymentType !== "recurring") return null;
  if (opt.recurringInterval === "custom") return opt.recurringCustomDays || 30;
  return INTERVAL_DAYS[opt.recurringInterval] ?? null;
}

/** Billing period label for a recurring option; null for one-time. */
export function billingPeriodFor(opt: PricingOptionFormItem): string | null {
  if (opt.paymentType !== "recurring") return null;
  return INTERVAL_BILLING[opt.recurringInterval] ?? opt.recurringInterval;
}

/** Length of the free trial in days; null when the option has no trial. */
export function trialDaysFor(opt: PricingOptionFormItem): number | null {
  if (!opt.hasFreeTrial) return null;
  if (opt.trialPreset === "custom") return opt.trialCustomDays || 7;
  return Number(opt.trialPreset) || null;
}
