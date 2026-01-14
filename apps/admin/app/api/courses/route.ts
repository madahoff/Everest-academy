import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/courses - List all courses with sections count
export async function GET() {
    try {
        const courses = await prisma.course.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { sections: true } }
            }
        })
        return NextResponse.json(courses)
    } catch (error) {
        console.error('Failed to fetch courses:', error)
        return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
    }
}

// POST /api/courses - Create new course (all fields required)
export async function POST(request: Request) {
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
