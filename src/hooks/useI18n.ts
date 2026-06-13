'use client';

import { useCallback, useEffect } from 'react';
import { useAppStore, type Lang } from '@/lib/store';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

type TranslationMap = typeof ar;

const translations: Record<Lang, TranslationMap> = { ar, en };

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) || path;
}

export function useI18n() {
  // Single source of truth: Zustand store
  const { lang, setLang, toggleLang } = useAppStore();

  // Sync document direction and language with current lang
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isRTL = lang === 'ar';
      document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = getNestedValue(translations[lang], key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return value;
  }, [lang]);

  const isRTL = lang === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const fontFamily = isRTL ? "'Cairo', sans-serif" : "system-ui, -apple-system, sans-serif";

  return { t, lang, setLang, toggleLang, isRTL, dir, fontFamily };
}
