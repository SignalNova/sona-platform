import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const NEWS_API_KEY = process.env.NEWS_API_KEY || ''

interface NewsArticle {
  source: { name: string }
  title: string
  description: string
  url: string
  publishedAt: string
  content?: string
}

// In-memory cache for news
let cachedNews: any[] = []
let lastNewsFetch = 0
const NEWS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fetchNew = searchParams.get('fetch') === 'true'
    const userId = searchParams.get('userId')

    const now = Date.now()

    // Return cached news if available and not expired
    if (!fetchNew && cachedNews.length > 0 && now - lastNewsFetch < NEWS_CACHE_TTL) {
      return NextResponse.json({ articles: cachedNews, source: 'cache' })
    }

    // Fetch from NewsAPI
    const query = 'crypto OR bitcoin OR ethereum OR cryptocurrency'
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      if (cachedNews.length > 0) {
        return NextResponse.json({ articles: cachedNews, source: 'cache-fallback' })
      }
      return NextResponse.json({ articles: [], source: 'unavailable' })
    }

    const data = await response.json()
    const articles: NewsArticle[] = data.articles || []

    // Process articles and analyze impact
    const processedArticles = articles.map(article => {
      const impact = analyzeNewsImpact(article.title + ' ' + (article.description || ''))
      return {
        title: article.title,
        description: article.description || '',
        source: article.source?.name || 'Unknown',
        url: article.url,
        publishedAt: article.publishedAt,
        impact: impact.impact, // positive, negative, neutral
        impactScore: impact.score, // -1 to 1
        prediction: impact.prediction, // Arabic prediction text
        affectedCoins: impact.coins, // BTC, ETH, etc.
      }
    })

    cachedNews = processedArticles
    lastNewsFetch = now

    // If fetchNew and userId, create notifications for high-impact news
    if (fetchNew && userId) {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (user?.role === 'admin') {
        // Broadcast high-impact news to all users
        for (const article of processedArticles) {
          if (Math.abs(article.impactScore) >= 0.5) {
            // Check if we already sent this notification recently (within 5 min)
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
            const existing = await db.notification.findFirst({
              where: {
                type: 'NEWS',
                createdAt: { gte: fiveMinAgo },
                title: { contains: article.title.substring(0, 30) },
              },
            })

            if (!existing) {
              const users = await db.user.findMany({ where: { isActive: true }, select: { id: true } })
              await db.$transaction(
                users.map(u =>
                  db.notification.create({
                    data: {
                      userId: u.id,
                      type: 'NEWS',
                      title: article.impact === 'negative' ? 'تحذير سوقي' : 'فرصة سوقية',
                      message: article.prediction,
                      data: JSON.stringify({ url: article.url, impact: article.impact, coins: article.affectedCoins }),
                    },
                  })
                )
              )
            }
          }
        }
      }
    }

    return NextResponse.json({ articles: processedArticles, source: 'api' })
  } catch (error) {
    console.error('News API error:', error)
    if (cachedNews.length > 0) {
      return NextResponse.json({ articles: cachedNews, source: 'cache-error' })
    }
    return NextResponse.json({ articles: [], source: 'error' })
  }
}

function analyzeNewsImpact(text: string): {
  impact: 'positive' | 'negative' | 'neutral'
  score: number
  prediction: string
  coins: string[]
} {
  const lower = text.toLowerCase()
  let score = 0
  const coins: string[] = []

  // Detect mentioned coins
  if (lower.includes('bitcoin') || lower.includes('btc')) coins.push('BTC')
  if (lower.includes('ethereum') || lower.includes('eth')) coins.push('ETH')
  if (lower.includes('solana') || lower.includes('sol')) coins.push('SOL')
  if (lower.includes('binance') || lower.includes('bnb')) coins.push('BNB')
  if (lower.includes('xrp') || lower.includes('ripple')) coins.push('XRP')
  if (coins.length === 0) coins.push('BTC', 'ETH')

  // Negative keywords
  const negativeWords = ['hack', 'crash', 'ban', 'regulation', 'sec', 'fraud', 'scam', 'decline', 'drop', 'fall', 'war', 'iran', 'north korea', 'collapse', 'plunge', 'sell-off', 'bearish', 'risk', 'warning', 'threat']
  // Positive keywords
  const positiveWords = ['bullish', 'rally', 'surge', 'adoption', 'approval', 'etf', 'institutional', 'pump', 'breakthrough', 'partnership', 'upgrade', 'growth', 'milestone', 'record', 'high']

  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 0.3
  }
  for (const word of positiveWords) {
    if (lower.includes(word)) score += 0.3
  }

  // Clamp score
  score = Math.max(-1, Math.min(1, score))

  const impact = score >= 0.2 ? 'positive' : score <= -0.2 ? 'negative' : 'neutral'

  // Generate prediction
  let prediction = ''
  const coinStr = coins.join(' و ')

  if (impact === 'negative') {
    if (lower.includes('war') || lower.includes('iran')) {
      prediction = `التوترات الجيوسياسية قد تضغط على ${coinStr} - احتمال تراجع قصير المدى`
    } else if (lower.includes('sec') || lower.includes('regulation') || lower.includes('ban')) {
      prediction = `التطورات التنظيمية قد تؤثر سلباً على ${coinStr} - توخّ الحذر`
    } else {
      prediction = `أخبار سلبية قد تضغط على ${coinStr} - مراقبة السوق مطلوبة`
    }
  } else if (impact === 'positive') {
    if (lower.includes('etf') || lower.includes('approval')) {
      prediction = `موافقة متوقعة قد تدفع ${coinStr} لمستويات جديدة - فرصة شراء`
    } else if (lower.includes('adoption') || lower.includes('institutional')) {
      prediction = `تبني مؤسسي لـ ${coinStr} يشير لاتجاه صاعد - إشارة إيجابية`
    } else {
      prediction = `أخبار إيجابية قد تدعم صعود ${coinStr} - توقعات متفائلة`
    }
  } else {
    prediction = `أخبار محايدة عن ${coinStr} - لا تأثير واضح على المدى القصير`
  }

  return { impact, score, prediction, coins }
}
