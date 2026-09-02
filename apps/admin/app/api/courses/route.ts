import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from "@/lib/require-admin"
import { courseSalesByCourse } from "@/lib/course-sales"

// GET /api/courses - Liste des cours, avec sections, inscrits et revenu généré
export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const [courses, salesByCourse] = await Promise.all([
            prisma.course.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    // `purchases` compte les personnes ayant accès : une ligne par
                    // utilisateur et par cours, qu'il ait payé, utilisé un code ou
                    // rejoint un cours gratuit.
                    _count: { select: { sections: true, purchases: true } }
                }
            }),
            courseSalesByCourse(),
        ])

        return NextResponse.json(courses.map((course) => {
            const sales = salesByCourse.get(course.id)
            const enrollments = course._count.purchases
            const paidEnrollments = sales?.paidEnrollments ?? 0

            return {
                ...course,
                enrollments,
                paidEnrollments,
                freeEnrollments: enrollments - paidEnrollments,
                revenue: sales?.revenue ?? 0,
            }
        }))
    } catch (error) {
        console.error('Failed to fetch courses:', error)
        return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
    }
}

// POST /api/courses - Create new course (all fields required)
export async function POST(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const body = await request.json()
        const { title, description, heroImage, cardImage, welcomeVideo, price, status } = body

        // Validation - all fields required
        if (!title || !description || !heroImage || !cardImage || !welcomeVideo || price === undefined) {
            return NextResponse.json({
                error: 'Tous les champs sont obligatoires: title, description, heroImage, cardImage, welcomeVideo, price'
            }, { status: 400 })
        }

        const course = await prisma.course.create({
            data: {
                title,
                description,
                heroImage,
                cardImage,
                welcomeVideo,
                price: parseFloat(String(price)) || 0,
                status: status || 'DRAFT'
            }
        })
        return NextResponse.json(course, { status: 201 })
    } catch (error) {
        console.error('Failed to create course:', error)
        return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
    }
}
