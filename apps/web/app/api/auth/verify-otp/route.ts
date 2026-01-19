import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const { email, code } = await req.json()

        if (!email || !code) {
            return NextResponse.json({ error: "Email et code requis" }, { status: 400 })
        }

        // Verify OTP
        const otpRecord = await (prisma as any).otp.findFirst({
            where: {
                email,
                code,
                expiresAt: { gt: new Date() }
            }
        })

        if (!otpRecord) {
            return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 })
        }

        // Delete OTP after verification
        await (prisma as any).otp.delete({ where: { id: otpRecord.id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error verifying OTP:", error)
        return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 })
    }
}
