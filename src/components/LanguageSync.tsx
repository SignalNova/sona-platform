'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * This component syncs the Zustand store's lang state
 * with document.documentElement.dir, document.documentElement.lang,
 * and the font family on body.
 * Must be rendered once at the app root level.
 */
export default function LanguageSync() {
  const lang = useAppStore((s) => s.lang);

  useEffect(() => {
    const isRTL = lang === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    // Add direction CSS class for CSS-based direction changes
    document.documentElement.classList.remove('dir-ltr', 'dir-rtl');
    document.documentElement.classList.add(isRTL ? 'dir-rtl' : 'dir-ltr');
    document.body.style.fontFamily = isRTL
      ? "'Cairo', sans-serif"
      : "system-ui, -apple-system, sans-serif";
  }, [lang]);

  return null;
}
