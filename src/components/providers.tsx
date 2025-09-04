"use client"

import { SessionProvider } from "next-auth/react"
import { UserSettingsProvider } from "@/contexts/user-settings"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserSettingsProvider>
        {children}
      </UserSettingsProvider>
    </SessionProvider>
  )
}
