import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════
// KEEP-ALIVE ENDPOINT
// Called by self-ping mechanism and external uptime monitors.
// Uses the shared db singleton (no connection pool leak).
// MUST be public (no auth) - added to PUBLIC_PATTERNS in middleware
// ═══════════════════════════════════════════════════════════

let prismaWarmedUp = false
let lastWarmupTime = 0
const WARMUP_INTERVAL = 10 * 60 * 1000 // Re-warmup every 10 minutes

async function warmupPrisma() {
  const now = Date.now()
  if (prismaWarmedUp && (now - lastWarmupTime) < WARMUP_INTERVAL) {
    return // Already warmed up recently
  }

  try {
    // Use the shared db singleton instead of creating a new PrismaClient
    await db.$queryRaw`SELECT 1`
    prismaWarmedUp = true
    lastWarmupTime = now
  } catch {
    // Non-critical - the next real request will establish the connection
  }
}

export async function GET() {
  // Warmup Prisma in the background (don't await to keep response fast)
  warmupPrisma()

  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'SONA Platform',
    uptime: Math.floor(process.uptime()),
    prismaWarmedUp,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}

// HEAD request - ultra light, no body
export async function HEAD() {
  // Still warmup in background
  warmupPrisma()

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
