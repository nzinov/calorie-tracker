"use client"

import { signIn, signOut, useSession } from "next-auth/react"
import { useState } from "react"
import { UserSettingsModal } from "@/components/user-settings-modal"

export function AuthButton() {
  const { data: session, status } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (process.env.NODE_ENV === 'development') {
    return (
      <>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Open settings"
            className="flex items-center space-x-2 focus:outline-none"
          >
            <span className="text-sm text-gray-600">Dev Mode</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">D</span>
            </div>
          </button>
        </div>
        <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-pulse w-8 h-8 bg-gray-200 rounded-full"></div>
      </div>
    )
  }

  if (session?.user) {
    return (
      <>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Open settings"
            className="flex items-center space-x-2 focus:outline-none"
          >
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-gray-700">
              {session.user.name || session.user.email}
            </span>
          </button>
          <button
            onClick={() => signOut()}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
        <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    )
  }

  return (
    <button
      onClick={() => signIn('google')}
      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span>Sign in with Google</span>
    </button>
  )
}
