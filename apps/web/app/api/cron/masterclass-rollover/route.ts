import { NextResponse } from "next/server";
import { rolloverMasterclasses } from "@/lib/masterclass";
import { currentMonthKey, nextMonthKey } from "@/lib/masterclass-month";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/masterclass-rollover — bascule mensuelle, à appeler le 1er de
 * chaque mois par un ordonnanceur (cron système, Dokploy, GitHub Actions…).
 *
 * ELLE N'EST PAS INDISPENSABLE, et c'est délibéré : la « prochaine Masterclass »
 * affichée par la vitrine est la première séance publiée encore à venir, calculée à
 * chaque requête. Un ordonnanceur en panne ne peut donc pas laisser le site annoncer
 * une session écoulée. Cette route ne fait que deux choses, toutes deux rattrapables
 * et idempotentes :
 *
 *  - archiver les séances passées, pour que la console distingue d'un coup d'œil la
 *    session en cours des anciennes ;
 *  - clore les inscriptions restées en attente de paiement sur une séance tenue.
 *
 * L'historique n'est JAMAIS supprimé : aucune inscription n'est effacée, seuls des
 * statuts changent.
 *
 * Protection : en-tête `Authorization: Bearer <CRON_SECRET>`. Sans `CRON_SECRET`
 * configuré, la route est refusée plutôt qu'ouverte — un point d'écriture non
 * authentifié sur Internet ne s'active pas par défaut.
 */
export async function POST(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: "cron_not_configured", message: "CRON_SECRET n'est pas configuré" },
            { status: 503 },
        );
    }

    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
        return NextResponse.json({ error: "unauthorized", message: "Jeton de tâche invalide" }, { status: 401 });
    }

    const result = await rolloverMasterclasses();

    // Ce que l'ordonnanceur a besoin de savoir : la session du mois est-elle prête ?
    // Un mois sans séance publiée n'est pas une erreur — c'est une alerte à lire.
    const monthKey = currentMonthKey();
    const [current, upcoming] = await Promise.all([
        prisma.masterclass.findUnique({ where: { monthKey }, select: { id: true, title: true, status: true } }),
        prisma.masterclass.findFirst({
            where: { status: "PUBLISHED", scheduledAt: { gte: new Date() } },
            orderBy: { scheduledAt: "asc" },
            select: { id: true, monthKey: true, title: true, scheduledAt: true },
        }),
    ]);

    return NextResponse.json({
        ...result,
        currentMonth: { monthKey, masterclass: current },
        nextMonthKey: nextMonthKey(monthKey),
        upcoming,
        // Aucune séance publiée à venir : la vitrine n'a rien à annoncer.
        warning: upcoming ? null : "Aucune Masterclass publiée à venir",
    });
}
