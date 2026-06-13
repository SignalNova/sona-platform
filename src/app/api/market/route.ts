import { NextResponse } from 'next/server'

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana', XRP: 'Ripple'
}

export async function GET() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]', {
      next: { revalidate: 30 }
    })
    
    if (!res.ok) {
      // Fallback prices
      return NextResponse.json({
        prices: [
          { symbol: 'BTC', name: 'Bitcoin', price: 67500, change24h: 2.5, high24h: 68000, low24h: 66500, volume: 25000000000 },
          { symbol: 'ETH', name: 'Ethereum', price: 3450, change24h: 1.8, high24h: 3500, low24h: 3400, volume: 12000000000 },
          { symbol: 'BNB', name: 'BNB', price: 580, change24h: -0.5, high24h: 590, low24h: 570, volume: 1500000000 },
          { symbol: 'SOL', name: 'Solana', price: 145, change24h: 3.2, high24h: 150, low24h: 140, volume: 3000000000 },
          { symbol: 'XRP', name: 'Ripple', price: 0.52, change24h: -1.1, high24h: 0.55, low24h: 0.50, volume: 800000000 },
        ]
      })
    }
    
    const data = await res.json()
    const prices = data.map((t: any) => ({
      symbol: t.symbol.replace('USDT', ''),
      name: CRYPTO_NAMES[t.symbol.replace('USDT', '')] || t.symbol.replace('USDT', ''),
      price: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      volume: parseFloat(t.quoteVolume),
    }))
    
    return NextResponse.json({ prices })
  } catch (error) {
    return NextResponse.json({
      prices: [
        { symbol: 'BTC', name: 'Bitcoin', price: 67500, change24h: 2.5, high24h: 68000, low24h: 66500, volume: 25000000000 },
        { symbol: 'ETH', name: 'Ethereum', price: 3450, change24h: 1.8, high24h: 3500, low24h: 3400, volume: 12000000000 },
        { symbol: 'BNB', name: 'BNB', price: 580, change24h: -0.5, high24h: 590, low24h: 570, volume: 1500000000 },
        { symbol: 'SOL', name: 'Solana', price: 145, change24h: 3.2, high24h: 150, low24h: 140, volume: 3000000000 },
        { symbol: 'XRP', name: 'Ripple', price: 0.52, change24h: -1.1, high24h: 0.55, low24h: 0.50, volume: 800000000 },
      ]
    })
  }
}
