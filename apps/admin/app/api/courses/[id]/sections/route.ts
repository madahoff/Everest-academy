import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/courses/:id/sections - List sections of a course
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const sections = await prisma.section.findMany({
            where: { courseId: id },
            orderBy: { order: 'asc' },
            include: {
                _count: { select: { questions: true } }
            }
        })
        return NextResponse.json(sections)
    } catch (error) {
        console.error('Failed to fetch sections:', error)
        return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
    }
}

// POST /api/courses/:id/sections - Create section (all fields required)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: courseId } = await params
        const body = await request.json()
        const { title, description, heroImage, cardImage, video, summary, order } = body

        // Validation - all fields required
        if (!title || !description || !heroImage || !cardImage || !video || !summary) {
            return NextResponse.json({
                error: 'Tous les champs sont obligatoires: title, description, heroImage, cardImage, video, summary'
            }, { status: 400 })
        }

        // Get next order if not provided
        let sectionOrder = order
        if (sectionOrder === undefined) {
            const maxOrder = await prisma.section.findFirst({
                where: { courseId },
                orderBy: { order: 'desc' },
                select: { order: true }
            })
            sectionOrder = (maxOrder?.order ?? -1) + 1
        }

        const section = await prisma.section.create({
            data: {
                courseId,
                title,
                description,
                heroImage,
                cardImage,
                video,
                summary,
                order: sectionOrder
            }
        })
        return NextResponse.json(section, { status: 201 })
    } catch (error) {
        console.error('Failed to create section:', error)
        return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
    }
}
