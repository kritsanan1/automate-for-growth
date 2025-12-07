import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ViralWave Studio - AI Content Automation Platform',
  description: 'Automate your content creation with AI-powered tools for social media, video generation, and multi-platform publishing.',
  keywords: 'AI content generation, social media automation, video creation, content marketing',
  authors: [{ name: 'ViralWave Studio' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}