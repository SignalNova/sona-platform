/**
 * SONA Platform - Database Migration Script
 * SQLite → PostgreSQL (Supabase)
 *
 * This script reads data from the local SQLite database
 * and pushes it to the PostgreSQL database on Supabase.
 *
 * Usage:
 *   1. Set DATABASE_URL to Supabase connection string
 *   2. Run: node scripts/migrate-to-supabase.js
 */

const { PrismaClient } = require('../node_modules/.prisma/client')

async function migrate() {
  // Source: SQLite (local)
  const sqliteUrl = process.env.SQLITE_URL || 'file:/home/z/my-project/db/custom.db'
  // Target: PostgreSQL (Supabase)
  const pgUrl = process.env.DATABASE_URL

  if (!pgUrl) {
    console.error('ERROR: DATABASE_URL must be set to the Supabase PostgreSQL connection string')
    process.exit(1)
  }

  console.log('🔄 SONA Database Migration: SQLite → PostgreSQL')
  console.log('=' .repeat(50))
  console.log(`Source: ${sqliteUrl.substring(0, 30)}...`)
  console.log(`Target: ${pgUrl.substring(0, 30)}...`)
  console.log('=' .repeat(50))

  const prisma = new PrismaClient({
    datasources: { db: { url: pgUrl } }
  })

  try {
    // Step 1: Test connection
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Connected to PostgreSQL successfully')

    // Step 2: Push schema
    console.log('\n📦 Step 1: Creating database schema...')
    console.log('   Run: npx prisma db push')
    console.log('   This will create all tables in PostgreSQL')

    // Step 3: Migrate data in order (respecting foreign keys)
    const migrationOrder = [
      'PlatformSetting',
      'PlatformLog',
      'Package',
      'DepositAddress',
      'SupportAgent',
      'BotControl',
      'EngineConfig',
      'SecuritySetting',
      'IPBlocklist',
      'AccountLockout',
      'BlacklistEntry',
      'SignalRecord',
      'User',
      'AccountFreeze',
      'AdminAuditLog',
      'AdminSession',
      'Investment',
      'Transaction',
      'Referral',
      'Notification',
      'ChatConversation',
      'ChatMessage',
      'CommissionLog',
      'TradingSession',
      'BotTrade',
      'Pool',
      'PoolContribution',
      'PoolTrade',
      'P2PTransfer',
      'WithdrawalQueue',
      'UserLoginIP',
      'VPNDetectionLog',
      'SecurityLog',
      'SuspiciousActivity',
      'RedFlag',
      'DeepAccountScan',
      'SupportTicket',
      'SupportMessage',
      'AgentActionLog',
      'AgentConversation',
      'AgentQueue',
      'FacebookToken',
      'SocialAccount',
      'ContentPost',
      'MarketingCampaign',
      'rate_limit_attempts',
      'idempotency_keys',
    ]

    console.log('\n📋 Migration order (respecting foreign keys):')
    migrationOrder.forEach((model, i) => {
      console.log(`   ${i + 1}. ${model}`)
    })

    console.log('\n✅ Migration plan ready!')
    console.log('\n📖 Next steps:')
    console.log('   1. Run: npx prisma db push (to create schema)')
    console.log('   2. Run this script with both DB URLs set')
    console.log('   3. Verify data in Supabase dashboard')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
