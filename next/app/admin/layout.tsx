import React from 'react'
import type { Metadata } from 'next'
import AdminDarkClient from './AdminDarkClient'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Nodal Admin',
  icons: {
    icon: '/nobot.svg',
    shortcut: '/nobot.svg',
    apple: '/nobot.svg',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminDarkClient>
      {children}
    </AdminDarkClient>
  )
}


