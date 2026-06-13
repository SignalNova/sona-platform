'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log full error to server console only - never expose to users
    console.error('Dashboard Error:', error)
  }, [error])

  return (
    <div style={{ minHeight: '100dvh', background: '#030708', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, flexDirection: 'column', gap: 20 }}>
      <h2 style={{ color: '#409eff', fontSize: 20 }}>حدث خطأ غير متوقع</h2>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 400, textAlign: 'center', lineHeight: 1.8 }}>
        نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى أو التواصل مع الدعم إذا استمرت المشكلة.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '12px 32px',
          background: '#409eff',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
