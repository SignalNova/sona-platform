import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/app/api/admin/middleware'

/**
 * GET /api/admin/ip-lookup?ip=x.x.x.x
 * Admin-only IP geolocation + VPN/Proxy detection
 * Returns: country, city, region, ISP, organization, VPN/proxy status
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ip = searchParams.get('ip')

    if (!ip) {
      return NextResponse.json({ error: 'عنوان IP مطلوب' }, { status: 400 })
    }

    // Basic IP format validation (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return NextResponse.json({ error: 'صيغة عنوان IP غير صالحة' }, { status: 400 })
    }

    // Skip private/local IPs (RFC 1918: 172.16.0.0-172.31.255.255 only)
    const is172Private = /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || is172Private || ip.startsWith('fc') || ip.startsWith('fd')) {
      return NextResponse.json({
        ip,
        country: 'Local',
        city: 'Local',
        region: 'Local',
        isp: 'Local Network',
        organization: 'Private',
        isVPN: false,
        isProxy: false,
        isTor: false,
        isSuspicious: false,
        message: 'عنوان IP محلي/خاص'
      })
    }

    // Use ip-api.com for geolocation + proxy detection (free tier)
    const ipApiResponse = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query`,
      { signal: AbortSignal.timeout(8000) }
    )

    if (!ipApiResponse.ok) {
      return NextResponse.json({ error: 'فشل الاتصال بخدمة الموقع' }, { status: 502 })
    }

    const data = await ipApiResponse.json()

    if (data.status !== 'success') {
      return NextResponse.json({ error: data.message || 'فشل في الحصول على معلومات IP' }, { status: 400 })
    }

    // Check for known datacenter/cloud provider ranges
    const isDatacenter = checkDatacenterIP(data)

    // Check Tor exit node
    const isTor = await checkTorExitNode(ip)

    // Determine if VPN/Proxy
    const isVPN = data.hosting || isDatacenter
    const isProxy = data.proxy

    // Build result
    const result = {
      ip: data.query || ip,
      country: data.country || 'Unknown',
      countryCode: data.countryCode || '',
      region: data.regionName || '',
      city: data.city || 'Unknown',
      zip: data.zip || '',
      latitude: data.lat || 0,
      longitude: data.lon || 0,
      timezone: data.timezone || '',
      isp: data.isp || 'Unknown',
      organization: data.org || 'Unknown',
      asn: data.as || '',
      isVPN,
      isProxy,
      isTor,
      isHosting: data.hosting || false,
      isDatacenter,
      isSuspicious: isVPN || isProxy || isTor,
      riskLevel: isTor ? 'HIGH' : (isVPN || isProxy) ? 'MEDIUM' : 'LOW',
    }

    // Log the lookup for audit
    const adminIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    try {
      const { db } = await import('@/lib/db')
      await db.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'IP_LOOKUP',
          targetType: 'IP',
          targetId: ip,
          details: `Looked up IP: ${ip} - ${result.country}, ${result.city} (${result.isp})`,
          ipAddress: adminIp,
        },
      })
    } catch {
      // Non-blocking audit log failure
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('IP lookup error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء البحث عن IP' }, { status: 500 })
  }
}

// Check if IP belongs to known datacenter/cloud provider ranges
function checkDatacenterIP(ipApiResult: any): boolean {
  const org = (ipApiResult.org || '').toLowerCase()
  const asn = (ipApiResult.as || '').toLowerCase()
  const isp = (ipApiResult.isp || '').toLowerCase()

  const datacenterKeywords = [
    'amazon', 'aws', 'google cloud', 'gcp', 'microsoft azure', 'azure',
    'digitalocean', 'linode', 'akamai', 'cloudflare', 'vultr', 'ovh',
    'hetzner', 'contabo', 'scaleway', 'upcloud', 'kamatera', 'choopa',
    'm247', 'psychz', 'buyvm', 'hostwinds', 'leaseweb', 'serverius',
    'datacamp', 'quadranet', 'zenlayer', 'alibaba cloud', 'tencent cloud',
    'rackspace', 'oracle cloud', 'ibm cloud',
    'hosting', 'datacenter', 'data center', 'vps', 'dedicated',
    'server', 'colocation', 'idc', 'datacentre',
  ]

  const combined = `${org} ${asn} ${isp}`
  return datacenterKeywords.some(keyword => combined.includes(keyword))
}

// Check if IP is a Tor exit node
async function checkTorExitNode(ip: string): Promise<boolean> {
  try {
    const reversedIp = ip.split('.').reverse().join('.')
    const dnsResult = await fetch(
      `https://dns.google/resolve?name=${reversedIp}.dnsel.torproject.org&type=A`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!dnsResult.ok) return false
    const data = await dnsResult.json()
    return data.Answer?.some((a: any) => a.data === '127.0.0.2') || false
  } catch {
    return false
  }
}
