"use client"

import { signIn } from "next-auth/react"

export function LoginButton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Calorie Tracker
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Track your daily nutrition with AI assistance
          </p>
        </div>
        <div>
          <button
            onClick={() => signIn("google")}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  )
}
