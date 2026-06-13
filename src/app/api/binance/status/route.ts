import { NextRequest, NextResponse } from 'next/server'
import { verifyBingXConnection, getSpotBalance, getAllCoinInfo, getWithdrawalHistory, getDepositHistory } from '@/lib/bingx'
import { getAdminFromRequest } from '@/app/api/admin/middleware'

/**
 * GET /api/binance/status
 * Comprehensive BingX API diagnostic endpoint
 * SECURITY: Admin only - exposes sensitive API configuration
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    try {
      await getAdminFromRequest(request)
    } catch {
      return NextResponse.json({ error: 'غير مصرح - مطلوب صلاحيات المدير' }, { status: 403 })
    }

    const bingxApiKey = process.env.BINGX_API_KEY || process.env.BINANCE_API_KEY || ''
    const bingxSecretKey = process.env.BINGX_SECRET_KEY || process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY || ''

    // SECURITY: Don't expose API key details to the client
    const config = {
      exchange: 'BingX',
      apiKeyConfigured: !!bingxApiKey,
      secretKeyConfigured: !!bingxSecretKey,
      // REMOVED: apiKeyPrefix, apiKeyLength, secretKeyLength - information disclosure
    }

    // Get server IP
    let serverIp = 'unknown'
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipRes.json()
      serverIp = ipData.ip
    } catch {}

    // Test BingX connectivity
    const connectionResult = await verifyBingXConnection()

    // Get detailed info
    let balanceInfo: any = null
    let coinInfo: any = null
    let withdrawHistory: any = null
    let depositHistory: any = null

    if (connectionResult.success) {
      try {
        const balResult = await getSpotBalance()
        if (balResult.success && balResult.balances) {
          balanceInfo = balResult.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        }
      } catch {}

      try {
        const coinResult = await getAllCoinInfo()
        if (coinResult.success && coinResult.coins) {
          coinInfo = coinResult.coins
            .filter((c: any) => c.networkList?.some((n: any) => n.withdrawEnable))
            .map((c: any) => ({
              coin: c.coin,
              networks: c.networkList
                ?.filter((n: any) => n.withdrawEnable)
                .map((n: any) => ({
                  network: n.network,
                  withdrawFee: n.withdrawFee,
                  withdrawMin: n.withdrawMin,
                  withdrawMax: n.withdrawMax,
                })),
            }))
            .slice(0, 20)
        }
      } catch {}

      try {
        const whResult = await getWithdrawalHistory()
        if (whResult.success && whResult.withdrawals) {
          withdrawHistory = whResult.withdrawals.slice(0, 5)
        }
      } catch {}

      try {
        const dhResult = await getDepositHistory()
        if (dhResult.success && dhResult.deposits) {
          depositHistory = dhResult.deposits.slice(0, 5)
        }
      } catch {}
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      exchange: 'BingX',
      serverIp,
      connected: connectionResult.success,
      message: connectionResult.message,
      config,
      balanceInfo,
      withdrawableCoins: coinInfo,
      recentWithdrawals: withdrawHistory,
      recentDeposits: depositHistory,
      diagnosis: connectionResult.success
        ? 'BingX API متصل بنجاح! السحب التلقائي مفعّل.'
        : 'فشل الاتصال بـ BingX. تحقق من صحة المفاتيح.',
    })
  } catch (error) {
    console.error('Binance status error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
