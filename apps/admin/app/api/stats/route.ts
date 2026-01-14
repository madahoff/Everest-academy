import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const [usersCount, coursesCount, productsCount, premiumUsersCount] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.product.count(),
            prisma.user.count({ where: { plan: 'PREMIUM' } }),
        ])
        const activeCoursesCount = await prisma.course.count({ where: { status: 'ACTIVE' } })
        const salesAgg = await prisma.course.aggregate({ _sum: { salesCount: true } })
        const outOfStockCount = await prisma.product.count({ where: { status: 'OUT_OF_STOCK' } })
        const conversionRate = usersCount > 0 ? ((premiumUsersCount / usersCount) * 100).toFixed(1) : '0.0'

        return NextResponse.json({
            users: { total: usersCount, premium: premiumUsersCount, conversionRate: `${conversionRate}%` },
            courses: { total: coursesCount, active: activeCoursesCount, totalSales: salesAgg._sum.salesCount || 0 },
            products: { total: productsCount, outOfStock: outOfStockCount }
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
