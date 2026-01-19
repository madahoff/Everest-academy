import NextAuth, { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { Adapter } from "next-auth/adapters"

export const authOptions: AuthOptions = {
    adapter: PrismaAdapter(prisma) as Adapter,
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true, // Permet de lier un compte Google à un compte email existant
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user || !user.password) return null

                const isValid = await bcrypt.compare(credentials.password, user.password)

                if (!isValid) return null

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role
                }
            }
        }),
        CredentialsProvider({
            id: "otp",
            name: "OTP",
            credentials: {
                email: { label: "Email", type: "email" },
                code: { label: "Code", type: "text" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.code) return null

                const { email, code } = credentials

                // 1. Verify OTP
                const otpRecord = await (prisma as any).otp.findFirst({
                    where: {
                        email,
                        code,
                        expiresAt: { gt: new Date() }
                    }
                })

                if (!otpRecord) {
                    throw new Error("Code invalide ou expiré")
                }

                // 2. Consume OTP
                await (prisma as any).otp.delete({ where: { id: otpRecord.id } })

                // 3. Find or Create User
                let user = await prisma.user.findUnique({
                    where: { email }
                })

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email,
                            name: email.split("@")[0],
                            role: "STUDENT",
                            plan: "FREE",
                        }
                    })
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role
                }
            }
        })
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // Pour Google, on vérifie/met à jour le nom si nécessaire
            if (account?.provider === "google" && profile?.name) {
                const existingUser = await prisma.user.findUnique({
                    where: { email: user.email! }
                })
                if (existingUser && !existingUser.name) {
                    await prisma.user.update({
                        where: { id: existingUser.id },
                        data: { name: profile.name }
                    })
                }
            }
            return true
        },
        async session({ session, token, user }) {
            if (session?.user) {
                // Pour JWT strategy (credentials)
                if (token) {
                    session.user.id = token.sub as string
                    session.user.role = token.role as string
                }
                // Pour database strategy (OAuth)
                if (user) {
                    session.user.id = user.id
                    session.user.role = (user as any).role
                }
            }
            return session
        },
        async jwt({ token, user, account }) {
            if (user) {
                token.role = (user as any).role
            }
            // Récupérer le rôle depuis la base si c'est un login OAuth
            if (account?.provider === "google") {
                const dbUser = await prisma.user.findUnique({
                    where: { email: token.email! }
                })
                if (dbUser) {
                    token.role = dbUser.role
                }
            }
            return token
        }
    },
    pages: {
        signIn: "/auth/login",
        signOut: "/auth/login"
    },
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

