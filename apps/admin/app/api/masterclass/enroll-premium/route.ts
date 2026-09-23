import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { enrollAllPremiumMembers } from "@/lib/masterclass"

export const dynamic = "force-dynamic"

/**
 * POST /api/masterclass/enroll-premium — rattrapage : inscrit tous les membres du Pack
 * Premium à toutes les séances publiées à venir.
 *
 * Les automatismes couvrent désormais les deux sens (séance publiée après l'octroi du
 * pack, pack accordé après la publication d'une séance). Cette route sert aux comptes
 * passés en Premium AVANT qu'ils n'existent, et de filet si l'un d'eux a échoué.
 *
 * Idempotente : aucune inscription existante n'est touchée, aucun e-mail n'est envoyé.
 * Relancée, elle répond simplement « 0 créée ».
 */
export async function POST() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const report = await enrollAllPremiumMembers()
        return NextResponse.json(report)
    } catch (error) {
        console.error("Failed to enroll premium members:", error)
        return NextResponse.json(
            { error: "Échec de l'inscription des membres Premium" },
            { status: 500 },
        )
    }
}
