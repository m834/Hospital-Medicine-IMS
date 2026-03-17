/**
 * Copyright (c) 2026 Code Hustlers. All rights reserved.
 * M-IMS — Hospital Medicine Inventory Management System
 * Unauthorized use or distribution is strictly prohibited.
 */
import './globals.css'
import './print.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'M-IMS - Hospital Medicine Inventory Management System',
  description: 'Multi-tenant Hospital Medicine Inventory Management System with FIFO allocation and offline sync',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
