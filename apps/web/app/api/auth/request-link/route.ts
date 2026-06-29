import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendMagicLinkEmail } from "@/lib/email"
import { createMagicLink, MagicLinkRateLimitError } from "@/lib/magic-link"
import { validatePassword } from "@/lib/password"
import bcrypt from "bcryptjs"

function getClientIp(req: Request) {
    return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null
}

// Only allow same-origin relative paths to prevent open-redirect via the magic link
function sanitizeCallbackUrl(callbackUrl: unknown) {
    if (typeof callbackUrl !== "string") return null
    if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return null
    return callbackUrl
}

export async function POST(req: Request) {
    try {
        const { email, purpose, name, password, callbackUrl } = await req.json()
        const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl)

        if (!email || (purpose !== "SIGNUP" && purpose !== "LOGIN")) {
            return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
        }

        const ip = getClientIp(req)
        let payload: Record<string, unknown> | undefined

        if (purpose === "SIGNUP") {
            if (!name || !password) {
                return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 })
            }

            const passwordError = validatePassword(password)
            if (passwordError) {
                return NextResponse.json({ error: passwordError }, { status: 400 })
            }

            const existingUser = await prisma.user.findUnique({ where: { email } })
            if (existingUser) {
                return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 })
            }

            const passwordHash = await bcrypt.hash(password, 10)
            payload = { name, passwordHash }
        } else {
            if (!password) {
                return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 })
            }

            const user = await prisma.user.findUnique({ where: { email } })
            const isValid = user?.password ? await bcrypt.compare(password, user.password) : false

            if (!user || !isValid) {
                return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 400 })
            }
        }

        const { token } = await createMagicLink({ email, purpose, payload, ip })
        const link = `${process.env.NEXTAUTH_URL}/auth/verify?token=${token}${safeCallbackUrl ? `&callbackUrl=${encodeURIComponent(safeCallbackUrl)}` : ""}`

        await sendMagicLinkEmail({ to: email, link, purpose })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error instanceof MagicLinkRateLimitError) {
            return NextResponse.json(
                { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
                { status: 429 }
            )
        }
        console.error("Error requesting magic link:", error?.message || error)
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 })
    }
}
