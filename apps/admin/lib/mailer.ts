import nodemailer from "nodemailer"

function getTransporter() {
    const host = process.env.SMTP_HOST || "smtp.hostinger.com"
    const port = Number(process.env.SMTP_PORT) || 465
    const secure = process.env.SMTP_SECURE !== "false" // true by default
    const user = process.env.SMTP_USER || "contact@pro-everest.com"
    const pass = process.env.SMTP_PASSWORD || ""

    console.log("[mailer] SMTP config:", { host, port, secure, user, passSet: !!pass })

    return nodemailer.createTransport({
        host,
        port,
        secure,
        requireTLS: port === 587,
        auth: { user, pass },
    })
}

interface SendEmailOptions {
    to: string
    subject: string
    html: string
}

/**
 * Convert TipTap rich HTML to email-safe inline-styled HTML.
 * Email clients strip <style> tags and class names, so we apply inline styles.
 */
function inlineEmailStyles(html: string): string {
    return html
        // Headings
        .replace(/<h1([^>]*)>/gi, '<h1$1 style="font-size:28px;font-weight:700;margin:24px 0 8px;color:#111827;line-height:1.2;">')
        .replace(/<h2([^>]*)>/gi, '<h2$1 style="font-size:22px;font-weight:700;margin:20px 0 8px;color:#111827;line-height:1.3;">')
        .replace(/<h3([^>]*)>/gi, '<h3$1 style="font-size:18px;font-weight:600;margin:16px 0 6px;color:#1f2937;line-height:1.4;">')
        // Paragraphs
        .replace(/<p([^>]*)>/gi, '<p$1 style="margin:0 0 14px;line-height:1.6;color:#374151;">')
        // Bold & Italic
        .replace(/<strong([^>]*)>/gi, '<strong$1 style="font-weight:700;">')
        .replace(/<em([^>]*)>/gi, '<em$1 style="font-style:italic;">')
        .replace(/<u([^>]*)>/gi, '<u$1 style="text-decoration:underline;">')
        // Lists
        .replace(/<ul([^>]*)>/gi, '<ul$1 style="margin:0 0 14px 0;padding-left:24px;">')
        .replace(/<ol([^>]*)>/gi, '<ol$1 style="margin:0 0 14px 0;padding-left:24px;">')
        .replace(/<li([^>]*)>/gi, '<li$1 style="margin-bottom:6px;line-height:1.6;color:#374151;">')
        // Blockquote
        .replace(/<blockquote([^>]*)>/gi, '<blockquote$1 style="margin:16px 0;padding:12px 20px;border-left:4px solid #2563EB;background:#eff6ff;color:#1e40af;font-style:italic;">')
        // Links
        .replace(/<a([^>]*)>/gi, '<a$1 style="color:#2563EB;text-decoration:underline;">')
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
    const transporter = getTransporter()

    const appUrl = "https://academy.pro-everest.com"
    const logoUrl = "https://academy.pro-everest.com/logo-white.png"
    const currentYear = new Date().getFullYear()
    const styledHtml = inlineEmailStyles(html)

    const wrappedHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin: 0 auto;">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #050505; padding: 40px 20px;">
                            <img src="${logoUrl}" alt="Everest Academy" width="180" style="display: block; width: 180px; height: auto; border: 0;" />
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                            ${styledHtml}
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px; margin-bottom: 20px;">
                                <tr>
                                    <td align="center">
                                        <a href="${appUrl}" style="background-color: #2563EB; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block;">
                                            VOTRE PLATEFORME ACADEMY
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #f3f4f6; padding: 24px; font-size: 12px; color: #6b7280; line-height: 1.5; border-top: 1px solid #e5e7eb;">
                            &copy; ${currentYear} Everest Academy. Tous droits réservés.<br/>
                            Avec Avo Razafindrazaka Champion Du Monde De Débat de La Haye en 2024 et Double Champion de Madagascar en Art Oratoire
 <br/>
                            <a href="${appUrl}" style="color: #2563EB; text-decoration: none;">academy.pro-everest.com</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    const fromEmail = process.env.SMTP_FROM || "contact@pro-everest.com"
    const fromName = "Everest Academy"

    return await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        replyTo: fromEmail,
        subject,
        text: "Pour visualiser cet email, veuillez activer l'affichage HTML dans votre messagerie.",
        html: wrappedHtml,
        headers: {
            "X-Priority": "1 (Highest)",
            "X-Mailer": "EverestMailer",
        }
    })
}

export function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{${key}\\}`, "gi")
        result = result.replace(regex, value ?? "")
    }
    return result
}
