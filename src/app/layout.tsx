import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DMARC Reports',
  description: 'Automated DMARC report analysis and monitoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
