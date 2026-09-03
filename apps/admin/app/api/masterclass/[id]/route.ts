import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { enrollPremiumMembers, parseMasterclassInput, uniqueMonthError } from "@/lib/masterclass"

export const dynamic = "force-dynamic"

/** PUT /api/masterclass/:id — modifie une séance. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params

    try {
        const parsed = parseMasterclassInput(await request.json())
        if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

        // Réduire la jauge sous le nombre de places DÉJÀ tenues afficherait « complet »
        // à des personnes inscrites et payées. On refuse plutôt que de mentir.
        if (parsed.value.capacity !== null) {
            const occupied = await prisma.masterclassRegistration.count({
                where: { masterclassId: id, status: { in: ["CONFIRMED", "ATTENDED"] } },
            })
            if (parsed.value.capacity < occupied) {
                return NextResponse.json(
                    { error: `${occupied} place(s) sont déjà attribuées : la jauge ne peut pas descendre en dessous` },
                    { status: 409 },
                )
            }
        }

        const updated = await prisma.masterclass.update({ where: { id }, data: parsed.value })

        // Passage en PUBLIÉE (ou modification d'une séance déjà publiée) : les membres
        // du Pack Premium y sont inscrits d'office. L'appel est idempotent, il peut
        // donc être fait à chaque enregistrement sans créer de doublon.
        const enrolled = await enrollPremiumMembers(updated.id)

        return NextResponse.json({ ...updated, price: Number(updated.price), premiumEnrolled: enrolled })
    } catch (error) {
        const conflict = uniqueMonthError(error)
        if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
        if ((error as { code?: string })?.code === "P2025") {
            return NextResponse.json({ error: "Masterclass introuvable" }, { status: 404 })
        }

        console.error("Failed to update masterclass:", error)
        return NextResponse.json({ error: "Failed to update masterclass" }, { status: 500 })
    }
}

/**
 * DELETE /api/masterclass/:id — supprime une séance.
 *
 * REFUSÉE dès qu'une inscription existe : supprimer emporterait l'historique des
 * participants (la relation est en cascade), et une séance qui n'a plus lieu se
 * retire de la vente en repassant en DRAFT.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    const { id } = await params

    try {
        const registrations = await prisma.masterclassRegistration.count({ where: { masterclassId: id } })
        if (registrations > 0) {
            return NextResponse.json(
                {
                    error: `Cette Masterclass compte ${registrations} inscription(s) : la supprimer effacerait l'historique. Repassez-la en brouillon pour la retirer de la vitrine.`,
                },
                { status: 409 },
            )
        }

        await prisma.masterclass.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        if ((error as { code?: string })?.code === "P2025") {
            return NextResponse.json({ error: "Masterclass introuvable" }, { status: 404 })
        }
        console.error("Failed to delete masterclass:", error)
        return NextResponse.json({ error: "Failed to delete masterclass" }, { status: 500 })
    }
}
