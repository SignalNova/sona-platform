/**
 * Next.js Instrumentation - Runs once on server startup
 * Ensures the admin account exists and is properly configured
 * Starts self-ping to prevent Render from sleeping
 */

const SELF_PING_INTERVAL_MS = 14 * 60 * 1000 // 14 minutes (Render sleeps after 15 min)

function startSelfPing() {
  // NEXT_PUBLIC_APP_URL is set in .env/render.yaml
  // RENDER_EXTERNAL_URL is auto-set by Render (e.g. https://sona-platform.onrender.com)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL
  if (!appUrl) {
    console.warn('[SELF-PING] No APP_URL found, self-ping disabled')
    return
  }

  // Use /api/ping (ultra-light, returns "pong") instead of /api/health (JSON)
  const pingUrl = `${appUrl.replace(/\/$/, '')}/api/ping`
  console.log(`[SELF-PING] Starting self-ping to ${pingUrl} every 14 minutes`)

  const doPing = async () => {
    try {
      // Use HEAD request - lightest possible (no response body)
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'SONA-SelfPing/1.0' },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
      if (response.ok) {
        console.log(`[SELF-PING] ✓ Keep-alive ping successful at ${new Date().toISOString()}`)
      } else {
        console.warn(`[SELF-PING] ✗ Ping returned status ${response.status}`)
      }
    } catch (error) {
      console.warn('[SELF-PING] ✗ Ping failed:', error instanceof Error ? error.message : String(error))
    }
  }

  // Initial ping after 60 seconds (give server time to fully start)
  setTimeout(() => {
    doPing()
    // Then ping every 14 minutes
    setInterval(doPing, SELF_PING_INTERVAL_MS)
  }, 60000)
}

export async function register() {
  // Only run on the server (not on edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[STARTUP] SONA Platform initializing...')

    try {
      const { ensureAdminAccount } = await import('@/lib/startup')
      await ensureAdminAccount()
    } catch (error) {
      console.error('[STARTUP] Failed to ensure admin account:', error)
    }

    // Start self-ping to prevent Render from sleeping
    startSelfPing()

    console.log('[STARTUP] SONA Platform initialized successfully')
  }
}
