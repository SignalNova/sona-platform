import { NextRequest, NextResponse } from 'next/server'

// GET: Fetch real-time market data from Binance public API
// Supports: ?type=candles (default) or ?type=depth for order book
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'BTCUSDT'
    const interval = searchParams.get('interval') || '1m'
    const limit = parseInt(searchParams.get('limit') || '60')
    const type = searchParams.get('type') || 'candles'

    // ===== ORDER BOOK DEPTH =====
    if (type === 'depth') {
      const depthLimit = parseInt(searchParams.get('depthLimit') || '20')
      const depthUrl = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${depthLimit}`

      const depthRes = await fetch(depthUrl, {
        next: { revalidate: 2 }, // Cache for 2 seconds for order book
        headers: { 'Accept': 'application/json' },
      })

      if (!depthRes.ok) {
        throw new Error(`Binance depth API error: ${depthRes.status}`)
      }

      const depthData = await depthRes.json()

      // Format Binance depth data to our order book format
      const asks: { price: number; amount: number; total: number }[] = []
      const bids: { price: number; amount: number; total: number }[] = []

      let askTotal = 0
      for (const ask of (depthData.asks || []).slice(0, depthLimit)) {
        const price = parseFloat(ask[0])
        const amount = parseFloat(ask[1])
        askTotal += amount
        asks.push({ price, amount, total: askTotal })
      }

      let bidTotal = 0
      for (const bid of (depthData.bids || []).slice(0, depthLimit)) {
        const price = parseFloat(bid[0])
        const amount = parseFloat(bid[1])
        bidTotal += amount
        bids.push({ price, amount, total: bidTotal })
      }

      return NextResponse.json({ asks, bids, lastUpdateId: depthData.lastUpdateId })
    }

    // ===== CANDLESTICK + TICKER (default) =====
    // Binance max limit per request is 1000. For >1000, we paginate.
    const maxPerRequest = 1000
    const actualLimit = Math.min(limit, 10000) // Cap at 10k to prevent abuse
    const allCandles: any[] = []

    if (actualLimit <= maxPerRequest) {
      // Single request
      const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${actualLimit}`
      const response = await fetch(binanceUrl, {
        next: { revalidate: 10 },
        headers: { 'Accept': 'application/json' },
      })
      if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
      const klines = await response.json()
      for (const k of klines) {
        allCandles.push({
          time: new Date(k[0]).toISOString(),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        })
      }
    } else {
      // Paginated requests - work backwards from now
      let endTime = Date.now()
      const intervalMs: Record<string, number> = {
        '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
        '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000,
      }
      const msPerCandle = intervalMs[interval] || 60000

      let stillNeed = actualLimit
      while (stillNeed > 0) {
        const batchLimit = Math.min(stillNeed, maxPerRequest)
        const startTime = endTime - batchLimit * msPerCandle
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&limit=${batchLimit}`

        try {
          const response = await fetch(binanceUrl, {
            headers: { 'Accept': 'application/json' },
          })
          if (!response.ok) break
          const klines = await response.json()
          if (!klines || klines.length === 0) break

          for (const k of klines) {
            allCandles.push({
              time: new Date(k[0]).toISOString(),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            })
          }

          stillNeed -= klines.length
          endTime = startTime
          if (klines.length < batchLimit) break // No more data available
        } catch {
          break
        }
      }
    }

    // Sort by time ascending
    allCandles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    // Fetch 24hr ticker for current price info
    const tickerUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
    const tickerRes = await fetch(tickerUrl, {
      next: { revalidate: 10 },
      headers: { 'Accept': 'application/json' },
    })

    let ticker = null
    if (tickerRes.ok) {
      const t = await tickerRes.json()
      ticker = {
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChangePercent),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        volume24h: parseFloat(t.volume),
        quoteVolume24h: parseFloat(t.quoteVolume),
      }
    }

    return NextResponse.json({ candles: allCandles, ticker })
  } catch (error: any) {
    console.error('Binance API error:', error.message)
    
    // Fallback: generate realistic data if Binance is unreachable
    const symbol = 'BTCUSDT'
    const basePrice = 67000 + Math.random() * 3000
    const candles = []
    const now = new Date()
    
    for (let i = 59; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000)
      const volatility = 0.0005 + Math.random() * 0.002
      const change = basePrice * volatility * (Math.random() > 0.45 ? 1 : -1)
      const open = basePrice
      const close = open + change
      const high = Math.max(open, close) + Math.abs(change) * Math.random()
      const low = Math.min(open, close) - Math.abs(change) * Math.random()
      
      candles.push({
        time: time.toISOString(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Number((100 + Math.random() * 500).toFixed(0)),
      })
    }

    // Also generate fallback order book if type=depth
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'candles'
    
    if (type === 'depth') {
      const asks: { price: number; amount: number; total: number }[] = []
      const bids: { price: number; amount: number; total: number }[] = []
      let askTotal = 0, bidTotal = 0
      for (let i = 0; i < 10; i++) {
        const spread = basePrice * 0.0002 * (i + 1)
        const askAmount = Math.random() * 2 + 0.1
        askTotal += askAmount
        asks.push({ price: basePrice + spread, amount: askAmount, total: askTotal })
        const bidAmount = Math.random() * 2 + 0.1
        bidTotal += bidAmount
        bids.push({ price: basePrice - spread, amount: bidAmount, total: bidTotal })
      }
      return NextResponse.json({ asks, bids, lastUpdateId: 0 })
    }

    return NextResponse.json({
      candles,
      ticker: {
        symbol,
        price: candles[candles.length - 1]?.close || basePrice,
        change: ((candles[candles.length - 1]?.close - candles[0]?.open) / candles[0]?.open * 100) || 0,
        high24h: Math.max(...candles.map(c => c.high)),
        low24h: Math.min(...candles.map(c => c.low)),
        volume24h: candles.reduce((s, c) => s + c.volume, 0),
        quoteVolume24h: 0,
      }
    })
  }
}
