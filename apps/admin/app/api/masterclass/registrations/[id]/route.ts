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

        const existing = await prisma.masterclassRegistration.findUnique({ where: { id } })
        if (!existing) return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 })

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
