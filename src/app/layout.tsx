import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Disclaimer } from '@/components/disclaimer'
import './globals.css'

export const metadata: Metadata = {
  title: 'HeizCheck',
  description: 'Prüfung von Heizkostenabrechnungen vor dem Versand an Mieter',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <Disclaimer />
      </body>
    </html>
  )
}
