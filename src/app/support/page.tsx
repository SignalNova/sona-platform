'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SupportPage as SupportPageComponent } from '@/components/platform/SupportPage'

export default function SupportRoutePage() {
  const router = useRouter()

  // If user navigates directly to /support, ensure they're logged in
  useEffect(() => {
    const token = document.cookie.includes('token=')
    if (!token) {
      router.push('/dashboard')
    }
  }, [router])

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A0F' }}>
      <SupportPageComponent />
    </div>
  )
}
