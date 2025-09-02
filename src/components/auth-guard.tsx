"use client"

import { useSession } from "next-auth/react"
import { AuthButton } from "./auth-button"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession()

  // In development, always allow access
  if (process.env.NODE_ENV === 'development') {
    return <>{children}</>
  }

  // Show loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Calorie Tracker</h1>
            <p className="text-gray-600 mb-8">
              Track your daily nutrition and calories with AI assistance
            </p>
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
                Welcome Back
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Sign in to access your nutrition dashboard and chat with our AI assistant.
              </p>
              <div className="flex justify-center">
                <AuthButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // User is authenticated, render the protected content
  return <>{children}</>
}