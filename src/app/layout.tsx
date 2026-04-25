import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Attendance Pro',
  description: 'Premium Employee Attendance & WFH Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
