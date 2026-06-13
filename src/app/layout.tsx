import type { Metadata, Viewport } from 'next'
import './globals.css'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sona.io'

export const metadata: Metadata = {
  title: 'SONA | منصة التداول والاستثمار',
  description: 'SONA - منصة التداول والاستثمار الذكي. تداول العملات الرقمية مع عوائد استثمارية. إشارات تداول يومية وباقات استثمارية متنوعة.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'SONA - منصة التداول والاستثمار الذكي',
    description: 'تداول واستثمر بأمان مع عوائد يومية مضمونة. إشارات تداول يومية وباقات استثمارية متنوعة مع عوائد تصل إلى 3% يومياً.',
    url: appUrl,
    siteName: 'SONA',
    images: [
      {
        url: `${appUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'SONA - Smart Trading & Investment Platform',
      }
    ],
    locale: 'ar_SA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SONA - منصة التداول والاستثمار الذكي',
    description: 'تداول واستثمر بأمان مع عوائد يومية مضمونة.',
    images: [`${appUrl}/og-image.png`],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#030708',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Preload critical images for instant display */}
        <link rel="preload" href="/sona-icon.png" as="image" />
        <link rel="preload" href="/sona-logo-square.png" as="image" />
        <link rel="preload" href="/onboarding-slide-1.png" as="image" />
        <link rel="preload" href="/onboarding-slide-2.png" as="image" />
        <link rel="preload" href="/onboarding-slide-3.png" as="image" />
        {/* Prefetch dashboard page for faster navigation from onboarding */}
        <link rel="prefetch" href="/dashboard" />
        {/* Dynamic direction: set RTL/LTR based on stored language preference */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var lang = localStorage.getItem('sona-lang') || 'ar';
              var dir = lang === 'ar' ? 'rtl' : 'ltr';
              document.documentElement.setAttribute('dir', dir);
              document.documentElement.setAttribute('lang', lang);
            } catch(e) {
              document.documentElement.setAttribute('dir', 'rtl');
            }
          })();
        `}} />
      </head>
      <body style={{ fontFamily: "'Cairo', sans-serif", background: '#030708', color: '#ffffff' }}>
        {children}
        {/* Security: Anti-tampering & anti-devtools detection */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            // Anti-right-click
            document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
            // Anti-keyboard shortcuts for dev tools
            document.addEventListener('keydown', function(e){
              if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'||e.key==='C'))||(e.ctrlKey&&e.key==='u')){e.preventDefault();}
            });
            // Anti-drag for images
            document.addEventListener('dragstart',function(e){if(e.target.tagName==='IMG')e.preventDefault();});
          })();
        `}} />
      </body>
    </html>
  )
}
