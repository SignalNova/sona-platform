import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isAdminRole } from '@/lib/auth'
import { securityMonitor } from '@/lib/security-monitor'
import { fortressV2 } from '@/lib/fortress-v2'
import { generateDBSecurityAudit } from '@/lib/security-monitor'
import { infrastructureStealth, dnsProtection } from '@/lib/stealth-infrastructure'
import { codeFingerprint, antiCloningSystem, obfuscationHelper } from '@/lib/anti-reverse-engineering'

// GET /api/security/dashboard - Admin-only security monitoring dashboard
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthUser(request)
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get comprehensive dashboard data
    const [dashboard, audit, environmentCheck, dnsConfig, integrityCheck] = await Promise.all([
      securityMonitor.getDashboard(),
      generateDBSecurityAudit(),
      antiCloningSystem.verifyEnvironment(),
      dnsProtection.validateDNSConfig(),
      codeFingerprint.verifyIntegrity(),
    ])

    // Get Fortress V2 metrics
    const fortressMetrics = fortressV2.getMetrics()

    // Get attack chains
    const attackChains = await securityMonitor.getAttackChains()

    // Check for debugger (anti-reverse engineering)
    const debuggerDetected = obfuscationHelper.detectDebugger()

    // Build comprehensive response
    const response = {
      timestamp: new Date().toISOString(),

      // Overall security status
      securityScore: dashboard.securityScore,
      status: dashboard.status,

      // Event statistics (24h)
      events: {
        last24h: dashboard.last24h,
        last7dTotal: dashboard.last7dTotal,
        topThreatTypes: dashboard.topThreatTypes,
      },

      // Active threats
      activeThreats: {
        blockedIPs: dashboard.blockedIPs,
        unresolvedActivities: dashboard.unresolvedActivities,
        activeAlerts: dashboard.activeAlerts.length,
        fortressV2: fortressMetrics,
      },

      // Recent critical events
      recentCriticalEvents: dashboard.recentCriticalEvents,

      // Active alerts
      alerts: dashboard.activeAlerts.slice(0, 20),

      // Attack chains
      attackChains: attackChains.slice(0, 10),

      // Fortress V2 metrics
      fortressV2: {
        recentEventCount: fortressMetrics.recentEventCount,
        activeThreats: fortressMetrics.activeThreats,
      },

      // Infrastructure security
      infrastructure: {
        environment: {
          isValid: environmentCheck.isValid,
          riskLevel: environmentCheck.riskLevel,
          checks: environmentCheck.checks,
        },
        dns: {
          isProtected: dnsConfig.isProtected,
          score: dnsConfig.score,
          checks: dnsConfig.checks,
        },
        codeIntegrity: {
          isIntact: integrityCheck.isIntact,
          tamperedFiles: integrityCheck.tamperedFiles,
          alertLevel: integrityCheck.alertLevel,
        },
        debuggerDetected,
      },

      // Audit summary
      audit: {
        securityScore: audit.securityScore,
        topThreatTypes: audit.topThreatTypes,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[SECURITY-DASHBOARD] Error generating dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to generate security dashboard' },
      { status: 500 }
    )
  }
}
