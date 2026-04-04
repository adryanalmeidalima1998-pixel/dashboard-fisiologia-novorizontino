'use client'

import Sidebar from '@/components/Sidebar'

export default function FisiologiaLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
