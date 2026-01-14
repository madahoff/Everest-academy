import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/sections/:id - Get section with questions
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const section = await prisma.section.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: { answers: { orderBy: { order: 'asc' } } }
                }
            }
        })
        if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
        return NextResponse.json(section)
    } catch (error) {
        console.error('Failed to fetch section:', error)
        return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 })
    }
}

// PATCH /api/sections/:id - Update section
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { questions, course, ...data } = await request.json()
        const section = await prisma.section.update({
            where: { id },
            data
        })
        return NextResponse.json(section)
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Section not found' }, { status: 404 })
        console.error('Failed to update section:', error)
        return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
    }
}

// DELETE /api/sections/:id - Delete section (cascade deletes questions, answers)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await prisma.section.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Section not found' }, { status: 404 })
        console.error('Failed to delete section:', error)
        return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 })
    }
}
