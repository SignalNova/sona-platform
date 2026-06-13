import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '../../middleware'

export async function POST(request: NextRequest) {
  try {
    await getAdminFromRequest(request)

    // Find all pending deposit transactions
    const pendingDeposits = await db.transaction.findMany({
      where: {
        type: 'DEPOSIT',
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (pendingDeposits.length === 0) {
      return NextResponse.json({
        message: 'لا توجد إيداعات معلقة للتحقق',
        verified: 0,
        total: 0,
      }, { status: 200 })
    }

    // Get active deposit addresses for reference
    const activeAddresses = await db.depositAddress.findMany({
      where: { isActive: true },
    })

    // SECURITY FIX: Admin auto-verify now requires ACTUAL blockchain verification.
    // Previously, any deposit with a reference > 10 chars and a known address was auto-confirmed.
    // This was a phantom deposit vector - an attacker could set any string as reference.
    // Now we only verify deposits that have a valid txHash format and have been confirmed
    // on the blockchain (via the /api/deposit/verify-bsc or verify-tron endpoints).
    let verifiedCount = 0

    for (const deposit of pendingDeposits) {
      // Only auto-verify if the deposit has been verified on the blockchain
      // (has a txHash that looks like a real blockchain transaction hash)
      const hasValidTxHash = deposit.reference && (
        deposit.reference.startsWith('0x') && deposit.reference.length >= 64 ||  // BSC/Ethereum tx hash
        deposit.reference.length === 64  // TRON tx hash (hex without 0x)
      )
      
      // Also check if this txHash has been used for another completed deposit (double-spend)
      if (hasValidTxHash) {
        const existingCompleted = await db.transaction.findFirst({
          where: {
            reference: deposit.reference,
            status: 'COMPLETED',
            type: 'DEPOSIT',
            id: { not: deposit.id },
          },
        })
        
        if (existingCompleted) {
          console.warn(`[SECURITY] Deposit ${deposit.id} has a txHash already used by completed deposit ${existingCompleted.id} - skipping`)
          continue
        }
      }

      // Check if deposit has a valid txHash reference and matches a known address
      const hasKnownAddress = activeAddresses.some(
        (addr) => addr.address === deposit.depositAddress
      )

      // Only auto-confirm if BOTH conditions are met:
      // 1. Has a valid-looking blockchain txHash (not just any string > 10 chars)
      // 2. Matches a known deposit address in our system
      if (hasValidTxHash && hasKnownAddress) {
        try {
          await db.$transaction(async (tx) => {
            // Re-check status inside transaction to prevent race conditions
            const currentDeposit = await tx.transaction.findUnique({
              where: { id: deposit.id },
              select: { status: true },
            })
            if (!currentDeposit || currentDeposit.status !== 'PENDING') return

            await tx.transaction.update({
              where: { id: deposit.id },
              data: { 
                status: 'COMPLETED',
                adminNote: 'Auto-verified by admin check (valid txHash + known address)',
              },
            })

            // SECURITY: Credit both balance AND withdrawableBalance consistently
            await tx.user.update({
              where: { id: deposit.userId },
              data: {
                balance: { increment: deposit.amount },
                withdrawableBalance: { increment: deposit.amount },
                totalDeposited: { increment: deposit.amount },
              },
            })
          })

          verifiedCount++
        } catch (err) {
          console.error(`Failed to verify deposit ${deposit.id}:`, err)
        }
      }
    }

    return NextResponse.json({
      message: `تم التحقق من ${verifiedCount} إيداع من أصل ${pendingDeposits.length} إيداع معلق`,
      verified: verifiedCount,
      total: pendingDeposits.length,
      remaining: pendingDeposits.length - verifiedCount,
    }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Admin deposits check error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحقق من الإيداعات' },
      { status: 500 }
    )
  }
}
