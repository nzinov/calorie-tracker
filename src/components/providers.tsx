"use client"

import { SessionProvider } from "next-auth/react"
import { DayEventsProvider } from "@/contexts/day-events"
import { UserSettingsProvider } from "@/contexts/user-settings"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DayEventsProvider>
        <UserSettingsProvider>
          {children}
        </UserSettingsProvider>
      </DayEventsProvider>
    </SessionProvider>
  )
}
