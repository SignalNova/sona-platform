import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isAdminRole } from '@/lib/auth'
import { securityMonitor, automatedResponseSystem } from '@/lib/security-monitor'
import { fortressV2 } from '@/lib/fortress-v2'
import { blockIPInDB, unblockIPInDB, logSecurityEvent, recordSuspiciousActivity } from '@/lib/security-monitor'

// GET /api/security/incidents - List security incidents
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthUser(request)
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const url = new URL(request.url)
    const severity = url.searchParams.get('severity')
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'))

    // Get alerts from security monitor
    const alerts = securityMonitor.getAlerts()

    // Get attack chains
    const attackChains = await securityMonitor.getAttackChains()

    // Get Fortress V2 recent events
    const fortressEvents = fortressV2.eventCorrelator.getRecentEvents(24 * 60 * 60 * 1000)

    // Filter by severity if specified
    let filteredAlerts = alerts
    if (severity) {
      filteredAlerts = alerts.filter(a => a.severity === severity)
    }

    // Apply pagination
    const paginatedAlerts = filteredAlerts.slice(offset, offset + limit)

    const response = {
      timestamp: new Date().toISOString(),
      total: filteredAlerts.length,
      limit,
      offset,
      incidents: paginatedAlerts,
      attackChains: attackChains.slice(0, 20),
      fortressV2Events: fortressEvents.slice(0, 50).map(e => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        ip: e.ip,
        userId: e.userId,
        endpoint: e.endpoint,
        timestamp: e.timestamp,
        details: e.details,
      })),
      summary: {
        critical: filteredAlerts.filter(a => a.severity === 'CRITICAL').length,
        high: filteredAlerts.filter(a => a.severity === 'HIGH').length,
        medium: filteredAlerts.filter(a => a.severity === 'MEDIUM').length,
        low: filteredAlerts.filter(a => a.severity === 'LOW').length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[SECURITY-INCIDENTS] Error listing incidents:', error)
    return NextResponse.json(
      { error: 'Failed to list security incidents' },
      { status: 500 }
    )
  }
}

// POST /api/security/incidents - Create/respond to a security incident
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthUser(request)
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, ip, userId, severity, description, duration } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    let result: Record<string, any> = { action, success: true }

    switch (action) {
      case 'block_ip': {
        if (!ip) {
          return NextResponse.json({ error: 'IP address is required for block_ip action' }, { status: 400 })
        }
        const blockDuration = duration || 3600000 // Default 1 hour
        await blockIPInDB(ip, description || `Admin block by ${user.id}`, false, blockDuration)
        await logSecurityEvent({
          ip,
          type: 'ADMIN_IP_BLOCK',
          path: '/api/security/incidents',
          details: `IP blocked by admin ${user.id}: ${description || 'No reason provided'}`,
          severity: 'HIGH',
          userId: user.id,
        })
        result.message = `IP ${ip} blocked for ${Math.round(blockDuration / 60000)} minutes`
        break
      }

      case 'unblock_ip': {
        if (!ip) {
          return NextResponse.json({ error: 'IP address is required for unblock_ip action' }, { status: 400 })
        }
        await unblockIPInDB(ip)
        await logSecurityEvent({
          ip,
          type: 'ADMIN_IP_UNBLOCK',
          path: '/api/security/incidents',
          details: `IP unblocked by admin ${user.id}`,
          severity: 'MEDIUM',
          userId: user.id,
        })
        result.message = `IP ${ip} unblocked`
        break
      }

      case 'freeze_account': {
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required for freeze_account action' }, { status: 400 })
        }
        try {
          const { freezeAccount } = await import('@/lib/security-fortress')
          const freezeResult = await freezeAccount({
            userId,
            reason: description || `Admin freeze by ${user.id}`,
            frozenBy: user.id,
          })
          result = { ...result, ...freezeResult }
        } catch (error) {
          result.success = false
          result.message = 'Failed to freeze account'
        }
        break
      }

      case 'ban_account': {
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required for ban_account action' }, { status: 400 })
        }
        try {
          const { banAccount } = await import('@/lib/security-fortress')
          const banResult = await banAccount(userId, description || `Admin ban by ${user.id}`, user.id)
          result = { ...result, ...banResult }
        } catch (error) {
          result.success = false
          result.message = 'Failed to ban account'
        }
        break
      }

      case 'issue_red_flag': {
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required for issue_red_flag action' }, { status: 400 })
        }
        try {
          const { issueRedFlag } = await import('@/lib/security-fortress')
          const flagResult = await issueRedFlag({
            userId,
            reason: description || `Admin red flag by ${user.id}`,
            reasonCode: 'ADMIN_FLAG',
            ip,
            source: 'admin',
          })
          result = { ...result, ...flagResult }
        } catch (error) {
          result.success = false
          result.message = 'Failed to issue red flag'
        }
        break
      }

      case 'adjust_rate_limit': {
        if (!ip && !userId) {
          return NextResponse.json({ error: 'IP or User ID is required for adjust_rate_limit action' }, { status: 400 })
        }
        const identifier = ip || userId
        const threatLevel = severity || 'MEDIUM'
        await automatedResponseSystem.adjustRateLimit(identifier!, threatLevel as 'MEDIUM' | 'HIGH' | 'CRITICAL')
        result.message = `Rate limit adjusted for ${identifier} to ${threatLevel} level`
        break
      }

      case 'record_incident': {
        if (!severity || !description) {
          return NextResponse.json({ error: 'Severity and description are required for record_incident action' }, { status: 400 })
        }
        const incidentResult = await securityMonitor.respondToIncident({
          type: 'ADMIN_REPORTED',
          severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          ip: ip || 'unknown',
          userId,
          description,
        })
        result = { ...result, ...incidentResult }
        break
      }

      case 'preserve_evidence': {
        const incidentId = body.incidentId || `manual-${Date.now()}`
        await automatedResponseSystem.preserveEvidence(incidentId)
        result.message = `Evidence preserved for incident ${incidentId}`
        break
      }

      case 'escalate_alert': {
        const alertId = body.alertId
        if (!alertId) {
          return NextResponse.json({ error: 'Alert ID is required for escalate_alert action' }, { status: 400 })
        }
        automatedResponseSystem.escalateAlert(alertId)
        result.message = `Alert ${alertId} escalated to CRITICAL`
        break
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[SECURITY-INCIDENTS] Error processing incident:', error)
    return NextResponse.json(
      { error: 'Failed to process security incident' },
      { status: 500 }
    )
  }
}
