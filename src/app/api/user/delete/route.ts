import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, getAuthUser } from '@/lib/auth'
import { KYCVault } from '@/lib/kyc-vault'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Use getAuthUser() which checks both Bearer token and cookie auth
    // Previously only used getUser() (cookie-only) - inconsistent with other routes
    const user = await getAuthUser(req) || await getUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 400 })
    }

    const userId = user.id // SECURITY: Always use authenticated user's ID, never from body

    // Prevent admin from deleting their account
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'لا يمكن حذف حساب المدير' }, { status: 403 })
    }

    // Verify password
    const dbUser = await db.user.findUnique({ where: { id: userId } })
    if (!dbUser) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

    const isValid = await bcrypt.compare(password, dbUser.password)
    if (!isValid) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 400 })
    }

    // Clean up KYC vault documents before deleting user records
    try {
      const kycDocuments = await KYCVault.listDocuments(userId)
      for (const doc of kycDocuments) {
        await KYCVault.deleteDocument(userId, doc.docId)
      }
    } catch (kycErr) {
      console.error('[USER DELETE] KYC vault cleanup error:', kycErr)
      // Continue with deletion even if KYC cleanup fails
    }

    // Delete user and all related data
    // Using transaction to ensure consistency
    await db.$transaction([
      db.notification.deleteMany({ where: { userId } }),
      db.chatMessage.deleteMany({
        where: {
          conversation: { userId }
        }
      }),
      db.chatConversation.deleteMany({ where: { userId } }),
      db.supportMessage.deleteMany({
        where: {
          ticket: { userId }
        }
      }),
      db.supportTicket.deleteMany({ where: { userId } }),
      db.referral.deleteMany({ where: { referrerId: userId } }),
      db.referral.deleteMany({ where: { referredId: userId } }),
      db.investment.deleteMany({ where: { userId } }),
      db.transaction.deleteMany({ where: { userId } }),
      db.user.delete({ where: { id: userId } }),
    ])

    return NextResponse.json({ message: 'تم حذف الحساب بنجاح' }, { status: 200 })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الحساب' }, { status: 500 })
  }
}
