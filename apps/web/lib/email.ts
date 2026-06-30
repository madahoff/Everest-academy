
import { Resend } from "resend"
import type { VerificationPurpose } from "@prisma/client"

type SendMagicLinkParams = {
    to: string
    link: string
    purpose: VerificationPurpose
}

const COPY: Record<VerificationPurpose, { subject: string; title: string; intro: string; cta: string }> = {
    SIGNUP: {
        subject: "Vérifiez votre adresse e-mail Everest",
        title: "Bienvenue chez Everest",
        intro: "Cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail et activer votre compte :",
        cta: "Vérifier mon adresse e-mail",
    },
    LOGIN: {
        subject: "Votre lien de connexion Everest",
        title: "Connexion à Everest",
        intro: "Cliquez sur le bouton ci-dessous pour vous connecter à votre compte :",
        cta: "Se connecter",
    },
    RESET_PASSWORD: {
        subject: "Réinitialisez votre mot de passe Everest",
        title: "Réinitialisation du mot de passe",
        intro: "Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :",
        cta: "Réinitialiser mon mot de passe",
    },
}

export async function sendMagicLinkEmail({ to, link, purpose }: SendMagicLinkParams) {
    const copy = COPY[purpose]
    const ttlMinutes = process.env.MAGIC_LINK_TTL_MINUTES || "15"

    // If no Resend API key, just log it (dev mode)
    if (!process.env.RESEND_API_KEY) {
        console.log("==========================================")
        console.log(`[DEV] Magic link (${purpose}) pour ${to}: ${link}`)
        console.log("==========================================")
        return
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || '"Everest" <noreply@pro-everest.com>',
        to,
        subject: copy.subject,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563EB;">${copy.title}</h1>
                <p>${copy.intro}</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${link}" style="background-color: #2563EB; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block;">
                        ${copy.cta}
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 13px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; font-size: 12px; color: #2563EB;">${link}</p>
                <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Ce lien est valide pendant ${ttlMinutes} minutes et ne peut être utilisé qu'une seule fois.</p>
                <p style="margin-top: 8px; color: #9ca3af; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
            </div>
        `,
    })

    if (error) {
        throw new Error(`Message failed: ${error.message}`)
    }
}
