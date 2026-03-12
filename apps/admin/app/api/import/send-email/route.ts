import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendEmail, replaceVariables } from "@/lib/mailer"

interface Recipient {
    email: string
    variables: Record<string, string>
}

interface SendEmailRequest {
    recipients: Recipient[]
    subject: string
    htmlBody: string
}

export async function POST(request: Request) {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body: SendEmailRequest = await request.json()
        const { recipients, subject, htmlBody } = body

        console.log("[send-email] Checking SMTP config...")
        const smtpConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            passSet: !!process.env.SMTP_PASSWORD,
            secure: process.env.SMTP_SECURE,
        }
        console.log("[send-email] SMTP config found:", { ...smtpConfig, user: smtpConfig.user ? "***" : undefined })

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.error("[send-email] Missing SMTP variables:", smtpConfig)
            return NextResponse.json({
                error: "Configuration SMTP manquante sur le serveur.",
                details: "Assurez-vous que SMTP_HOST, SMTP_USER et SMTP_PASSWORD sont définis dans Dokploy.",
                debug_config: {
                    host: !!process.env.SMTP_HOST,
                    user: !!process.env.SMTP_USER,
                    pass: !!process.env.SMTP_PASSWORD
                }
            }, { status: 500 })
        }

        if (!recipients || recipients.length === 0) {
            return NextResponse.json({ error: "Aucun destinataire" }, { status: 400 })
        }

        if (!subject || !htmlBody) {
            return NextResponse.json({ error: "Sujet et corps du mail requis" }, { status: 400 })
        }

        const results: { sent: number; failed: { email: string; error: string }[] } = {
            sent: 0,
            failed: [],
        }

        for (const recipient of recipients) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(recipient.email)) {
                results.failed.push({ email: recipient.email, error: "Email invalide" })
                continue
            }

            try {
                const personalizedSubject = replaceVariables(subject, recipient.variables)
                const personalizedBody = replaceVariables(htmlBody, recipient.variables)

                console.log(`[send-email] Attempting to send to ${recipient.email}`)
                console.log(`[send-email] Subject:`, personalizedSubject)
                // console.log(`[send-email] Body length:`, personalizedBody.length)

                const info = await sendEmail({
                    to: recipient.email,
                    subject: personalizedSubject,
                    html: personalizedBody,
                })
                
                console.log(`[send-email] Successfully sent to ${recipient.email}. MessageId: ${info?.messageId}`)

                results.sent++
            } catch (err: any) {
                console.error(`[send-email] Failed to send to ${recipient.email}:`, err)
                results.failed.push({
                    email: recipient.email,
                    error: err.message || "Erreur d'envoi",
                })
            }
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error("Send email error:", error)
        return NextResponse.json({ error: "Erreur lors de l'envoi des emails" }, { status: 500 })
    }
}
