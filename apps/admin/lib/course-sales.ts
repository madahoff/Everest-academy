import { prisma } from "@/lib/prisma"

/**
 * Agrégats de recette par cours.
 *
 * La source de vérité est `Purchase.amount` — la ligne écrite au moment où l'accès est
 * réellement accordé, avec le montant effectivement payé. Un accès offert (inscription
 * gratuite, code d'accès) crée aussi une ligne, à 0 : la personne compte dans l'audience
 * du cours, mais pour aucun revenu.
 */

export interface CourseSales {
    /** Somme encaissée sur ce cours, tous accès payants confondus. */
    revenue: number
    /** Personnes ayant payé, par opposition aux accès offerts. */
    paidEnrollments: number
}

const EMPTY_SALES: CourseSales = { revenue: 0, paidEnrollments: 0 }

/** Revenu de chaque cours, en une seule requête, pour les vues de liste. */
export async function courseSalesByCourse(): Promise<Map<string, CourseSales>> {
    const rows = await prisma.purchase.groupBy({
        by: ["courseId"],
        where: { courseId: { not: null }, amount: { gt: 0 } },
        _sum: { amount: true },
        _count: { _all: true },
    })

    return new Map(
        rows.map((row) => [
            row.courseId as string,
            { revenue: Number(row._sum.amount ?? 0), paidEnrollments: row._count._all },
        ]),
    )
}

/** Revenu d'un seul cours, pour sa fiche de détail. */
export async function courseSales(courseId: string): Promise<CourseSales> {
    const agg = await prisma.purchase.aggregate({
        where: { courseId, amount: { gt: 0 } },
        _sum: { amount: true },
        _count: { _all: true },
    })

    return agg._count._all === 0
        ? EMPTY_SALES
        : { revenue: Number(agg._sum.amount ?? 0), paidEnrollments: agg._count._all }
}
