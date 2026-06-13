import { Suspense } from 'react'

function DashboardLoading() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#030708',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      direction: 'rtl',
      fontFamily: "'Cairo', sans-serif",
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid rgba(64,158,255,0.2)',
        borderTopColor: '#409eff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{
        fontSize: 16,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.6)',
      }}>
        جاري التحميل...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      {children}
    </Suspense>
  )
}
