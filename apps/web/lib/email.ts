
import nodemailer from "nodemailer"

type SendOtpParams = {
    to: string
    code: string
}

export async function sendOtpEmail({ to, code }: SendOtpParams) {
    // If no SMTP credentials, just log it (dev mode)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.log("==========================================")
        console.log(`[DEV] Authentification OTP pour ${to}: ${code}`)
        console.log("==========================================")
        return
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    })

    await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Everest" <noreply@everest.pro>',
        to,
        subject: "Votre code de connexion Everest",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563EB;">Code de connexion</h1>
                <p>Voici votre code pour vous connecter à Everest :</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 8px;">
                    ${code}
                </div>
                <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Ce code est valide pendant 10 minutes.</p>
            </div>
        `,
    })
}
