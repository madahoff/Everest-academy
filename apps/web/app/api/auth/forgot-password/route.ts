import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendMagicLinkEmail } from "@/lib/email"
import { createMagicLink, MagicLinkRateLimitError } from "@/lib/magic-link"

function getClientIp(req: Request) {
    return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null
}

const GENERIC_RESPONSE = { success: true, message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation." }

export async function POST(req: Request) {
    try {
        const { email } = await req.json()

        if (!email) {
            return NextResponse.json({ error: "Email requis" }, { status: 400 })
        }

        const ip = getClientIp(req)
        const user = await prisma.user.findUnique({ where: { email } })

        // Always return the same generic response whether or not the account
        // exists, to prevent account enumeration. Rate-limit/cooldown errors
        // are swallowed here too (they're still recorded in AuthAuditLog).
        if (user) {
            try {
                const { token } = await createMagicLink({ email, purpose: "RESET_PASSWORD", ip })
                const link = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`
                await sendMagicLinkEmail({ to: email, link, purpose: "RESET_PASSWORD" })
            } catch (error) {
                if (!(error instanceof MagicLinkRateLimitError)) {
                    console.error("Error requesting password reset link:", error)
                }
            }
        }

        return NextResponse.json(GENERIC_RESPONSE)
    } catch (error) {
        console.error("Error in forgot-password:", error)
        return NextResponse.json(GENERIC_RESPONSE)
    }
}
