const nodemailer = require("nodemailer");

async function main() {
    const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        auth: {
            user: "contact@pro-everest.com",
            pass: process.env.SMTP_PASSWORD // We'll pass this via CLI
        }
    });

    try {
        console.log("Verifying connection...");
        await transporter.verify();
        console.log("Connection verified successfully!");

        console.log("Sending test email...");
        const info = await transporter.sendMail({
            from: "Everest Academy <contact@pro-everest.com>",
            to: process.env.TEST_EMAIL || "contact@pro-everest.com",
            subject: "Test Direct SMTP Everest",
            text: "This is a direct test email from the server bypassing Next.js app to see if Hostinger rejects the email or if it connects properly."
        });
        console.log("Message sent: %s", info.messageId);
        console.log("Full response:", info);
    } catch (error) {
        console.error("Error during SMTP test:", error);
    }
}

main();
