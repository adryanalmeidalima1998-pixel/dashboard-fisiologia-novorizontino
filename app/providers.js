'use client'

import { SessionProvider } from "next-auth/react"
import { DataProvider } from "./context/DataContext"

export function Providers({ children }) {
  return (
    <SessionProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </SessionProvider>
  )
}
