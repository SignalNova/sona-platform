import { NextRequest, NextResponse } from 'next/server'
import { getIntrusionLog, getBlockedIPs, unblockIP, blockIP } from '@/lib/security'
import { requireAdmin } from '@/lib/auth'
import { getBlockedIPsFromDB, blockIPInDB, unblockIPInDB, logSecurityEvent } from '@/lib/security-monitor'
import prisma from '@/lib/prisma'

// GET: Get intrusion events and blocked IPs (from both memory and database)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    // Get in-memory events (legacy)
    const memoryEvents = getIntrusionLog(50)
    const memoryBlocked = getBlockedIPs()

    // Get database-backed events and blocks
    const dbBlocked = await getBlockedIPsFromDB()
    const recentDbEvents = await prisma.securityLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      events: memoryEvents,
      dbEvents: recentDbEvents,
      blockedIPs: [...memoryBlocked, ...dbBlocked],
      totalEvents: memoryEvents.length + recentDbEvents.length,
      totalBlocked: memoryBlocked.length + dbBlocked.length,
    })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// DELETE: Unblock an IP (both in memory and database)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const { ip } = await request.json()
    if (!ip) return NextResponse.json({ error: 'عنوان IP مطلوب' }, { status: 400 })

    // Unblock from both in-memory and database
    unblockIP(ip)
    await unblockIPInDB(ip)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: Block an IP (both in memory and database)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const { ip, reason, duration } = await request.json()
    if (!ip) return NextResponse.json({ error: 'عنوان IP مطلوب' }, { status: 400 })

    // Block from both in-memory and database
    blockIP(ip, reason || 'حظر يدوي من الإدارة', duration || 60 * 60 * 1000)
    await blockIPInDB(ip, reason || 'حظر يدوي من الإدارة', false, duration || 60 * 60 * 1000)
    return NextResponse.json({ success: true, ip })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
