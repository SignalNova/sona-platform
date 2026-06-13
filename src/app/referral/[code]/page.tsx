import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ code: string }>
}

// Sanitize referral code: only allow alphanumeric, hyphens, underscores
function sanitizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50)
}

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  return ''
}

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl

  try {
    const headersList = await headers()
    const host = headersList.get('host')
    const protocol = headersList.get('x-forwarded-proto') || 'https'
    if (host) return `${protocol}://${host}`
  } catch {
    // headers() not available
  }

  return ''
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code: rawCode } = await params
  const code = sanitizeCode(rawCode)
  const baseUrl = await getBaseUrl()
  const appUrl = baseUrl || getAppUrl() || 'https://sona.io'

  // If the code is empty after sanitization, the referral link is invalid
  if (!code) {
    return {
      title: 'SONA | منصة التداول والاستثمار الذكي',
      description: 'سجّل في منصة SONA للاستثمار الذكي واحصل على عوائد يومية مضمونة.',
    }
  }

  return {
    title: 'SONA | انضم واستثمر معنا',
    description: `سجّل في منصة SONA للاستثمار الذكي باستخدام كود الإحالة ${code} واحصل على مكافأة ترحيبية! تداول العملات الرقمية مع عوائد استثمارية يومية مضمونة.`,
    openGraph: {
      title: 'SONA | انضم واستثمر معنا',
      description: `استخدم كود الإحالة ${code} واحصل على مكافأة ترحيبية! منصة تداول واستثمار ذكي مع عوائد يومية.`,
      url: `${appUrl}/referral/${encodeURIComponent(code)}`,
      siteName: 'SONA',
      images: [
        {
          url: `${appUrl}/referral-share.png`,
          width: 1200,
          height: 630,
          alt: 'SONA - منصة التداول والاستثمار الذكي',
        }
      ],
      locale: 'ar_SA',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SONA | انضم واستثمر معنا',
      description: `استخدم كود الإحالة ${code} واحصل على مكافأة ترحيبية!`,
      images: [`${appUrl}/referral-share.png`],
    },
  }
}

export default async function ReferralLanding({ params }: Props) {
  const { code: rawCode } = await params
  const code = sanitizeCode(rawCode)
  const baseUrl = await getBaseUrl()
  const appUrl = baseUrl || getAppUrl() || ''

  // If code is empty after sanitization, redirect to home
  if (!code) {
    redirect('/')
  }

  // Use safe redirect with URL encoding - no dangerouslySetInnerHTML
  // Redirect to home page with ?ref= so unauthenticated users see the register form
  const safeRedirectUrl = appUrl
    ? `${appUrl}/?ref=${encodeURIComponent(code)}`
    : `/?ref=${encodeURIComponent(code)}`

  redirect(safeRedirectUrl)
}
