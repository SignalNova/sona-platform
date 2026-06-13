import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '../middleware'
import { logAdminAction } from '@/lib/staged-withdrawal'

// ---------------------------------------------------------------------------
// Dynamic imports for engine modules outside src/
// ---------------------------------------------------------------------------

async function getEngines() {
  const { marketMover } = await import('@/server/engine/market-mover')
  const { liquidityLocker } = await import('@/server/engine/liquidity-locker')
  return { marketMover, liquidityLocker }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

interface MarketMoverUpdate {
  enabled?: boolean
  speed?: number
  intensity?: number
  maxDeviation?: number
  smoothingFactor?: number
  noiseScale?: number
}

interface LiquidityLockerUpdate {
  enabled?: boolean
  orderSize?: number
  distanceFromPrice?: number
  maxOrders?: number
  refreshInterval?: number
  autoCancelThreshold?: number
}

function validateMarketMoverUpdate(data: unknown): {
  valid: boolean
  errors: string[]
  sanitized: MarketMoverUpdate
} {
  const errors: string[] = []
  const sanitized: MarketMoverUpdate = {}

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid marketMover data'], sanitized }
  }

  const input = data as Record<string, unknown>

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') {
      errors.push('marketMover.enabled must be a boolean')
    } else {
      sanitized.enabled = input.enabled
    }
  }

  if (input.speed !== undefined) {
    const speed = Number(input.speed)
    if (isNaN(speed) || speed < 100 || speed > 5000) {
      errors.push('marketMover.speed must be between 100 and 5000')
    } else {
      sanitized.speed = clamp(speed, 100, 5000)
    }
  }

  if (input.intensity !== undefined) {
    const intensity = Number(input.intensity)
    if (isNaN(intensity) || intensity < 0.01 || intensity > 1.0) {
      errors.push('marketMover.intensity must be between 0.01 and 1.0')
    } else {
      sanitized.intensity = clamp(intensity, 0.01, 1.0)
    }
  }

  if (input.maxDeviation !== undefined) {
    const maxDeviation = Number(input.maxDeviation)
    if (isNaN(maxDeviation) || maxDeviation < 0.5 || maxDeviation > 5.0) {
      errors.push('marketMover.maxDeviation must be between 0.5 and 5.0')
    } else {
      sanitized.maxDeviation = clamp(maxDeviation, 0.5, 5.0)
    }
  }

  if (input.smoothingFactor !== undefined) {
    const smoothingFactor = Number(input.smoothingFactor)
    if (isNaN(smoothingFactor) || smoothingFactor < 0.01 || smoothingFactor > 0.5) {
      errors.push('marketMover.smoothingFactor must be between 0.01 and 0.5')
    } else {
      sanitized.smoothingFactor = clamp(smoothingFactor, 0.01, 0.5)
    }
  }

  if (input.noiseScale !== undefined) {
    const noiseScale = Number(input.noiseScale)
    if (isNaN(noiseScale) || noiseScale < 0.01 || noiseScale > 1.0) {
      errors.push('marketMover.noiseScale must be between 0.01 and 1.0')
    } else {
      sanitized.noiseScale = clamp(noiseScale, 0.01, 1.0)
    }
  }

  return { valid: errors.length === 0, errors, sanitized }
}

function validateLiquidityLockerUpdate(data: unknown): {
  valid: boolean
  errors: string[]
  sanitized: LiquidityLockerUpdate
} {
  const errors: string[] = []
  const sanitized: LiquidityLockerUpdate = {}

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid liquidityLocker data'], sanitized }
  }

  const input = data as Record<string, unknown>

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') {
      errors.push('liquidityLocker.enabled must be a boolean')
    } else {
      sanitized.enabled = input.enabled
    }
  }

  if (input.orderSize !== undefined) {
    const orderSize = Number(input.orderSize)
    if (isNaN(orderSize) || orderSize < 100 || orderSize > 100000) {
      errors.push('liquidityLocker.orderSize must be between 100 and 100000')
    } else {
      sanitized.orderSize = clamp(orderSize, 100, 100000)
    }
  }

  if (input.distanceFromPrice !== undefined) {
    const distanceFromPrice = Number(input.distanceFromPrice)
    if (isNaN(distanceFromPrice) || distanceFromPrice < 0.05 || distanceFromPrice > 2.0) {
      errors.push('liquidityLocker.distanceFromPrice must be between 0.05 and 2.0')
    } else {
      sanitized.distanceFromPrice = clamp(distanceFromPrice, 0.05, 2.0)
    }
  }

  if (input.maxOrders !== undefined) {
    const maxOrders = Number(input.maxOrders)
    if (isNaN(maxOrders) || maxOrders < 1 || maxOrders > 10) {
      errors.push('liquidityLocker.maxOrders must be between 1 and 10')
    } else {
      sanitized.maxOrders = clamp(maxOrders, 1, 10)
    }
  }

  if (input.refreshInterval !== undefined) {
    const refreshInterval = Number(input.refreshInterval)
    if (isNaN(refreshInterval) || refreshInterval < 1000 || refreshInterval > 30000) {
      errors.push('liquidityLocker.refreshInterval must be between 1000 and 30000')
    } else {
      sanitized.refreshInterval = clamp(refreshInterval, 1000, 30000)
    }
  }

  if (input.autoCancelThreshold !== undefined) {
    const autoCancelThreshold = Number(input.autoCancelThreshold)
    if (isNaN(autoCancelThreshold) || autoCancelThreshold < 0.01 || autoCancelThreshold > 0.5) {
      errors.push('liquidityLocker.autoCancelThreshold must be between 0.01 and 0.5')
    } else {
      sanitized.autoCancelThreshold = clamp(autoCancelThreshold, 0.01, 0.5)
    }
  }

  return { valid: errors.length === 0, errors, sanitized }
}

// ---------------------------------------------------------------------------
// Volume data helper — queries last 24h transactions
// ---------------------------------------------------------------------------

async function getVolumeData() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [buyResult, sellResult] = await Promise.all([
    db.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'DEPOSIT',
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'WITHDRAWAL',
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
  ])

  const buyVolume = buyResult._sum.amount ?? 0
  const sellVolume = sellResult._sum.amount ?? 0

  return { buyVolume, sellVolume }
}

// ---------------------------------------------------------------------------
// GET /api/admin/engine-controls
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await getAdminFromRequest(request)

    // Load engines dynamically
    const { marketMover, liquidityLocker } = await getEngines()

    // Fetch volume data from database
    const { buyVolume, sellVolume } = await getVolumeData()

    // Calculate volume imbalance
    const volumeImbalance = marketMover.calculateVolumeImbalance(buyVolume, sellVolume)

    return NextResponse.json({
      marketMover: marketMover.getStatus(),
      liquidityLocker: liquidityLocker.getStatus(),
      volumeImbalance,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[ENGINE-CONTROLS] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve engine status' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/engine-controls
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await getAdminFromRequest(request)

    // Parse request body
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { marketMover: mmData, liquidityLocker: llData } = body

    // Validate inputs
    const allErrors: string[] = []
    let sanitizedMM: MarketMoverUpdate = {}
    let sanitizedLL: LiquidityLockerUpdate = {}

    if (mmData !== undefined) {
      const mmResult = validateMarketMoverUpdate(mmData)
      if (!mmResult.valid) {
        allErrors.push(...mmResult.errors)
      }
      sanitizedMM = mmResult.sanitized
    }

    if (llData !== undefined) {
      const llResult = validateLiquidityLockerUpdate(llData)
      if (!llResult.valid) {
        allErrors.push(...llResult.errors)
      }
      sanitizedLL = llResult.sanitized
    }

    // If no updates provided at all
    if (mmData === undefined && llData === undefined) {
      return NextResponse.json(
        { error: 'No engine updates provided. Supply marketMover and/or liquidityLocker fields.' },
        { status: 400 }
      )
    }

    // Return validation errors if any
    if (allErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: allErrors },
        { status: 400 }
      )
    }

    // Load engines dynamically
    const { marketMover, liquidityLocker } = await getEngines()

    // Apply updates
    if (Object.keys(sanitizedMM).length > 0) {
      marketMover.updateConfig(sanitizedMM)
    }

    if (Object.keys(sanitizedLL).length > 0) {
      liquidityLocker.updateConfig(sanitizedLL)
    }

    // Capture request metadata for audit log
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Log the admin action with full details
    const changes: Record<string, unknown> = {}
    if (Object.keys(sanitizedMM).length > 0) {
      changes.marketMover = sanitizedMM
    }
    if (Object.keys(sanitizedLL).length > 0) {
      changes.liquidityLocker = sanitizedLL
    }

    await logAdminAction({
      adminId: admin.id,
      action: 'UPDATE_ENGINE_CONTROLS',
      targetType: 'ENGINE',
      details: JSON.stringify(changes),
      ipAddress,
      userAgent,
    })

    // Return updated status
    const { buyVolume, sellVolume } = await getVolumeData()
    const volumeImbalance = marketMover.calculateVolumeImbalance(buyVolume, sellVolume)

    return NextResponse.json({
      message: 'Engine controls updated successfully',
      marketMover: marketMover.getStatus(),
      liquidityLocker: liquidityLocker.getStatus(),
      volumeImbalance,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('غير مصرح') || error.message.includes('مطلوب'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[ENGINE-CONTROLS] PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update engine controls' },
      { status: 500 }
    )
  }
}
