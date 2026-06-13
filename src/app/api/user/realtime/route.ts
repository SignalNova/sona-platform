import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      const userData = await db.user.findUnique({
        where: { id: user.id },
        select: { balance: true, withdrawableBalance: true, lockedCapital: true, totalProfit: true, nonWithdrawableProfit: true }
      })

      if (userData) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'balance_update', ...userData })}\n\n`))
      }

      // Poll for changes every 3 seconds
      let lastBalance = userData?.balance || 0
      let lastWithdrawable = userData?.withdrawableBalance || 0

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval)
          return
        }

        try {
          const current = await db.user.findUnique({
            where: { id: user.id },
            select: { balance: true, withdrawableBalance: true, lockedCapital: true, totalProfit: true, nonWithdrawableProfit: true }
          })

          if (current && (current.balance !== lastBalance || current.withdrawableBalance !== lastWithdrawable)) {
            lastBalance = current.balance
            lastWithdrawable = current.withdrawableBalance
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'balance_update', ...current })}\n\n`))
          }

          // Send heartbeat
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`))
        } catch (e) {
          // DB error, skip
        }
      }, 3000)

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
