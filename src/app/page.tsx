'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

const slides = [
  {
    image: '/onboarding-slide-1.png',
    title: 'ابدأ رحلتك، اكتشف إمكانياتك',
    subtitle: 'نحن نقدم لك كل الأدوات اللازمة للنجاح في عالم المال والأعمال',
  },
  {
    image: '/onboarding-slide-2.png',
    title: 'أمانك أولويتنا',
    subtitle: 'منصة محمية بتشفير متقدم وأصولك في مكان آمن تماماً',
  },
  {
    image: '/onboarding-slide-3.png',
    title: 'تداول بذكاء واستثمر بثقة',
    subtitle: 'إشارات تداول يومية وباقات استثمارية مع عوائد مضمونة يومياً',
  },
]

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [fadeImage, setFadeImage] = useState(false)
  const [fadeText, setFadeText] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isTransitioning = useRef(false)

  // Mark component as mounted/hydrated
  useEffect(() => {
    setMounted(true)
  }, [])

  const goToSlide = useCallback((index: number) => {
    if (index === currentSlide || isTransitioning.current) return
    isTransitioning.current = true
    setFadeImage(true)
    setFadeText(true)
    setTimeout(() => {
      setCurrentSlide(index)
      setFadeImage(false)
      setFadeText(false)
      isTransitioning.current = false
    }, 280)
  }, [currentSlide])

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) goToSlide(currentSlide + 1)
  }, [currentSlide, goToSlide])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) goToSlide(currentSlide - 1)
  }, [currentSlide, goToSlide])

  const handleStart = useCallback(() => {
    if (navigating) return
    setNavigating(true)
    window.location.href = '/dashboard'
  }, [navigating])

  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) return
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) return
    setTouchEnd(e.targetTouches[0].clientX)
  }
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const d = touchStart - touchEnd
    if (d > 50) nextSlide()
    if (d < -50) prevSlide()
  }

  const slide = slides[currentSlide]

  // Determine button action and text
  const isLastSlide = currentSlide === slides.length - 1
  const buttonText = navigating ? 'جاري التحميل...' : (isLastSlide ? 'ابدأ الآن' : 'التالي')
  const buttonAction = isLastSlide ? handleStart : nextSlide

  return (
    <div
      style={{
        height: '100dvh',
        background: '#020609',
        display: 'flex',
        flexDirection: 'column',
        direction: 'rtl',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "'Cairo', sans-serif",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(64,158,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(64,158,255,0.015) 1px, transparent 1px)',
        backgroundSize: '60px 60px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(64,158,255,0.07) 0%, rgba(4,207,153,0.03) 40%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 20, pointerEvents: 'none' }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg, #409eff, #04cf99)',
          width: `${((currentSlide + 1) / slides.length) * 100}%`,
          transition: 'width 0.5s ease', borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 10px rgba(64,158,255,0.4)',
        }} />
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: 'max(env(safe-area-inset-top), 16px) 24px 0',
        flexShrink: 0, zIndex: 2, position: 'relative',
      }}>
        <img src="/sona-icon.png" alt="SONA" width={44} height={44}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 2px 12px rgba(64,158,255,0.35))' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span style={{
            fontSize: 24, fontWeight: 900,
            background: 'linear-gradient(135deg, #409eff, #04cf99)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: 3, lineHeight: 1.2,
          }}>SONA</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 400, letterSpacing: 0.3 }}>
            منصة تداول عملات رقمية
          </span>
        </div>
      </div>

      {/* Image - ALWAYS visible (opacity:1 by default), no loading state dependency */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 16px', minHeight: 0, position: 'relative', zIndex: 2,
      }}>
        <img
          src={slide.image}
          alt={`SONA - ${slide.title}`}
          style={{
            width: '100%', height: '100%', maxWidth: 500,
            objectFit: 'contain', objectPosition: 'center',
            opacity: fadeImage ? 0 : 1,
            transform: fadeImage ? 'scale(0.96)' : 'scale(1)',
            transition: 'opacity 0.28s ease, transform 0.28s ease',
            filter: 'drop-shadow(0 8px 30px rgba(64,158,255,0.1))',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      </div>

      {/* Text + Dots */}
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '0 28px', gap: 12, zIndex: 2, position: 'relative',
      }}>
        <h2 style={{
          fontSize: 19, fontWeight: 800,
          background: 'linear-gradient(135deg, #409eff, #04cf99)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.6, textAlign: 'center', margin: 0,
          opacity: fadeText ? 0 : 1, transform: fadeText ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}>{slide.title}</h2>
        <p style={{
          color: 'rgba(255,255,255,0.45)', fontSize: 12.5, lineHeight: 1.9,
          fontWeight: 400, textAlign: 'center', margin: 0,
          opacity: fadeText ? 0 : 1, transform: fadeText ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.3s ease 0.04s, transform 0.3s ease 0.04s',
        }}>{slide.subtitle}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', zIndex: 5 }}>
          {slides.map((_, i) => (
            <button key={i} type="button"
              onClick={(e) => { e.stopPropagation(); goToSlide(i) }}
              style={{
                width: i === currentSlide ? 28 : 8, height: 8, borderRadius: 4,
                background: i === currentSlide ? 'linear-gradient(135deg, #409eff, #04cf99)' : 'rgba(255,255,255,0.12)',
                border: 'none', cursor: 'pointer', padding: 0, zIndex: 5,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
          ))}
        </div>
      </div>

      {/* Buttons - Use <a> tag for fallback navigation even without JS hydration */}
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '20px 24px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        gap: 6, zIndex: 30, position: 'relative',
      }}>
        {/* 
          Dual approach: <a> tag works without JS, onClick works with React hydration.
          When JS hydrates, onClick takes over and prevents default <a> navigation.
          When JS doesn't hydrate, the <a> tag provides native navigation.
        */}
        <a
          href={isLastSlide ? '/dashboard' : undefined}
          onClick={(e) => {
            // When React is hydrated, use custom logic
            e.preventDefault()
            e.stopPropagation()
            buttonAction()
          }}
          style={{
            display: 'block',
            width: '100%', maxWidth: 440, padding: '14px 32px', borderRadius: 14,
            border: 'none', background: 'linear-gradient(135deg, #409eff, #04cf99)',
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: navigating ? 'wait' : 'pointer',
            fontFamily: "'Cairo', sans-serif",
            boxShadow: '0 6px 25px rgba(64,158,255,0.3)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
            zIndex: 30, touchAction: 'manipulation', opacity: navigating ? 0.7 : 1,
            textDecoration: 'none', textAlign: 'center', lineHeight: 'normal',
            boxSizing: 'border-box',
          }}
        >
          {buttonText}
        </a>
        {!isLastSlide && (
          <a
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleStart()
            }}
            style={{
              background: 'none', border: 'none',
              color: navigating ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)',
              fontSize: 12, cursor: navigating ? 'wait' : 'pointer',
              fontFamily: "'Cairo', sans-serif", padding: '6px 16px',
              zIndex: 30, touchAction: 'manipulation', opacity: navigating ? 0.5 : 1,
              textDecoration: 'none', display: 'block', textAlign: 'center',
            }}
          >تخطي</a>
        )}
      </div>

      {/* Loading overlay */}
      {navigating && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(2, 6, 9, 0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, gap: 16,
        }}>
          <div style={{
            width: 48, height: 48,
            border: '4px solid rgba(64,158,255,0.15)', borderTopColor: '#409eff',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: "'Cairo', sans-serif" }}>
            جاري تحميل المنصة...
          </span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
