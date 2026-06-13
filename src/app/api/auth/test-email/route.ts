import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Diagnostic endpoint for testing email relay from within the Render environment
// This helps debug why verification emails are not being delivered
export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
  }

  // 0. Check database connection
  try {
    const dbStart = Date.now()
    await db.$queryRaw`SELECT 1`
    const dbTime = Date.now() - dbStart
    results.dbCheck = { status: 'ok', timeMs: dbTime }
  } catch (dbError: any) {
    results.dbCheck = { 
      status: 'error', 
      error: dbError.message,
      code: dbError.code,
      meta: dbError.meta,
    }
  }

  // 1. Check environment variables
  results.envCheck = {
    DATABASE_URL: process.env.DATABASE_URL ? `SET (${process.env.DATABASE_URL.substring(0, 30)}...)` : 'NOT SET',
    EMAIL_RELAY_URL: process.env.EMAIL_RELAY_URL || 'NOT SET',
    EMAIL_RELAY_KEY: process.env.EMAIL_RELAY_KEY ? `SET (${process.env.EMAIL_RELAY_KEY.substring(0, 6)}...)` : 'NOT SET (will use default)',
    SMTP_USER: process.env.SMTP_USER ? 'SET' : 'NOT SET',
    SMTP_PASS: process.env.SMTP_PASS ? 'SET' : 'NOT SET',
    RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'NOT SET',
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? 'SET' : 'NOT SET',
  }

  // 2. Test Gist discovery
  const RELAY_DISCOVERY_URL = 'https://gist.githubusercontent.com/SignalNova/c4c89af78e5f073912160edcea45a61b/raw/relay-config.json'
  try {
    const gistStart = Date.now()
    const gistResponse = await fetch(RELAY_DISCOVERY_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Cache-Control': 'no-cache' },
    })
    const gistTime = Date.now() - gistStart
    if (gistResponse.ok) {
      const gistConfig = await gistResponse.json()
      results.gistDiscovery = {
        success: true,
        timeMs: gistTime,
        relayUrl: gistConfig.relayUrl,
        relayKey: gistConfig.relayKey ? gistConfig.relayKey.substring(0, 6) + '...' : 'N/A',
        status: gistConfig.status,
        updatedAt: gistConfig.updatedAt,
      }
    } else {
      results.gistDiscovery = { success: false, status: gistResponse.status, timeMs: gistTime }
    }
  } catch (error: any) {
    results.gistDiscovery = { success: false, error: error.message }
  }

  // 3. Determine the relay URL to use
  const relayUrl = results.gistDiscovery?.relayUrl || process.env.EMAIL_RELAY_URL || ''
  const relayKey = process.env.EMAIL_RELAY_KEY || ''

  results.relayConfig = {
    effectiveUrl: relayUrl || 'NO URL AVAILABLE',
    effectiveKey: relayKey.substring(0, 6) + '...',
  }

  // 4. Test relay health
  if (relayUrl) {
    try {
      const healthStart = Date.now()
      const healthResponse = await fetch(`${relayUrl}/health`, {
        signal: AbortSignal.timeout(10000),
      })
      const healthTime = Date.now() - healthStart
      if (healthResponse.ok) {
        results.relayHealth = {
          ...(await healthResponse.json()),
          timeMs: healthTime,
        }
      } else {
        results.relayHealth = { reachable: false, status: healthResponse.status, timeMs: healthTime }
      }
    } catch (error: any) {
      results.relayHealth = { reachable: false, error: error.message }
    }
  } else {
    results.relayHealth = { error: 'No relay URL to test' }
  }

  // 5. Optionally test sending an email (only if ?send=true)
  if (request.nextUrl.searchParams.get('send') === 'true' && relayUrl) {
    try {
      const sendStart = Date.now()
      const sendResponse = await fetch(`${relayUrl}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Key': relayKey,
        },
        body: JSON.stringify({
          to: 'helpsona.support@gmail.com',
          subject: `[DIAG] Email Relay Test from ${process.env.NODE_ENV || 'unknown'}`,
          text: `This diagnostic email was sent at ${new Date().toISOString()} from the SONA Platform app running on ${process.env.NODE_ENV || 'unknown'} environment.`,
          html: `<p>This diagnostic email was sent at <strong>${new Date().toISOString()}</strong> from the SONA Platform app running on <strong>${process.env.NODE_ENV || 'unknown'}</strong> environment.</p>`,
        }),
        signal: AbortSignal.timeout(15000),
      })
      const sendTime = Date.now() - sendStart
      const sendResult = await sendResponse.json()
      results.relaySendTest = {
        status: sendResponse.status,
        timeMs: sendTime,
        result: sendResult,
      }
    } catch (error: any) {
      results.relaySendTest = { error: error.message }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
