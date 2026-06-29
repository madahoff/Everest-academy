import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { consumeMagicLink } from "@/lib/magic-link"
import bcrypt from "bcryptjs"
import type { Adapter } from "next-auth/adapters"
import type { IncomingMessage } from "http"

function getClientIp(req?: { headers?: IncomingMessage["headers"] }) {
    const forwarded = req?.headers?.["x-forwarded-for"]
    if (typeof forwarded === "string") return forwarded.split(",")[0].trim()
    if (Array.isArray(forwarded)) return forwarded[0]
    return null
}

export const authOptions: AuthOptions = {
    adapter: PrismaAdapter(prisma) as Adapter,
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
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
            id: "magic-link",
            name: "Magic Link",
            credentials: {
                token: { label: "Token", type: "text" }
            },
            async authorize(credentials, req) {
                if (!credentials?.token) return null

                const ip = getClientIp(req as any)
                const result = await consumeMagicLink({ token: credentials.token, ip })

                if (!result.ok) {
                    throw new Error("Lien invalide ou expiré")
                }

                if (result.purpose === "SIGNUP") {
                    const { name, passwordHash } = JSON.parse(result.payload ?? "{}")

                    const user = await prisma.user.upsert({
                        where: { email: result.email },
                        update: {},
                        create: {
                            email: result.email,
                            name,
                            password: passwordHash,
                            role: "STUDENT",
                            plan: "FREE",
                        }
                    })

                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        image: user.image,
                        role: user.role
                    }
                }

                // LOGIN: le mot de passe a déjà été vérifié avant l'envoi du lien
                const user = await prisma.user.findUnique({
                    where: { email: result.email }
                })

                if (!user) {
                    throw new Error("Compte introuvable")
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
                if (token) {
                    session.user.id = token.sub as string
                    session.user.role = token.role as string
                }
                if (user) {
                    session.user.id = user.id
                    session.user.role = (user as any).role
                }
            }

            // Soft session invalidation: a JWT issued before the most recent
            // password reset is no longer honored, even though the signed
            // cookie itself remains valid until its natural expiry (inherent
            // limitation of a stateless JWT strategy without a DB session store).
            if (token?.sub && typeof token.pwdChangedAt === "number") {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.sub as string },
                    select: { passwordChangedAt: true }
                })
                const currentChange = dbUser?.passwordChangedAt?.getTime() ?? 0
                if (currentChange > (token.pwdChangedAt as number)) {
                    return { ...session, user: undefined, expires: new Date(0).toISOString() } as any
                }
            }

            return session
        },
        async jwt({ token, user, account }) {
            if (user) {
                token.role = (user as any).role
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { passwordChangedAt: true }
                })
                token.pwdChangedAt = dbUser?.passwordChangedAt?.getTime() ?? 0
            }
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
