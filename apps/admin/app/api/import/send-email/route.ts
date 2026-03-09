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

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.error("Missing SMTP configuration:", {
                SMTP_HOST: process.env.SMTP_HOST,
                SMTP_PORT: process.env.SMTP_PORT,
                SMTP_USER: process.env.SMTP_USER ? "***" : undefined,
            })
            return NextResponse.json({
                error: "Configuration SMTP manquante sur le serveur. Veuillez vérifier le fichier .env et redémarrer le serveur de développement."
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

                await sendEmail({
                    to: recipient.email,
                    subject: personalizedSubject,
                    html: personalizedBody,
                })

                results.sent++

                // Delay between emails to respect SMTP limits
                if (recipients.length > 1) {
                    await new Promise((resolve) => setTimeout(resolve, 200))
                }
            } catch (err: any) {
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
