import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

// Safety cap: Maximum daily return percentage
const MAX_DAILY_RETURN_PERCENT = 20

/**
 * GET /api/cron/auto
 * Auto-triggered cron endpoint - called by instrumentation.ts every 5 minutes
 * Uses CRON_SECRET for authentication instead of admin auth
 * Runs lightweight checks and daily tasks when appropriate
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const xInternal = request.headers.get('x-internal')
    // SECURITY: CRON_SECRET is MANDATORY - no fallback allowed
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[FATAL SECURITY] CRON_SECRET is not set!')
      return NextResponse.json({ error: 'إعدادات الأمان غير مكتملة' }, { status: 500 })
    }

    // SECURITY: Only accept CRON_SECRET via Bearer token
    // x-internal header is NOT sufficient - it's trivially spoofable
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const now = new Date()
    const results: Record<string, unknown> = {}

    // =====================================================
    // 1. Check if daily tasks need to run (once per day)
    // =====================================================
    try {
      const lastDailyLog = await db.platformLog.findFirst({
        where: { action: 'CRON_DAILY_EXECUTED' },
        orderBy: { createdAt: 'desc' },
      })

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const shouldRunDaily = !lastDailyLog || new Date(lastDailyLog.createdAt) < today

      if (shouldRunDaily) {
        console.log('[AUTO-CRON] Running daily tasks...')
        results.dailyTasks = await runDailyTasks(now)
      } else {
        results.dailyTasks = 'Skipped - already run today'
      }
    } catch (err) {
      console.error('[AUTO-CRON] Error checking daily tasks:', err)
      results.dailyTasks = { error: 'Failed to check' }
    }

    // =====================================================
    // 2. Check pending deposits (NowPayments) - Direct check
    // FIX: No more localhost HTTP call - use NOWPayments SDK directly
    // This prevents the 401 auth error from cookie-based auth
    // =====================================================
    try {
      const { checkPaymentStatus, isPaymentSuccessful } = await import('@/lib/nowpayments')

      const pendingDeposits = await db.transaction.findMany({
        where: {
          type: 'DEPOSIT',
          status: 'PENDING',
          nowpaymentsId: { not: null },
        },
        take: 20,
      })

      let depositsChecked = 0
      let depositsCompleted = 0

      for (const deposit of pendingDeposits) {
        if (!deposit.nowpaymentsId) continue
        try {
          const paymentStatus = await checkPaymentStatus(String(deposit.nowpaymentsId))
          depositsChecked++

          if (paymentStatus && isPaymentSuccessful(paymentStatus.payment_status)) {
            // Credit the user using a safe transaction to prevent double-credit
            const creditAmount = deposit.amount
            try {
              await db.$transaction(async (tx) => {
                // Re-read transaction within transaction to prevent race condition
                const currentTx = await tx.transaction.findUnique({
                  where: { id: deposit.id },
                select: { status: true },
                })
                if (!currentTx || currentTx.status === 'COMPLETED') return

                await tx.transaction.update({
                  where: { id: deposit.id },
                  data: {
                    status: 'COMPLETED',
                    nowpaymentsStatus: paymentStatus.payment_status,
                    txHash: paymentStatus.tx_hash || deposit.txHash,
                  },
                })

                await tx.user.update({
                  where: { id: deposit.userId },
                  data: {
                    balance: { increment: creditAmount },
                    withdrawableBalance: { increment: creditAmount },
                    totalDeposited: { increment: creditAmount },
                  },
                })
              })
              depositsCompleted++
            } catch {
              // Already processed (double-credit prevention worked)
            }
          } else if (paymentStatus) {
            // Update the status for tracking but don't credit
            await db.transaction.update({
              where: { id: deposit.id },
              data: {
                nowpaymentsStatus: paymentStatus.payment_status,
                txHash: paymentStatus.tx_hash || deposit.txHash,
              },
            }).catch(() => {})
          }
        } catch {
          // Continue checking other deposits
        }
      }

      results.depositCheck = { checked: depositsChecked, completed: depositsCompleted }
    } catch (err) {
      console.error('[AUTO-CRON] Error checking deposits:', err)
      results.depositCheck = { error: 'Failed' }
    }

    // =====================================================
    // 3. Auto-process pending withdrawals (after 24-48 hours)
    // =====================================================
    try {
      let autoProcessed = 0
      let autoApproved = 0

      // Move PENDING withdrawals to PROCESSING after 12 hours (within transaction)
      const pendingWithdrawals = await db.transaction.findMany({
        where: { type: 'WITHDRAWAL', status: 'PENDING' },
      })

      for (const withdrawal of pendingWithdrawals) {
        const hoursSinceCreation = (now.getTime() - new Date(withdrawal.createdAt).getTime()) / (1000 * 60 * 60)

        if (hoursSinceCreation > 12) {
          try {
            await db.$transaction(async (tx) => {
              // Re-check status within transaction to prevent race condition
              const current = await tx.transaction.findUnique({
                where: { id: withdrawal.id },
                select: { status: true },
              })
              if (!current || current.status !== 'PENDING') return

              await tx.transaction.update({
                where: { id: withdrawal.id },
                data: { status: 'PROCESSING' },
              })
            })
            autoProcessed++
          } catch {
            // Skip if transaction fails (e.g., concurrent update)
          }
        }
      }

      // Auto-approve withdrawals after 48 hours (only small + KYC-verified)
      // SECURITY: Auto-approve ONLY after 48 hours AND under these conditions:
      // - Amount is below auto-approve threshold ($500)
      // - User has verified KYC
      // Large withdrawals ALWAYS require manual admin approval
      const AUTO_APPROVE_MAX_AMOUNT = 500
      const eligibleWithdrawals = await db.transaction.findMany({
        where: {
          type: 'WITHDRAWAL',
          status: { in: ['PENDING', 'PROCESSING'] },
          amount: { lte: AUTO_APPROVE_MAX_AMOUNT },
        },
      })

      for (const withdrawal of eligibleWithdrawals) {
        const hoursSinceCreation = (now.getTime() - new Date(withdrawal.createdAt).getTime()) / (1000 * 60 * 60)

        if (hoursSinceCreation <= 48) continue

        try {
          const result = await db.$transaction(async (tx) => {
            // Re-check transaction status within transaction to prevent race condition
            const current = await tx.transaction.findUnique({
              where: { id: withdrawal.id },
              select: { status: true, userId: true },
            })
            if (!current || !['PENDING', 'PROCESSING'].includes(current.status)) return null

            // Check KYC status within transaction for consistency
            const withdrawalUser = await tx.user.findUnique({
              where: { id: current.userId },
              select: { kycStatus: true },
            })
            if (!['VERIFIED', 'APPROVED'].includes(withdrawalUser?.kycStatus || '')) return null

            // Update to PROCESSING status (not APPROVED directly - admin still needs to finalize)
            await tx.transaction.update({
              where: { id: withdrawal.id },
              data: { status: 'PROCESSING' },
            })

            return { userId: current.userId }
          })

          if (result) {
            await createNotification({
              userId: result.userId,
              title: 'جاري معالجة السحب',
              message: `تمت الموافقة على طلب السحب بقيمة ${(withdrawal.amount ?? 0).toFixed(2)} USDT وسيتم التحويل قريباً`,
              type: 'WITHDRAWAL',
              data: { amount: withdrawal.amount, transactionId: withdrawal.id },
            })

            autoApproved++
          }
        } catch {
          // Skip if transaction fails (e.g., concurrent update)
        }
      }

      results.withdrawalProcessing = { autoProcessed, autoApproved }
    } catch (err) {
      console.error('[AUTO-CRON] Error processing withdrawals:', err)
      results.withdrawalProcessing = { error: 'Failed' }
    }

    // =====================================================
    // 3b. EXTERNAL WITHDRAWAL VERIFICATION via BingX
    // Verify withdrawals that were submitted to BingX and 
    // update their status based on on-chain confirmation
    // =====================================================
    try {
      const processingWithdrawals = await db.transaction.findMany({
        where: { 
          type: 'WITHDRAWAL', 
          status: { in: ['PROCESSING', 'COMPLETED'] },
          txHash: { not: null },
        },
        take: 20,
      })

      let externallyVerified = 0
      let externallyCompleted = 0
      let externallyFailed = 0

      const BINGX_API_KEY = process.env.BINGX_API_KEY || process.env.BINANCE_API_KEY
      const BINGX_SECRET_KEY = process.env.BINGX_SECRET_KEY || process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY

      if (BINGX_API_KEY && BINGX_SECRET_KEY && processingWithdrawals.length > 0) {
        const { verifyBingXWithdrawal } = await import('@/lib/bingx')

        for (const withdrawal of processingWithdrawals) {
          try {
            const details = withdrawal.details
              ? (typeof withdrawal.details === 'string' ? JSON.parse(withdrawal.details) : withdrawal.details)
              : {}

            const verifyResult = await verifyBingXWithdrawal({
              bingxWithdrawId: details.bingxWithdrawId || withdrawal.txHash || undefined,
              withdrawOrderId: withdrawal.id.slice(-10),
              coin: 'USDT',
            })

            if (verifyResult.status === 'COMPLETED' && withdrawal.status !== 'COMPLETED') {
              // BingX confirmed the withdrawal is completed on-chain
              await db.transaction.update({
                where: { id: withdrawal.id },
                data: {
                  status: 'COMPLETED',
                  txHash: verifyResult.txId || withdrawal.txHash,
                  description: `${withdrawal.description || ''} [مؤكد خارجياً من BingX - txId: ${verifyResult.txId || 'N/A'}]`,
                },
              })
              externallyCompleted++
            } else if (verifyResult.status === 'FAILED') {
              // BingX reported the withdrawal as failed
              await db.transaction.update({
                where: { id: withdrawal.id },
                data: {
                  status: 'REJECTED',
                  adminNote: `BingX reported withdrawal as failed. ${verifyResult.reason}`,
                },
              })
              // Refund the user since withdrawal failed externally
              const wUser = await db.user.findUnique({ where: { id: withdrawal.userId } })
              if (wUser) {
                await db.user.update({
                  where: { id: withdrawal.userId },
                  data: {
                    balance: { increment: withdrawal.amount },
                    withdrawableBalance: { increment: withdrawal.amount },
                    totalWithdrawn: { decrement: withdrawal.amount },
                  },
                })
                await db.notification.create({
                  data: {
                    userId: withdrawal.userId,
                    type: 'WITHDRAWAL',
                    title: 'فشل تحويل السحب',
                    message: `فشل تحويل السحب بقيمة ${withdrawal.amount.toFixed(2)} USDT عبر BingX. تم إرجاع المبلغ لحسابك. السبب: ${verifyResult.reason}`,
                  },
                })
              }
              externallyFailed++
            } else if (verifyResult.verified) {
              externallyVerified++
            }
          } catch {
            // Skip failed verifications
          }
        }
      }

      results.externalWithdrawalVerification = { 
        checked: processingWithdrawals.length, 
        verified: externallyVerified, 
        completed: externallyCompleted, 
        failed: externallyFailed 
      }
    } catch (err) {
      console.error('[AUTO-CRON] Error in external withdrawal verification:', err)
      results.externalWithdrawalVerification = { error: 'Failed' }
    }

    // Log execution
    await db.platformLog.create({
      data: {
        action: 'AUTO_CRON_EXECUTED',
        details: JSON.stringify(results),
      },
    })

    // =====================================================
    // 4. SECURITY FORTRESS: Process freeze expirations & auto-detect
    // =====================================================
    try {
      const { processFreezeExpirations, autoDetectSuspiciousUsers } = await import('@/lib/security-fortress')
      
      // Process expired freezes (3-day period complete)
      const freezeResult = await processFreezeExpirations()
      results.securityFortressFreezes = freezeResult

      // Auto-detect suspicious users (runs every cron cycle)
      const autoDetectResult = await autoDetectSuspiciousUsers()
      results.securityFortressAutoDetect = autoDetectResult
    } catch (err) {
      console.error('[AUTO-CRON] Error in security fortress:', err)
      results.securityFortress = { error: 'Failed' }
    }

    // =====================================================
    // 5. SUPPORT: Auto-resolve inactive conversations (30 min)
    // =====================================================
    try {
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
      
      // Find conversations at level 2+ that haven't had user activity for 30 minutes
      const inactiveConversations = await db.chatConversation.findMany({
        where: {
          supportLevel: { gte: 2 },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          lastUserMessageAt: { lt: thirtyMinutesAgo },
          autoCloseNotified: false,
        },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      })

      let autoResolved = 0
      let autoNotified = 0

      for (const conv of inactiveConversations) {
        const lastMsgTime = conv.lastUserMessageAt ? new Date(conv.lastUserMessageAt) : null
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
        
        // If no user message for 25-30 minutes, send a warning notification first
        if (lastMsgTime && lastMsgTime < thirtyMinutesAgo && !conv.autoCloseNotified) {
          // Send one notification asking if they still need help
          await db.chatMessage.create({
            data: {
              conversationId: conv.id,
              senderType: 'AGENT',
              senderId: 'support_agent',
              senderName: 'دعم SONA',
              message: 'هلأ مامشغولك؟ إذا ما عندك سؤال تاني، رح نعتبر الموضوع انحل ونرجعك للمساعدة الذكية. لو بتحاج شي تاني اكتب هون! 👋',
              isRead: false,
              metadata: JSON.stringify({ level: conv.supportLevel, autoResolveWarning: true }),
            },
          })
          await db.chatConversation.update({
            where: { id: conv.id },
            data: { autoCloseNotified: true },
          })
          autoNotified++
        }
      }

      // Find conversations that had notification sent and still no response for another 5 minutes (total 35 min)
      const fiveMinAfterNotify = new Date(now.getTime() - 35 * 60 * 1000)
      const conversationsToResolve = await db.chatConversation.findMany({
        where: {
          supportLevel: { gte: 2 },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          lastUserMessageAt: { lt: fiveMinAfterNotify },
          autoCloseNotified: true,
          resolvedAt: null,
        },
      })

      for (const conv of conversationsToResolve) {
        // Auto-de-escalate back to level 1
        await db.chatConversation.update({
          where: { id: conv.id },
          data: {
            supportLevel: 1,
            isAiActive: true,
            resolutionAsked: false,
            resolvedAt: new Date(),
            autoCloseNotified: false,
            status: 'OPEN',
          },
        })

        // Add a message explaining the auto-resolve
        await db.chatMessage.create({
          data: {
            conversationId: conv.id,
            senderType: 'AI',
            senderId: 'ai_assistant',
            senderName: 'المساعدة الذكية',
            message: 'مرحباً تاني! بما إنك ما رديت، رجعناك للمساعدة الذكية. لو بتحاج شي تاني أنا هون 💙',
            isRead: false,
            metadata: JSON.stringify({ level: 1, autoResolved: true, fromLevel: conv.supportLevel }),
          },
        })

        autoResolved++
      }

      results.supportAutoResolve = { warned: autoNotified, resolved: autoResolved }
    } catch (err) {
      console.error('[AUTO-CRON] Error in support auto-resolve:', err)
      results.supportAutoResolve = { error: 'Failed' }
    }

    // =====================================================
    // 6. AI AUTOMATION V4: Full autonomous platform management
    // =====================================================
    try {
      const {
        autoApproveDeposit,
        autoApproveWithdrawal,
        aiPlatformHealthCheck,
        aiSmartReEngagement,
        aiUserManagement,
        aiOptimizePlatformSettings,
        autoRetryFailedWithdrawals,
        aiNormalizeKYCStatus,
        // V4 new systems
        aiEmergencyManagement,
        aiAutoCompleteInvestments,
        calculateAutomationScore,
      } = await import('@/lib/ai-automation')

      // 6a. Auto-approve pending deposits using AI risk assessment
      const pendingNewDeposits = await db.transaction.findMany({
        where: { type: 'DEPOSIT', status: 'PENDING' },
        take: 10,
      })

      let aiDepositsApproved = 0
      let aiDepositsRejected = 0
      for (const dep of pendingNewDeposits) {
        try {
          const result = await autoApproveDeposit(dep.id)
          if (result.approved) aiDepositsApproved++
          else if (result.riskScore > 60) aiDepositsRejected++
        } catch {
          // Skip failed assessments
        }
      }

      // 6b. Auto-approve pending/processing withdrawals using AI
      const pendingWithdrawals = await db.transaction.findMany({
        where: { type: 'WITHDRAWAL', status: { in: ['PENDING', 'PROCESSING'] } },
        take: 10,
      })

      let aiWithdrawalsApproved = 0
      let aiWithdrawalsRejected = 0
      for (const wit of pendingWithdrawals) {
        try {
          const result = await autoApproveWithdrawal(wit.id)
          if (result.approved) aiWithdrawalsApproved++
          else if (result.riskScore > 60) aiWithdrawalsRejected++
        } catch {
          // Skip failed assessments
        }
      }

      // 6c. AI platform health check (enhanced)
      const healthCheck = await aiPlatformHealthCheck()

      // 6d. AI smart re-engagement (runs once daily)
      let reEngagementResult = { processed: 0, actions: [] as string[] }
      if (results.dailyTasks !== 'Skipped - already run today') {
        reEngagementResult = await aiSmartReEngagement()
      }

      // 6e. AI user management (auto-suspend/reactivate/flag)
      let userManagementResult = { processed: 0, actions: [] as string[] }
      if (results.dailyTasks !== 'Skipped - already run today') {
        userManagementResult = await aiUserManagement()
      }

      // 6f. AI platform settings optimization (runs once daily)
      let settingsOptimizationResult = { optimized: 0, changes: [] as string[] }
      if (results.dailyTasks !== 'Skipped - already run today') {
        settingsOptimizationResult = await aiOptimizePlatformSettings()
      }

      // 6g. Auto-retry failed BingX withdrawals
      const retryResult = await autoRetryFailedWithdrawals()

      // 6h. Normalize KYC status: migrate legacy 'APPROVED' to standard 'VERIFIED'
      const kycNormResult = await aiNormalizeKYCStatus()

      // 6i. AI Emergency Management (every cycle - critical!)
      const emergencyResult = await aiEmergencyManagement()

      // 6j. Auto-complete matured investments
      const investmentCompletion = await aiAutoCompleteInvestments()

      // 6k. AI Periodic Deep Scan (daily only)
      let deepScanResult = { scanned: 0, flagged: 0, actions: [] as string[] }
      if (results.dailyTasks !== 'Skipped - already run today') {
        const { aiPeriodicDeepScan } = await import('@/lib/ai-automation')
        deepScanResult = await aiPeriodicDeepScan()
      }

      // 6l. Auto Cleanup (daily only)
      let cleanupResult = { cleaned: 0, details: [] as string[] }
      if (results.dailyTasks !== 'Skipped - already run today') {
        const { aiAutoCleanup } = await import('@/lib/ai-automation')
        cleanupResult = await aiAutoCleanup()
      }

      // 6m. Calculate Automation Score (daily only)
      let automationScore = null
      if (results.dailyTasks !== 'Skipped - already run today') {
        automationScore = await calculateAutomationScore()
      }

      results.aiAutomation = {
        depositsApproved: aiDepositsApproved,
        depositsRejected: aiDepositsRejected,
        withdrawalsApproved: aiWithdrawalsApproved,
        withdrawalsRejected: aiWithdrawalsRejected,
        platformHealth: healthCheck.healthy ? 'HEALTHY' : 'ISSUES_DETECTED',
        healthIssues: healthCheck.issues,
        healthFixed: healthCheck.fixed,
        reEngagementProcessed: reEngagementResult.processed,
        userManagementProcessed: userManagementResult.processed,
        userManagementActions: userManagementResult.actions,
        settingsOptimized: settingsOptimizationResult.optimized,
        settingsChanges: settingsOptimizationResult.changes,
        bingxRetried: retryResult.retried,
        bingxRetryResults: retryResult.results,
        kycNormalized: kycNormResult.normalized,
        emergencyActions: emergencyResult.actions,
        emergencyTriggered: emergencyResult.triggered,
        investmentsCompleted: investmentCompletion.completed,
        investmentsReturned: investmentCompletion.totalReturned,
        deepScanned: deepScanResult.scanned,
        deepFlagged: deepScanResult.flagged,
        cleaned: cleanupResult.cleaned,
        cleanupDetails: cleanupResult.details,
        automationScore: automationScore?.overallScore || null,
        automationBreakdown: automationScore?.breakdown || null,
      }
    } catch (err) {
      console.error('[AUTO-CRON] Error in AI automation:', err)
      results.aiAutomation = { error: 'Failed' }
    }

    return NextResponse.json({
      message: 'تم تنفيذ المهام التلقائية',
      executedAt: now.toISOString(),
      results,
    }, { status: 200 })
  } catch (error) {
    console.error('Auto cron error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تنفيذ المهام التلقائية' },
      { status: 500 }
    )
  }
}

// Also support POST for external cron services
export async function POST(request: NextRequest) {
  return GET(request)
}

/**
 * Run daily tasks - profit calculation, weekly transfers, notifications
 */
async function runDailyTasks(now: Date): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}

  try {
    const settings = await db.platformSetting.findMany()
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))
    const weeklyTransferDay = parseInt(settingsMap.get('weekly_transfer_day') || '7', 10)

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // --- Daily Profit Calculation ---
    const activeInvestments = await db.investment.findMany({
      where: { status: 'ACTIVE' },
      include: { package: true, user: true },
    })

    let profitsCredited = 0
    let totalProfit = 0
    let weeklyTransfers = 0
    let totalTransferred = 0

    for (const investment of activeInvestments) {
      try {
        const lastDaily = investment.lastDailyProfitDate
          ? new Date(
              investment.lastDailyProfitDate.getFullYear(),
              investment.lastDailyProfitDate.getMonth(),
              investment.lastDailyProfitDate.getDate()
            )
          : null

        if (lastDaily && lastDaily.getTime() >= today.getTime()) {
          continue
        }

        // FIX: monthlyReturn is the MONTHLY percentage rate
        // Daily rate = monthlyReturn / 30
        let dailyProfit = investment.amount * (investment.package.monthlyReturn / 100 / 30)

        // Safety cap
        const maxDailyProfit = investment.amount * (MAX_DAILY_RETURN_PERCENT / 100)
        if (dailyProfit > maxDailyProfit) {
          dailyProfit = maxDailyProfit
        }

        await db.$transaction(async (tx) => {
          await tx.investment.update({
            where: { id: investment.id },
            data: {
              nonWithdrawableProfit: { increment: dailyProfit },
              lastDailyProfitDate: now,
              totalProfit: { increment: dailyProfit },
            },
          })

          await tx.user.update({
            where: { id: investment.userId },
            data: {
              nonWithdrawableProfit: { increment: dailyProfit },
              totalProfit: { increment: dailyProfit },
            },
          })

          await tx.transaction.create({
            data: {
              userId: investment.userId,
              type: 'PROFIT',
              amount: dailyProfit,
              status: 'COMPLETED',
              method: 'sona_daily',
              description: `أرباح يومية من باقة ${investment.package.name}`,
              reference: investment.id,
            },
          })
        })

        await createNotification({
          userId: investment.userId,
          title: 'أرباح يومية',
          message: `تم إضافة أرباح اليوم ${(dailyProfit ?? 0).toFixed(2)} USDT إلى رصيد أرباحك`,
          type: 'PROFIT',
          data: { amount: dailyProfit, investmentId: investment.id },
        })

        profitsCredited++
        totalProfit += dailyProfit

        // Weekly transfer check
        const lastWeekly = investment.lastWeeklyTransfer
          ? new Date(investment.lastWeeklyTransfer)
          : investment.startDate
        const daysSinceLastTransfer = Math.floor(
          (now.getTime() - new Date(lastWeekly).getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceLastTransfer >= weeklyTransferDay && investment.nonWithdrawableProfit + dailyProfit > 0) {
          const transferAmount = investment.nonWithdrawableProfit + dailyProfit

          await db.$transaction(async (tx) => {
            await tx.investment.update({
              where: { id: investment.id },
              data: {
                withdrawableProfit: { increment: transferAmount },
                nonWithdrawableProfit: 0,
                lastWeeklyTransfer: now,
              },
            })

            await tx.user.update({
              where: { id: investment.userId },
              data: {
                withdrawableBalance: { increment: transferAmount },
                nonWithdrawableProfit: { decrement: transferAmount },
              },
            })

            await tx.transaction.create({
              data: {
                userId: investment.userId,
                type: 'WEEKLY_TRANSFER',
                amount: transferAmount,
                status: 'COMPLETED',
                method: 'sona_weekly',
                description: `تحويل أرباح أسبوعية (${(transferAmount ?? 0).toFixed(2)} USDT) إلى الرصيد القابل للسحب`,
                reference: investment.id,
              },
            })
          })

          await createNotification({
            userId: investment.userId,
            title: 'تحويل أرباح أسبوعية',
            message: `تم تحويل أرباح الأسبوع (${(transferAmount ?? 0).toFixed(2)} USDT) إلى رصيدك القابل للسحب`,
            type: 'PROFIT',
            data: { amount: transferAmount, investmentId: investment.id },
          })

          weeklyTransfers++
          totalTransferred += transferAmount
        }
      } catch (err) {
        console.error(`[AUTO-CRON] Error processing investment ${investment.id}:`, err)
      }
    }

    results.dailyProfits = { profitsCredited, totalProfit, weeklyTransfers, totalTransferred }

    // --- Send inactive user notifications ---
    try {
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const inactiveUsers = await db.user.findMany({
        where: {
          isActive: true,
          withdrawableBalance: { gt: 0 },
          transactions: { none: { createdAt: { gte: sevenDaysAgo } } },
        },
        select: { id: true, name: true, withdrawableBalance: true },
      })

      let inactiveNotified = 0
      for (const user of inactiveUsers) {
        const recentNotification = await db.notification.findFirst({
          where: {
            userId: user.id,
            type: 'INACTIVITY_REMINDER',
            createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
          },
        })

        if (!recentNotification) {
          await createNotification({
            userId: user.id,
            title: 'رصيدك القابل للسحب ينتظرك!',
            message: `لديك رصيد قابل للسحب بقيمة ${(user.withdrawableBalance ?? 0).toFixed(2)} USDT. يمكنك سحبه أو إعادة استثماره!`,
            type: 'INACTIVITY_REMINDER',
            data: { withdrawableBalance: user.withdrawableBalance },
          })
          inactiveNotified++
        }
      }

      results.inactiveUsersNotified = inactiveNotified
    } catch (err) {
      console.error('[AUTO-CRON] Error sending inactive notifications:', err)
      results.inactiveUsersNotified = { error: 'Failed' }
    }

    // Log daily execution
    await db.platformLog.create({
      data: {
        action: 'CRON_DAILY_EXECUTED',
        details: JSON.stringify(results),
      },
    })
  } catch (err) {
    console.error('[AUTO-CRON] Error in daily tasks:', err)
    results.error = 'Failed to process daily tasks'
  }

  return results
}
