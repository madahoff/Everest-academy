import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { REGISTRATION_STATUSES } from "@/lib/masterclass"
import type { RegistrationStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/masterclass/registrations/:id — change le statut d'une inscription.
 *
 * C'est le seul champ modifiable : le montant et la commande sont l'écriture d'un
 * paiement, ils ne se corrigent pas depuis une liste. Marquer ATTENDED / NO_SHOW
 * après la séance, ou CANCELLED sur désistement, est en revanche le quotidien.
 *
 * Aucun remboursement n'est déclenché ici : annuler une inscription libère la place,
 * le remboursement éventuel se traite dans la caisse.
 *
 * CONFIRMÉE est le seul statut REFUSÉ tant que la place n'est pas réglée : confirmer,
 * c'est autoriser — la personne entre dans les inscrits et reçoit l'e-mail d'accès.
 * Cette autorisation ne se donne qu'à l'encaissement, jamais d'un clic. Les statuts
 * postérieurs à la séance (A PARTICIPÉ, ABSENT) et l'annulation restent libres : ils
 * constatent un fait, ils n'ouvrent rien.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params

    try {
        const body = await request.json()
        const status = body?.status as RegistrationStatus

        if (!REGISTRATION_STATUSES.includes(status)) {
            return NextResponse.json({ error: "Statut d'inscription inconnu" }, { status: 400 })
        }

        const existing = await prisma.masterclassRegistration.findUnique({
            where: { id },
            include: {
                order: { select: { status: true, amount: true, currency: true } },
                user: { select: { name: true } },
            },
        })
        if (!existing) return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 })

        // Une place à 0 n'attend aucun règlement : séance offerte, ou membre du Pack
        // Premium dont la place a été payée avec le pack. Toute autre place exige une
        // commande ENCAISSÉE avant d'être confirmée.
        if (status === "CONFIRMED" && Number(existing.amount) > 0 && existing.order?.status !== "PAID") {
            const montant = `${Number(existing.amount).toLocaleString("fr-FR")} ${existing.currency}`
            return NextResponse.json(
                {
                    error: existing.order
                        ? `Le paiement de ${existing.user.name} n'est pas abouti (${montant}) : la commande est ${existing.order.status}. Une place ne se confirme qu'une fois encaissée.`
                        : `${existing.user.name} n'a aucune commande pour cette séance (${montant} dus). Une place ne se confirme qu'une fois encaissée.`,
                },
                { status: 409 },
            )
        }

        const now = new Date()
        const updated = await prisma.masterclassRegistration.update({
            where: { id },
            data: {
                status,
                // Les horodatages suivent le statut, pour que l'historique reste lisible
                // sans avoir à croiser la table des commandes.
                confirmedAt:
                    status === "CONFIRMED" || status === "ATTENDED" ? (existing.confirmedAt ?? now) : existing.confirmedAt,
                cancelledAt: status === "CANCELLED" ? (existing.cancelledAt ?? now) : null,
            },
        })

        return NextResponse.json({ id: updated.id, status: updated.status })
    } catch (error) {
        console.error("Failed to update registration:", error)
        return NextResponse.json({ error: "Failed to update registration" }, { status: 500 })
    }
}
