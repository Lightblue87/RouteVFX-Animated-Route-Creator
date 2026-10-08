import { de } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
export type MessageKey = keyof typeof de;
export type Dict = Record<MessageKey, string>;

const DICTS: Record<Locale, Dict> = { de, en };

export function detectLocale(): Locale {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'de').toLowerCase();
  return lang.startsWith('de') ? 'de' : 'en';
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  let s: string = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function formatKm(locale: Locale, meters: number): string {
  const km = meters / 1000;
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: km < 100 ? 1 : 0 }).format(km) + ' km';
}
