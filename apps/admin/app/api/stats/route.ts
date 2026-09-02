import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from "@/lib/require-admin"
import { parsePeriod, resolvePeriod } from "@/lib/reporting"

/**
 * GET /api/stats?period=week|month|quarter|year
 *
 * Le bloc `revenue` porte sur la période calendaire EN COURS, recalculée à chaque
 * appel : le total du mois repart de zéro le 1er, celui de l'année le 1er janvier,
 * sans aucune remise à zéro à programmer.
 */
export async function GET(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { searchParams } = new URL(request.url)
        const range = resolvePeriod(parsePeriod(searchParams.get('period')))

        const inPeriod = { createdAt: { gte: range.start, lt: range.end } }
        const inPreviousPeriod = { createdAt: { gte: range.previousStart, lt: range.previousEnd } }

        const [
            usersCount,
            coursesCount,
            productsCount,
            premiumUsersCount,
            activeCoursesCount,
            salesAgg,
            outOfStockCount,
            periodAgg,
            periodCoursesAgg,
            periodPaidCount,
            previousAgg,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.product.count(),
            prisma.user.count({ where: { plan: 'PREMIUM' } }),
            prisma.course.count({ where: { status: 'ACTIVE' } }),
            prisma.course.aggregate({ _sum: { salesCount: true } }),
            prisma.product.count({ where: { status: 'OUT_OF_STOCK' } }),
            prisma.purchase.aggregate({ where: inPeriod, _sum: { amount: true } }),
            // Part des cours : le reste du total vient des produits de la boutique.
            prisma.purchase.aggregate({ where: { ...inPeriod, courseId: { not: null } }, _sum: { amount: true } }),
            // Une inscription offerte n'est pas une vente : seules les lignes payées comptent.
            prisma.purchase.count({ where: { ...inPeriod, amount: { gt: 0 } } }),
            prisma.purchase.aggregate({ where: inPreviousPeriod, _sum: { amount: true } }),
        ])

        const conversionRate = usersCount > 0 ? ((premiumUsersCount / usersCount) * 100).toFixed(1) : '0.0'

        const total = Number(periodAgg._sum.amount ?? 0)
        const coursesRevenue = Number(periodCoursesAgg._sum.amount ?? 0)
        const previousTotal = Number(previousAgg._sum.amount ?? 0)

        return NextResponse.json({
            users: { total: usersCount, premium: premiumUsersCount, conversionRate: `${conversionRate}%` },
            courses: { total: coursesCount, active: activeCoursesCount, totalSales: salesAgg._sum.salesCount || 0 },
            products: { total: productsCount, outOfStock: outOfStockCount },
            revenue: {
                period: range.period,
                label: range.label,
                start: range.start.toISOString(),
                end: range.end.toISOString(),
                total,
                courses: coursesRevenue,
                products: total - coursesRevenue,
                sales: periodPaidCount,
                previousTotal,
                // Sans période précédente chiffrée, une variation en pourcentage
                // n'aurait aucun sens : on renvoie null et l'écran n'affiche rien.
                change: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
            },
        })
    } catch (error) {
        console.error('Failed to fetch stats:', error)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
