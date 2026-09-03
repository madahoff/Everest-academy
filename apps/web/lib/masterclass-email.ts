/**
 * Envoi de la confirmation d'inscription à une Masterclass.
 *
 * Déclenché par un SEUL événement : l'inscription passe à CONFIRMED, c'est-à-dire
 * que le paiement est encaissé (ou que la séance est offerte). Jamais à l'ouverture
 * d'un paiement, jamais sur une commande en attente.
 *
 * Le gabarit vit dans `masterclass-email-template.ts`, recopié à l'identique dans la
 * console : un renvoi depuis l'administration est mot pour mot le même message.
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { renderConfirmationEmail } from "@/lib/masterclass-email-template";

/**
 * Envoie la confirmation d'une inscription et consigne l'issue sur la ligne.
 *
 * NE LÈVE JAMAIS. L'appelant est un chemin de paiement : l'argent est encaissé et la
 * place acquise, une messagerie en panne ne doit rien annuler. L'échec laisse une
 * trace lisible dans la console, d'où l'envoi peut être relancé.
 */
export async function sendMasterclassConfirmation(registrationId: string): Promise<boolean> {
    try {
        const registration = await prisma.masterclassRegistration.findUnique({
            where: { id: registrationId },
            include: {
                masterclass: true,
                user: { select: { name: true, email: true } },
                order: { select: { status: true } },
            },
        });

        if (!registration) return false;
        // Seconde garde, après celle de `confirmMasterclassRegistration` : deux sondages
        // simultanés d'une même commande ne doivent pas produire deux e-mails.
        if (registration.confirmationEmailSentAt) return true;
        if (!registration.user.email) return false;

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
        });

        if (!process.env.RESEND_API_KEY) {
            // Même parti pris qu'en développement pour les liens magiques : on trace
            // plutôt que d'échouer, et l'inscription est marquée comme notifiée.
            console.log(`[DEV] Confirmation Masterclass pour ${registration.user.email} — ${subject}`);
            await prisma.masterclassRegistration.update({
                where: { id: registrationId },
                data: { confirmationEmailSentAt: new Date(), confirmationEmailError: null },
            });
            return true;
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || '"Everest Academy" <noreply@pro-everest.com>',
            to: registration.user.email,
            subject,
            html,
        });

        if (error) throw new Error(error.message);

        await prisma.masterclassRegistration.update({
            where: { id: registrationId },
            data: { confirmationEmailSentAt: new Date(), confirmationEmailError: null },
        });
        return true;
    } catch (error) {
        const reason = error instanceof Error ? error.message : "Échec de l'envoi";
        console.error(`Confirmation Masterclass non envoyée (inscription ${registrationId})`, error);
        // L'erreur est CONSERVÉE : c'est elle qui signale le renvoi à faire en console.
        await prisma.masterclassRegistration
            .update({ where: { id: registrationId }, data: { confirmationEmailError: reason } })
            .catch(() => null);
        return false;
    }
}
