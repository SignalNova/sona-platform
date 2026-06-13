// Next.js instrumentation - runs once on server startup
export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[SONA] Server starting - setting up auto-automation...')
    
    // Run auto-cron every 5 minutes
    const AUTO_CRON_INTERVAL = 5 * 60 * 1000 // 5 minutes
    
    const runAutoCron = async () => {
      try {
        const cronSecret = process.env.CRON_SECRET
        const headers: Record<string, string> = { 'x-internal': 'true' }
        if (cronSecret) {
          headers['Authorization'] = `Bearer ${cronSecret}`
        }
        
        const port = process.env.PORT || 3000
        const res = await fetch(`http://localhost:${port}/api/cron/auto`, { headers })
        if (res.ok) {
          const data = await res.json()
          console.log(`[AUTO-CRON] Executed:`, JSON.stringify(data.results))
        } else {
          console.error(`[AUTO-CRON] Failed with status: ${res.status}`)
        }
      } catch (err) {
        console.error('[AUTO-CRON] Error:', err)
      }
    }

    setTimeout(() => {
      runAutoCron()
      setInterval(runAutoCron, AUTO_CRON_INTERVAL)
      console.log(`[SONA] Auto-automation running every ${AUTO_CRON_INTERVAL / 60000} minutes`)
    }, 30000)
  }
}
