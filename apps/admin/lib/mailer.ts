import nodemailer from "nodemailer"

function getTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    })
}

interface SendEmailOptions {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
    const transporter = getTransporter()

    const appUrl = "https://academy.pro-everest.com"
    const logoUrl = "https://academy.pro-everest.com/logo-white.png"
    const currentYear = new Date().getFullYear()

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
                            ${html}
                            
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

    return transporter.sendMail({
        from: process.env.SMTP_FROM || "Everest Academy <contact@pro-everest.com>",
        to,
        subject,
        html: wrappedHtml,
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
