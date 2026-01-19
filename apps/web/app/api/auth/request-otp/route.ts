
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendOtpEmail } from "@/lib/email"
import crypto from "crypto"

export async function POST(req: Request) {
    try {
        const { email } = await req.json()

        if (!email) {
            return NextResponse.json({ error: "Email requis" }, { status: 400 })
        }

        // Generate 6-digit code
        const code = crypto.randomInt(100000, 999999).toString()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

        // Create or Update OTP
        // We use upsert to handle existing OTPs
        // Note: Prisma Schema has unique on [email, code], but we want unique on [email] logically for the valid OTP?
        // Actually, schema has @@unique([email, code]). This allows multiple codes per email if codes are different.
        // But we probably want to invalidate old codes or just let them expire.
        // Better to clean up or just create a new one.
        // The current schema definition `model Otp` doesn't enforce one OTP per email.
        // Let's just create a new one.

        // Actually, to prevent spam, we might want to delete previous OTPs for this email?
        // Or we just create a new one.

        await (prisma as any).otp.create({
            data: {
                email,
                code,
                expiresAt,
            },
        })

        // Send Email
        await sendOtpEmail({ to: email, code })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error("Error requesting OTP:", error?.message || error)
        console.error("Full error:", JSON.stringify(error, null, 2))
        return NextResponse.json({ error: error?.message || "Une erreur est survenue" }, { status: 500 })
    }
}
