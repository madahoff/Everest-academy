import { NextResponse } from "next/server"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { renderConfirmationEmail } from "@/lib/masterclass-email-template"

export const dynamic = "force-dynamic"

/**
 * POST /api/masterclass/registrations/:id/resend-email — renvoie la confirmation.
 *
 * Rattrapage du seul cas que la vitrine ne sait pas traiter seule : l'envoi initial a
 * échoué (messagerie indisponible, adresse momentanément rejetée). Le message est
 * rendu par le MÊME gabarit que l'envoi automatique — le destinataire reçoit le même
 * courrier, pas une reformulation.
 *
 * Réservé aux inscriptions effectivement acquises : renvoyer une « confirmation »
 * pour une place non réglée annoncerait une chose fausse.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params

    const registration = await prisma.masterclassRegistration.findUnique({
        where: { id },
        include: {
            masterclass: true,
            user: { select: { name: true, email: true } },
            order: { select: { status: true } },
        },
    })

    if (!registration) return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 })
    if (!registration.user.email) {
        return NextResponse.json({ error: "Ce compte n'a pas d'adresse e-mail" }, { status: 400 })
    }
    if (registration.status !== "CONFIRMED" && registration.status !== "ATTENDED") {
        return NextResponse.json(
            { error: "Seule une inscription confirmée peut recevoir une confirmation" },
            { status: 409 },
        )
    }

    const { subject, html } = renderConfirmationEmail({
        recipientName: registration.user.name || "",
        title: registration.masterclass.title,
        instructor: registration.masterclass.instructor,
        scheduledAt: registration.masterclass.scheduledAt,
        duration: registration.masterclass.duration,
        location: registration.masterclass.location,
        amount: Number(registration.amount),
        currency: registration.currency,
        paid: registration.order?.status === "PAID" || Number(registration.amount) === 0,
    })

    try {
        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json(
                { error: "La messagerie n'est pas configurée (RESEND_API_KEY absente)" },
                { status: 503 },
            )
        }

        const resend = new Resend(process.env.RESEND_API_KEY)
        const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || '"Everest Academy" <noreply@pro-everest.com>',
            to: registration.user.email,
            subject,
            html,
        })

        if (error) throw new Error(error.message)

        await prisma.masterclassRegistration.update({
            where: { id },
            data: { confirmationEmailSentAt: new Date(), confirmationEmailError: null },
        })

        return NextResponse.json({ success: true, sentAt: new Date().toISOString() })
    } catch (error) {
        const reason = error instanceof Error ? error.message : "Échec de l'envoi"
        // La cause est conservée sur la ligne : c'est elle qui explique à l'écran
        // pourquoi le renvoi n'aboutit pas, plutôt qu'un « erreur » sans suite.
        await prisma.masterclassRegistration
            .update({ where: { id }, data: { confirmationEmailError: reason } })
            .catch(() => null)
        return NextResponse.json({ error: reason }, { status: 502 })
    }
}
