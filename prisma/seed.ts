import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // ═══ 1. ADMIN USER ═══
  const adminEmail = process.env.ADMIN_EMAIL || 'help@sona.support'
  const adminPassword = process.env.ADMIN_PASSWORD || 'S0n4!Adm1n$2024#Secure'
  const hashedPassword = await bcrypt.hash(adminPassword, 12)

  const generateReferralCode = () => {
    const bytes = crypto.randomBytes(4)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i % 4] % chars.length]
    }
    return code
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'SONA Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        balance: 0,
        totalProfit: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        emailVerified: true,
        isActive: true,
        referralCode: 'SONA0001',
        lang: 'ar',
      },
    })
    console.log('✅ Admin user created:', adminEmail)
  } else {
    console.log('ℹ️ Admin user already exists')
  }

  // ═══ 2. INVESTMENT PACKAGES ═══
  const packages = [
    {
      name: 'الباقة البرونزية',
      nameEn: 'Bronze Package',
      minAmount: 50,
      maxAmount: 499,
      monthlyReturn: 8,
      durationDays: 30,
      description: 'باقة مثالية للمبتدئين في عالم الاستثمار الرقمي',
      descriptionEn: 'Ideal package for beginners in digital investment',
      color: '#CD7F32',
      icon: '🥉',
      isActive: true,
      order: 1,
      dailyWithdrawalLimit: 100,
      processingTimeHours: '1-12',
      mode: 'SONA',
    },
    {
      name: 'الباقة الفضية',
      nameEn: 'Silver Package',
      minAmount: 500,
      maxAmount: 4999,
      monthlyReturn: 12,
      durationDays: 30,
      description: 'باقة متقدمة لعوائد أفضل مع ميزات إضافية',
      descriptionEn: 'Advanced package for better returns with extra features',
      color: '#C0C0C0',
      icon: '🥈',
      isActive: true,
      order: 2,
      dailyWithdrawalLimit: 500,
      processingTimeHours: '1-12',
      mode: 'SONA',
    },
    {
      name: 'الباقة الذهبية',
      nameEn: 'Gold Package',
      minAmount: 5000,
      maxAmount: 19999,
      monthlyReturn: 18,
      durationDays: 30,
      description: 'باقة متميزة لأصحاب الخبرة مع عوائد مميزة',
      descriptionEn: 'Premium package for experienced investors with outstanding returns',
      color: '#FFD700',
      icon: '🥇',
      isActive: true,
      order: 3,
      dailyWithdrawalLimit: 2000,
      processingTimeHours: '1-6',
      mode: 'SONA',
    },
    {
      name: 'الباقة البلاتينية',
      nameEn: 'Platinum Package',
      minAmount: 20000,
      maxAmount: 49999,
      monthlyReturn: 22,
      durationDays: 30,
      description: 'باقة حصرية للمستثمرين المحترفين مع أعلى العوائد',
      descriptionEn: 'Exclusive package for professional investors with the highest returns',
      color: '#E5E4E2',
      icon: '💎',
      isActive: true,
      order: 4,
      dailyWithdrawalLimit: 5000,
      processingTimeHours: '1-3',
      mode: 'SONA',
    },
    {
      name: 'باقة الألماس',
      nameEn: 'Diamond Package',
      minAmount: 50000,
      maxAmount: null,
      monthlyReturn: 28,
      durationDays: 30,
      description: 'باقة النخبة الحصرية بلا حدود مع عوائد استثنائية وخدمة VIP',
      descriptionEn: 'Elite unlimited package with exceptional returns and VIP service',
      color: '#B9F2FF',
      icon: '👑',
      isActive: true,
      order: 5,
      dailyWithdrawalLimit: 0,
      processingTimeHours: '0-1',
      mode: 'SONA',
    },
  ]

  for (const pkg of packages) {
    const existing = await prisma.package.findFirst({ where: { name: pkg.name } })
    if (!existing) {
      await prisma.package.create({ data: pkg })
      console.log(`✅ Package created: ${pkg.name}`)
    } else {
      console.log(`ℹ️ Package already exists: ${pkg.name}`)
    }
  }

  // ═══ 3. PLATFORM SETTINGS ═══
  const settings = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'registration_enabled', value: 'true' },
    { key: 'deposit_enabled', value: 'true' },
    { key: 'withdrawal_enabled', value: 'true' },
    { key: 'min_deposit', value: '10' },
    { key: 'min_withdrawal', value: '25' },
    { key: 'withdrawal_fee_percent', value: '0' },
    { key: 'referral_bonus_percent', value: '15' },
    { key: 'kyc_required_for_withdrawal', value: 'true' },
    { key: 'kyc_required_for_deposit', value: 'false' },
    { key: 'auto_approve_deposit', value: 'true' },
    { key: 'auto_profit_calculation', value: 'true' },
    { key: 'profit_calculation_interval', value: 'daily' },
    { key: 'max_login_attempts', value: '5' },
    { key: 'lockout_duration_minutes', value: '30' },
    { key: 'session_timeout_hours', value: '24' },
    { key: 'platform_commission_percent', value: '20' },
    { key: 'p2p_enabled', value: 'true' },
    { key: 'p2p_fee_percent', value: '0' },
    { key: 'trading_enabled', value: 'true' },
    { key: 'support_enabled', value: 'true' },
  ]

  for (const setting of settings) {
    const existing = await prisma.platformSetting.findUnique({ where: { key: setting.key } })
    if (!existing) {
      await prisma.platformSetting.create({ data: setting })
    }
  }
  console.log(`✅ Platform settings seeded (${settings.length} settings)`)

  // ═══ 4. POOL ═══
  const existingPool = await prisma.pool.findFirst()
  if (!existingPool) {
    await prisma.pool.create({
      data: {
        totalFunds: 0,
        totalProfit: 0,
        totalLoss: 0,
        platformCommission: 0,
        activeTrades: 0,
        status: 'ACTIVE',
      },
    })
    console.log('✅ Trading pool created')
  }

  // ═══ 5. BOT CONTROL ═══
  const existingBot = await prisma.botControl.findFirst()
  if (!existingBot) {
    await prisma.botControl.create({
      data: {
        isActive: true,
        tradesPerMinute: 2.0,
        winRate: 0.72,
        maxTradeAmount: 500,
        minTradeAmount: 10,
        volatilityFactor: 1.0,
        symbols: 'BTC/USDT,ETH/USDT',
      },
    })
    console.log('✅ Bot control created')
  }

  // ═══ 6. SECURITY SETTINGS ═══
  const secSettings = [
    { key: 'vpn_detection_enabled', value: 'true' },
    { key: 'auto_freeze_on_vpn', value: 'true' },
    { key: 'auto_freeze_duration_days', value: '3' },
    { key: 'deep_scan_on_freeze', value: 'true' },
    { key: 'blacklist_auto_vpn_ip', value: 'true' },
    { key: 'rate_limit_login_per_minute', value: '5' },
    { key: 'rate_limit_register_per_hour', value: '3' },
    { key: 'rate_limit_withdraw_per_day', value: '5' },
    { key: 'rate_limit_deposit_per_day', value: '10' },
    { key: 'require_2fa_for_withdrawal', value: 'false' },
  ]

  for (const s of secSettings) {
    const existing = await prisma.securitySetting.findUnique({ where: { key: s.key } })
    if (!existing) {
      await prisma.securitySetting.create({ data: s })
    }
  }
  console.log(`✅ Security settings seeded (${secSettings.length} settings)`)

  // ═══ 7. DEPOSIT ADDRESSES ═══
  const addresses = [
    { currency: 'USDT', network: 'TRC20', address: 'TN7xqJLQYR8FReCgBqU8bHf2vD5mK9pWr', minAmount: 10, isActive: true },
    { currency: 'USDT', network: 'BEP20', address: '0x23b1f4812089c7dd471104fd17686765598d005f', minAmount: 10, isActive: true },
    { currency: 'BTC', network: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', minAmount: 0.001, isActive: true },
    { currency: 'ETH', network: 'ERC20', address: '0x23b1f4812089c7dd471104fd17686765598d005f', minAmount: 0.01, isActive: true },
  ]

  for (const addr of addresses) {
    const existing = await prisma.depositAddress.findFirst({
      where: { currency: addr.currency, network: addr.network }
    })
    if (!existing) {
      await prisma.depositAddress.create({ data: addr })
    }
  }
  console.log(`✅ Deposit addresses seeded (${addresses.length} addresses)`)

  // ═══ 8. SUPPORT AGENTS ═══
  const agents = [
    {
      name: 'سارة - الدعم الفني',
      nameEn: 'Sarah - Tech Support',
      title: 'متخصصة في الدعم الفني',
      titleEn: 'Technical Support Specialist',
      avatar: '/agents/sarah.png',
      specialty: 'مشاكل تقنية',
      specialtyEn: 'Technical Issues',
      isActive: true,
    },
    {
      name: 'أحمد - الشؤون المالية',
      nameEn: 'Ahmed - Finance',
      title: 'متخصص في العمليات المالية',
      titleEn: 'Financial Operations Specialist',
      avatar: '/agents/ahmed.png',
      specialty: 'إيداع وسحب',
      specialtyEn: 'Deposits & Withdrawals',
      isActive: true,
    },
    {
      name: 'ليلى - خدمة العملاء',
      nameEn: 'Layla - Customer Service',
      title: 'مديرة علاقات العملاء',
      titleEn: 'Customer Relations Manager',
      avatar: '/agents/layla.png',
      specialty: 'استفسارات عامة',
      specialtyEn: 'General Inquiries',
      isActive: true,
    },
  ]

  for (const agent of agents) {
    const existing = await prisma.supportAgent.findFirst({
      where: { name: agent.name }
    })
    if (!existing) {
      await prisma.supportAgent.create({ data: agent })
    }
  }
  console.log(`✅ Support agents seeded (${agents.length} agents)`)

  console.log('\n🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
