import { db } from '@/lib/db'
import { createNotification, notifyCommissionCredited } from '@/lib/notifications'

// Commission configuration
interface CommissionConfig {
  directReferralBonus: number   // $5 per direct referral (default)
  level2Commission: number      // % commission from level 2 referrals
  level3Commission: number      // % commission from level 3 referrals
  investmentCommission: number  // % commission from referred user's investments
  minWithdrawal: number         // minimum commission withdrawal
}

const DEFAULT_CONFIG: CommissionConfig = {
  directReferralBonus: 5,
  level2Commission: 1,    // 1%
  level3Commission: 0.5,  // 0.5%
  investmentCommission: 15, // 15%
  minWithdrawal: 10,
}

// Commission type for transactions
type CommissionType = 'LEVEL1_INVESTMENT' | 'LEVEL2_COMMISSION' | 'LEVEL3_COMMISSION'

// Referral tree node for admin display
interface ReferralTreeNode {
  id: string
  name: string
  email: string
  referralCode: string
  level: number
  reward: number
  status: string
  joinedAt: Date
  referrals: ReferralTreeNode[]
}

/**
 * Process investment commission for the referrer chain.
 * Walks up to 3 levels of referrers and credits each one their respective commission.
 *
 * Level 1: Direct referrer gets investmentCommission% of the investment amount
 * Level 2: Referrer's referrer gets level2Commission% of the investment amount
 * Level 3: Level 2's referrer gets level3Commission% of the investment amount
 */
export async function processInvestmentCommission(userId: string, investmentAmount: number): Promise<void> {
  if (investmentAmount <= 0) return

  const config = await getCommissionConfig()

  // Level 1: Direct referrer
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referredByCode: true, name: true },
  })
  if (!user?.referredByCode) return

  const level1Referrer = await db.user.findUnique({
    where: { referralCode: user.referredByCode },
  })
  if (!level1Referrer) return

  // Level 1: Investment commission
  const level1Amount = investmentAmount * (config.investmentCommission / 100)
  await creditCommission(
    level1Referrer.id,
    level1Amount,
    userId,
    'LEVEL1_INVESTMENT',
    `عمولة استثمار من ${user.name || 'مستخدم'}`
  )

  // Level 2: Referrer's referrer
  if (level1Referrer.referredByCode) {
    const level2Referrer = await db.user.findUnique({
      where: { referralCode: level1Referrer.referredByCode },
    })
    if (level2Referrer) {
      const level2Amount = investmentAmount * (config.level2Commission / 100)
      await creditCommission(
        level2Referrer.id,
        level2Amount,
        userId,
        'LEVEL2_COMMISSION',
        `عمولة مستوى 2 من ${user.name || 'مستخدم'}`
      )

      // Level 3: Level 2's referrer
      if (level2Referrer.referredByCode) {
        const level3Referrer = await db.user.findUnique({
          where: { referralCode: level2Referrer.referredByCode },
        })
        if (level3Referrer) {
          const level3Amount = investmentAmount * (config.level3Commission / 100)
          await creditCommission(
            level3Referrer.id,
            level3Amount,
            userId,
            'LEVEL3_COMMISSION',
            `عمولة مستوى 3 من ${user.name || 'مستخدم'}`
          )
        }
      }
    }
  }
}

/**
 * Credit commission to a user's balance and record the transaction.
 * Skips amounts below $0.01 to avoid negligible credits.
 */
async function creditCommission(
  userId: string,
  amount: number,
  fromUserId: string,
  type: CommissionType,
  description: string
): Promise<void> {
  if (amount < 0.01) return // Skip tiny amounts

  try {
    await db.$transaction(async (tx) => {
      // Credit the user's balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          withdrawableBalance: { increment: amount },
          totalProfit: { increment: amount },
        },
      })

      // Record the commission transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'COMMISSION',
          amount,
          status: 'COMPLETED',
          method: type.toLowerCase(),
          description,
          reference: fromUserId,
        },
      })
    })

    // Send notification about the commission (Syrian dialect with level info)
    const levelNum = type === 'LEVEL1_INVESTMENT' ? 1 : type === 'LEVEL2_COMMISSION' ? 2 : 3
    await notifyCommissionCredited(userId, amount, description.replace(/^عمولة استثمار من |^عمولة مستوى 2 من |^عمولة مستوى 3 من /, ''), levelNum)

    console.log(`[COMMISSION] Credited $${amount.toFixed(2)} to user ${userId} (${type}) from ${fromUserId}`)
  } catch (error) {
    console.error(`[COMMISSION] Failed to credit commission to user ${userId}:`, error)
    throw error
  }
}

/**
 * Get commission configuration from platform settings.
 * Falls back to DEFAULT_CONFIG if settings are unavailable or invalid.
 */
export async function getCommissionConfig(): Promise<CommissionConfig> {
  try {
    const settings = await db.platformSetting.findMany({
      where: {
        key: {
          in: [
            'commission_direct_bonus',
            'commission_level2',
            'commission_level3',
            'commission_investment',
            'commission_min_withdrawal',
          ],
        },
      },
    })

    const map = new Map(settings.map((s) => [s.key, s.value]))

    const parseSetting = (key: string, defaultValue: number): number => {
      const raw = map.get(key)
      if (!raw) return defaultValue
      const parsed = parseFloat(raw)
      return isNaN(parsed) || parsed < 0 ? defaultValue : parsed
    }

    return {
      directReferralBonus: parseSetting('commission_direct_bonus', DEFAULT_CONFIG.directReferralBonus),
      level2Commission: parseSetting('commission_level2', DEFAULT_CONFIG.level2Commission),
      level3Commission: parseSetting('commission_level3', DEFAULT_CONFIG.level3Commission),
      investmentCommission: parseSetting('commission_investment', DEFAULT_CONFIG.investmentCommission),
      minWithdrawal: parseSetting('commission_min_withdrawal', DEFAULT_CONFIG.minWithdrawal),
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

/**
 * Get the referral tree for a user (for admin display).
 * Recursively builds a tree of referred users up to the specified depth.
 */
export async function getReferralTree(userId: string, depth: number = 3): Promise<ReferralTreeNode | null> {
  if (depth <= 0) return null

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      createdAt: true,
      referralsMade: {
        where: { status: 'CREDITED' },
        include: {
          referred: {
            select: {
              id: true,
              name: true,
              email: true,
              referralCode: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  if (!user) return null

  const children: ReferralTreeNode[] = []
  for (const referral of user.referralsMade) {
    const childNode = await getReferralTree(referral.referred.id, depth - 1)
    children.push({
      id: referral.referred.id,
      name: referral.referred.name,
      email: referral.referred.email,
      referralCode: referral.referred.referralCode,
      level: 0, // Will be set by parent
      reward: referral.reward,
      status: referral.status,
      joinedAt: referral.referred.createdAt,
      referrals: childNode?.referrals || [],
    })
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    referralCode: user.referralCode,
    level: 1,
    reward: 0,
    status: 'ROOT',
    joinedAt: user.createdAt,
    referrals: children.map((child, index) => ({
      ...child,
      level: 2,
      referrals: child.referrals.map((grandchild) => ({
        ...grandchild,
        level: 3,
      })),
    })),
  }
}

/**
 * Get commission statistics for a user.
 * Returns total commissions earned at each level.
 */
export async function getCommissionStats(userId: string): Promise<{
  totalCommission: number
  level1Commission: number
  level2Commission: number
  level3Commission: number
  directReferralCount: number
  totalReferralCount: number
}> {
  // Get all commission transactions for this user
  const commissions = await db.transaction.findMany({
    where: {
      userId,
      type: 'COMMISSION',
      status: 'COMPLETED',
    },
    select: {
      amount: true,
      method: true,
    },
  })

  let level1Commission = 0
  let level2Commission = 0
  let level3Commission = 0

  for (const commission of commissions) {
    const method = commission.method?.toLowerCase() || ''
    if (method === 'level1_investment') {
      level1Commission += commission.amount
    } else if (method === 'level2_commission') {
      level2Commission += commission.amount
    } else if (method === 'level3_commission') {
      level3Commission += commission.amount
    }
  }

  // Get referral counts
  const directReferralCount = await db.referral.count({
    where: { referrerId: userId, status: 'CREDITED' },
  })

  // Total referrals including indirect (via referral code matching)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })

  let totalReferralCount = directReferralCount
  if (user?.referralCode) {
    // Count all users who were referred by someone who was directly referred by this user
    const directReferrals = await db.referral.findMany({
      where: { referrerId: userId, status: 'CREDITED' },
      select: { referred: { select: { referralCode: true } } },
    })

    for (const ref of directReferrals) {
      if (ref.referred.referralCode) {
        const indirectCount = await db.user.count({
          where: { referredByCode: ref.referred.referralCode },
        })
        totalReferralCount += indirectCount
      }
    }
  }

  return {
    totalCommission: level1Commission + level2Commission + level3Commission,
    level1Commission,
    level2Commission,
    level3Commission,
    directReferralCount,
    totalReferralCount,
  }
}
