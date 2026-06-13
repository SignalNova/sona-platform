import { NextResponse } from 'next/server'
import { generateSecurityAudit } from '@/lib/security'
import { generateDBSecurityAudit } from '@/lib/security-monitor'
import { requireAdmin } from '@/lib/auth'

// GET: Full security audit report (combines in-memory and database data)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    // Get both in-memory and database audit reports
    const memoryAudit = generateSecurityAudit()
    const dbAudit = await generateDBSecurityAudit()

    return NextResponse.json({
      ...dbAudit,
      memoryAudit, // Include legacy in-memory data for comparison
    })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
