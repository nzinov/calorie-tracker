import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./db"

const isLocalDev = process.env.NODE_ENV === 'development'

export const authOptions = {
  adapter: isLocalDev ? undefined : PrismaAdapter(db),
  providers: isLocalDev ? [] : [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: ({ session, user }: any) => {
      if (isLocalDev) {
        return {
          user: {
            id: 'dev-user',
            name: 'Dev User',
            email: 'dev@example.com',
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      }
    },
  },
}
