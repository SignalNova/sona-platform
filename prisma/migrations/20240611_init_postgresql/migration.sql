-- SONA Platform - PostgreSQL Schema
-- This migration creates all tables for Supabase/PostgreSQL
-- Generated from Prisma schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AccountFreeze
CREATE TABLE "AccountFreeze" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "frozenBy" TEXT,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "unfreezeAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scanResult" TEXT,
    "scanCompletedAt" TIMESTAMP(3),
    "platformDamage" BOOLEAN NOT NULL DEFAULT false,
    "damageDetails" TEXT,
    "autoUnfroze" BOOLEAN NOT NULL DEFAULT false,
    "escalatedToBan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountFreeze_pkey" PRIMARY KEY ("id")
);

-- AccountLockout
CREATE TABLE "AccountLockout" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountLockout_pkey" PRIMARY KEY ("id")
);

-- AdminAuditLog
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- AdminSession
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "twoFactorVerified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- AgentActionLog
CREATE TABLE "AgentActionLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "params" TEXT,
    "result" TEXT,
    "success" BOOLEAN NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AgentActionLog_pkey" PRIMARY KEY ("id")
);

-- AgentConversation
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolsUsed" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- AgentQueue
CREATE TABLE "AgentQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "assignedAt" TIMESTAMP(3),
    CONSTRAINT "AgentQueue_pkey" PRIMARY KEY ("id")
);

-- BlacklistEntry
CREATE TABLE "BlacklistEntry" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "isPermanent" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "relatedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- BotControl
CREATE TABLE "BotControl" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tradesPerMinute" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0.72,
    "maxTradeAmount" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "minTradeAmount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "volatilityFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "symbols" TEXT NOT NULL DEFAULT 'BTC/USDT,ETH/USDT',
    "pausedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotControl_pkey" PRIMARY KEY ("id")
);

-- BotTrade
CREATE TABLE "BotTrade" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT 'BTC/USDT',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "profitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "marginType" TEXT NOT NULL DEFAULT 'cross',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "closedAt" TIMESTAMP(3),
    "takeProfit2" DOUBLE PRECISION,
    "takeProfit3" DOUBLE PRECISION,
    CONSTRAINT "BotTrade_pkey" PRIMARY KEY ("id")
);

-- ChatConversation
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "supportLevel" INTEGER NOT NULL DEFAULT 1,
    "isAiActive" BOOLEAN NOT NULL DEFAULT true,
    "handoffReason" TEXT,
    "lastUserMessageAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "agentAssignedAt" TIMESTAMP(3),
    "resolutionAsked" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "category" TEXT,
    "autoCloseNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- ChatMessage
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL DEFAULT 'USER',
    "senderId" TEXT NOT NULL,
    "senderName" TEXT,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isAgentMessage" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CommissionLog
CREATE TABLE "CommissionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "investmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREDITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "CommissionLog_pkey" PRIMARY KEY ("id")
);

-- ContentPost
CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "postId" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

-- DeepAccountScan
CREATE TABLE "DeepAccountScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freezeId" TEXT,
    "scanType" TEXT NOT NULL DEFAULT 'FREEZE_3DAY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "suspiciousTxCount" INTEGER NOT NULL DEFAULT 0,
    "balanceAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "loginAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "ipAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "vpnUsageCount" INTEGER NOT NULL DEFAULT 0,
    "sameIPAccountCount" INTEGER NOT NULL DEFAULT 0,
    "referralFraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformDamage" BOOLEAN NOT NULL DEFAULT false,
    "damageDetails" TEXT,
    "recommendation" TEXT,
    "scanData" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "DeepAccountScan_pkey" PRIMARY KEY ("id")
);

-- DepositAddress
CREATE TABLE "DepositAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "currency" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    CONSTRAINT "DepositAddress_pkey" PRIMARY KEY ("id")
);

-- EngineConfig
CREATE TABLE "EngineConfig" (
    "id" TEXT NOT NULL,
    "engineType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL,
    "lastUpdatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EngineConfig_pkey" PRIMARY KEY ("id")
);

-- FacebookToken
CREATE TABLE "FacebookToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacebookToken_pkey" PRIMARY KEY ("id")
);

-- IPBlocklist
CREATE TABLE "IPBlocklist" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedBy" TEXT,
    "isAutoBlock" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "IPBlocklist_pkey" PRIMARY KEY ("id")
);

-- Investment
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "monthlyProfit" DOUBLE PRECISION NOT NULL,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "releasedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthsElapsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "endDate" TIMESTAMP(3),
    "lastProfitDate" TIMESTAMP(3),
    "mode" TEXT NOT NULL DEFAULT 'SONA',
    "lockEndDate" TIMESTAMP(3),
    "nonWithdrawableProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawableProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastWeeklyTransfer" TIMESTAMP(3),
    "lastDailyProfitDate" TIMESTAMP(3),
    "reinvested" BOOLEAN NOT NULL DEFAULT false,
    "reinvestBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poolShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poolContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- MarketingCampaign
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- P2PTransfer
CREATE TABLE "P2PTransfer" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "P2PTransfer_pkey" PRIMARY KEY ("id")
);

-- Package
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION,
    "monthlyReturn" DOUBLE PRECISION NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "dailyWithdrawalLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processingTimeHours" TEXT NOT NULL DEFAULT '1-24',
    "mode" TEXT NOT NULL DEFAULT 'BOTH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- PlatformLog
CREATE TABLE "PlatformLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "PlatformLog_pkey" PRIMARY KEY ("id")
);

-- PlatformSetting
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- Pool
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "totalFunds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeTrades" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastTradeDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- PoolContribution
CREATE TABLE "PoolContribution" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lossShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoolContribution_pkey" PRIMARY KEY ("id")
);

-- PoolTrade
CREATE TABLE "PoolTrade" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "profitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "PoolTrade_pkey" PRIMARY KEY ("id")
);

-- RedFlag
CREATE TABLE "RedFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "ip" TEXT,
    "details" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "RedFlag_pkey" PRIMARY KEY ("id")
);

-- Referral
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "reward" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- SecurityLog
CREATE TABLE "SecurityLog" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "details" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "userId" TEXT,
    "userAgent" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- SecuritySetting
CREATE TABLE "SecuritySetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SecuritySetting_pkey" PRIMARY KEY ("id")
);

-- SignalRecord
CREATE TABLE "SignalRecord" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice1" DOUBLE PRECISION,
    "targetPrice2" DOUBLE PRECISION,
    "targetPrice3" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confluenceScore" DOUBLE PRECISION,
    "regimeType" TEXT,
    "mlAgreement" TEXT,
    "bayesianConfidence" DOUBLE PRECISION,
    "smcSignal" TEXT,
    "volatilityPercentile" DOUBLE PRECISION,
    "kalmanTrend" TEXT,
    "entropyScore" DOUBLE PRECISION,
    "correlationNote" TEXT,
    "fearGreedIndex" INTEGER,
    "calibratedConfidence" DOUBLE PRECISION,
    "cooldownStatus" TEXT,
    "riskBudget" TEXT,
    "anomalyScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "SignalRecord_pkey" PRIMARY KEY ("id")
);

-- SocialAccount
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- SupportAgent
CREATE TABLE "SupportAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "specialtyEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "SupportAgent_pkey" PRIMARY KEY ("id")
);

-- SupportMessage
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL DEFAULT 'user',
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "imageUrl" TEXT,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- SupportTicket
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- SuspiciousActivity
CREATE TABLE "SuspiciousActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "SuspiciousActivity_pkey" PRIMARY KEY ("id")
);

-- TradingSession
CREATE TABLE "TradingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT 'BTC/USDT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winTrades" INTEGER NOT NULL DEFAULT 0,
    "lossTrades" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradingSession_pkey" PRIMARY KEY ("id")
);

-- Transaction
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "cryptoCurrency" TEXT,
    "cryptoNetwork" TEXT,
    "txHash" TEXT,
    "walletAddress" TEXT,
    "depositAddress" TEXT,
    "nowpaymentsId" TEXT,
    "nowpaymentsStatus" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "details" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeposited" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyCode" TEXT,
    "verifyCodeExpiry" TIMESTAMP(3),
    "kycStatus" TEXT NOT NULL DEFAULT 'NONE',
    "kycFullName" TEXT,
    "kycIdNumber" TEXT,
    "kycDocumentType" TEXT,
    "kycDocumentImage" TEXT,
    "kycSelfieImage" TEXT,
    "kycSubmittedAt" TIMESTAMP(3),
    "kycVerifiedAt" TIMESTAMP(3),
    "kycRejectReason" TEXT,
    "kycRejectCode" TEXT,
    "kycCountry" TEXT,
    "kycFrontImage" TEXT,
    "kycBackImage" TEXT,
    "kycVideoUrl" TEXT,
    "kycAiStatus" TEXT DEFAULT 'NONE',
    "kycAiResult" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredByCode" TEXT,
    "avatar" TEXT,
    "newEmail" TEXT,
    "emailChangeCode" TEXT,
    "emailChangeExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lang" TEXT NOT NULL DEFAULT 'ar',
    "withdrawableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nonWithdrawableProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lockedCapital" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenUntil" TIMESTAMP(3),
    "freezeReason" TEXT,
    "frozenAt" TIMESTAMP(3),
    "frozenBy" TEXT,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "blacklistedAt" TIMESTAMP(3),
    "redFlagCount" INTEGER NOT NULL DEFAULT 0,
    "monitoringLevel" TEXT NOT NULL DEFAULT 'NORMAL',
    "lastVPNCheck" TIMESTAMP(3),
    "vpnDetected" BOOLEAN NOT NULL DEFAULT false,
    "lastKnownIP" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- UserLoginIP
CREATE TABLE "UserLoginIP" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "isp" TEXT,
    "isVPN" BOOLEAN NOT NULL DEFAULT false,
    "isProxy" BOOLEAN NOT NULL DEFAULT false,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "UserLoginIP_pkey" PRIMARY KEY ("id")
);

-- VPNDetectionLog
CREATE TABLE "VPNDetectionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "isVPN" BOOLEAN NOT NULL,
    "isProxy" BOOLEAN NOT NULL,
    "isTor" BOOLEAN NOT NULL,
    "isp" TEXT,
    "organization" TEXT,
    "country" TEXT,
    "city" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "detectionMethod" TEXT,
    "userAgent" TEXT,
    "redFlagIssued" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "VPNDetectionLog_pkey" PRIMARY KEY ("id")
);

-- WithdrawalQueue
CREATE TABLE "WithdrawalQueue" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'AUTO_REVIEW',
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "dynamicMessage" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithdrawalQueue_pkey" PRIMARY KEY ("id")
);

-- idempotency_keys
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- rate_limit_attempts
CREATE TABLE "rate_limit_attempts" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "AccountLockout_identifier_key" ON "AccountLockout"("identifier");
CREATE UNIQUE INDEX "EngineConfig_engineType_key" ON "EngineConfig"("engineType");
CREATE UNIQUE INDEX "IPBlocklist_ip_key" ON "IPBlocklist"("ip");
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");
CREATE UNIQUE INDEX "SecuritySetting_key_key" ON "SecuritySetting"("key");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- Indexes
CREATE INDEX "idempotency_keys_key_idx" ON "idempotency_keys"("key");
CREATE INDEX "rate_limit_attempts_identifier_action_createdAt_idx" ON "rate_limit_attempts"("identifier", "action", "createdAt");

-- Foreign keys
ALTER TABLE "AccountFreeze" ADD CONSTRAINT "AccountFreeze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotTrade" ADD CONSTRAINT "BotTrade_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TradingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "SupportAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionLog" ADD CONSTRAINT "CommissionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeepAccountScan" ADD CONSTRAINT "DeepAccountScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "P2PTransfer" ADD CONSTRAINT "P2PTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "P2PTransfer" ADD CONSTRAINT "P2PTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolContribution" ADD CONSTRAINT "PoolContribution_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolTrade" ADD CONSTRAINT "PoolTrade_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedFlag" ADD CONSTRAINT "RedFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradingSession" ADD CONSTRAINT "TradingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradingSession" ADD CONSTRAINT "TradingSession_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLoginIP" ADD CONSTRAINT "UserLoginIP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VPNDetectionLog" ADD CONSTRAINT "VPNDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WithdrawalQueue" ADD CONSTRAINT "WithdrawalQueue_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
