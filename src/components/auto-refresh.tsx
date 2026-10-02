'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const INTERVAL_MS = 3000

/** Re-renders the page every few seconds, while work runs on the server. */
export function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [router])
  return null
}
