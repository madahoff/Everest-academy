import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/questions/:id - Get question with answers
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const question = await prisma.question.findUnique({
            where: { id },
            include: { answers: { orderBy: { order: 'asc' } } }
        })
        if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
        return NextResponse.json(question)
    } catch (error) {
        console.error('Failed to fetch question:', error)
        return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 })
    }
}

// PATCH /api/questions/:id - Update question and optionally answers
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const { text, order, answers } = body

        // Update question text/order
        const updateData: any = {}
        if (text !== undefined) updateData.text = text
        if (order !== undefined) updateData.order = order

        // If answers provided, replace all answers
        if (answers && Array.isArray(answers)) {
            // Validate answers
            if (answers.length < 2) {
                return NextResponse.json({ error: 'Au moins 2 réponses sont requises' }, { status: 400 })
            }
            const hasCorrect = answers.some((a: any) => a.isCorrect === true)
            if (!hasCorrect) {
                return NextResponse.json({ error: 'Au moins une réponse correcte est requise' }, { status: 400 })
            }

            // Delete existing answers and create new ones
            await prisma.answer.deleteMany({ where: { questionId: id } })
            await prisma.answer.createMany({
                data: answers.map((a: any, index: number) => ({
                    questionId: id,
                    text: a.text,
                    isCorrect: a.isCorrect === true,
                    order: a.order ?? index
                }))
            })
        }

        const question = await prisma.question.update({
            where: { id },
            data: updateData,
            include: { answers: { orderBy: { order: 'asc' } } }
        })
        return NextResponse.json(question)
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Question not found' }, { status: 404 })
        console.error('Failed to update question:', error)
        return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
    }
}

// DELETE /api/questions/:id - Delete question (cascade deletes answers)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await prisma.question.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Question not found' }, { status: 404 })
        console.error('Failed to delete question:', error)
        return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
    }
}
