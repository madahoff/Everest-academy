import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { peekMagicLink, consumeMagicLink } from "@/lib/magic-link"
import { validatePassword } from "@/lib/password"
import bcrypt from "bcryptjs"

function getClientIp(req: Request) {
    return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null
}

export async function GET(req: Request) {
    const token = new URL(req.url).searchParams.get("token")

    if (!token) {
        return NextResponse.json({ valid: false })
    }

    const result = await peekMagicLink({ token })
    return NextResponse.json({ valid: result.ok && result.purpose === "RESET_PASSWORD" })
}

export async function POST(req: Request) {
    try {
        const { token, password, confirmPassword } = await req.json()

        if (!token || !password || !confirmPassword) {
            return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 })
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: "Les mots de passe ne correspondent pas" }, { status: 400 })
        }

        const passwordError = validatePassword(password)
        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 })
        }

        const ip = getClientIp(req)
        const userAgent = req.headers.get("user-agent")
        const result = await consumeMagicLink({ token, ip, userAgent })

        if (!result.ok || result.purpose !== "RESET_PASSWORD") {
            return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        await prisma.user.update({
            where: { email: result.email },
            data: { password: passwordHash, passwordChangedAt: new Date() },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error resetting password:", error)
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 })
    }
}
