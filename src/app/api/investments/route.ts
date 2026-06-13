import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getUser, getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const investments = await prisma.investment.findMany({
      where: { userId: user.id },
      include: { package: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ investments })
  } catch (error) {
    console.error('Investments error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { packageId, amount, mode: requestedMode } = await req.json()
    if (!packageId || !amount) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    // Forward the auth cookie to the invest endpoint for proper authentication
    const authHeader = req.headers.get('authorization')
    const cookieHeader = req.headers.get('cookie') || ''
    
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'cookie': cookieHeader,
    }
    if (authHeader) {
      headers['authorization'] = authHeader
    }

    const investRes = await fetch(new URL('/api/invest', req.url), {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: user.id, packageId, amount, mode: requestedMode || 'SONA' }),
    })
    const data = await investRes.json()
    return NextResponse.json(data, { status: investRes.status })
  } catch (error: any) {
    console.error('Investment error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
