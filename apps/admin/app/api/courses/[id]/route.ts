import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/courses/:id - Get course with all sections and questions
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const course = await prisma.course.findUnique({
            where: { id },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    include: {
                        questions: {
                            orderBy: { order: 'asc' },
                            include: {
                                answers: { orderBy: { order: 'asc' } }
                            }
                        }
                    }
                }
            }
        })
        if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
        return NextResponse.json(course)
    } catch (error) {
        console.error('Failed to fetch course:', error)
        return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
    }
}

// PATCH /api/courses/:id - Update course
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()

        // Convert price if provided
        if (body.price !== undefined) {
            body.price = parseFloat(String(body.price))
        }

        const course = await prisma.course.update({
            where: { id },
            data: body
        })
        return NextResponse.json(course)
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Course not found' }, { status: 404 })
        console.error('Failed to update course:', error)
        return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
    }
}

// DELETE /api/courses/:id - Delete course (cascade deletes sections, questions, answers)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await prisma.course.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Course not found' }, { status: 404 })
        console.error('Failed to delete course:', error)
        return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
    }
}
