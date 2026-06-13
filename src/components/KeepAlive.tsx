'use client';

import { useEffect, useRef } from 'react';

/**
 * KeepAlive - Prevents Render free tier from sleeping
 *
 * Strategy:
 * 1. Pings /api/keep-alive every 14 minutes (Render sleeps after 15 min)
 * 2. Uses /api/keep-alive instead of /api/health (also warms up Prisma)
 * 3. Pings immediately on tab visibility change (user returns)
 * 4. Pings on page focus (in case tab was inactive for too long)
 * 5. Falls back to /api/ping if keep-alive fails
 *
 * Combined with:
 * - Server-side self-ping (instrumentation.ts) every 14 min
 * - External UptimeRobot ping (recommended) every 5 min
 */
export default function KeepAlive() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
    const KEEP_ALIVE_URL = '/api/keep-alive';
    const FALLBACK_URL = '/api/ping';

    const ping = async () => {
      try {
        // Use keep-alive endpoint (also warms up Prisma for faster response)
        const res = await fetch(KEEP_ALIVE_URL, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) {
          // Fallback to ultra-light ping
          await fetch(FALLBACK_URL, {
            method: 'HEAD',
            cache: 'no-store',
          });
        }
      } catch {
        // Silent fail - ping is best effort
        try {
          await fetch(FALLBACK_URL, { method: 'HEAD', cache: 'no-store' });
        } catch {
          // Truly best effort
        }
      }
    };

    // Initial ping immediately
    ping();

    // Set up interval for regular pings
    intervalRef.current = setInterval(ping, PING_INTERVAL);

    // Ping when tab becomes visible again (user returns to the tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Ping when window gains focus (extra safety)
    const handleFocus = () => {
      ping();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return null;
}
