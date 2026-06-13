import { db } from '@/lib/db'

export async function GET() {
  const start = Date.now()
  try {
    // Quick DB connectivity check
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    return Response.json({
      status: 'healthy',
      database: 'connected',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
