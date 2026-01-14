import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/sections/:id/questions - List questions of a section
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const questions = await prisma.question.findMany({
            where: { sectionId: id },
            orderBy: { order: 'asc' },
            include: { answers: { orderBy: { order: 'asc' } } }
        })
        return NextResponse.json(questions)
    } catch (error) {
        console.error('Failed to fetch questions:', error)
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }
}

// POST /api/sections/:id/questions - Create question with answers
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: sectionId } = await params
        const body = await request.json()
        const { text, answers, order } = body

        // Validation
        if (!text) {
            return NextResponse.json({ error: 'Le texte de la question est obligatoire' }, { status: 400 })
        }
        if (!answers || !Array.isArray(answers) || answers.length < 2) {
            return NextResponse.json({ error: 'Au moins 2 réponses sont requises' }, { status: 400 })
        }

        // Validate each answer
        for (const answer of answers) {
            if (!answer.text) {
                return NextResponse.json({ error: 'Chaque réponse doit avoir un texte' }, { status: 400 })
            }
        }

        // Check at least one correct answer
        const hasCorrect = answers.some((a: any) => a.isCorrect === true)
        if (!hasCorrect) {
            return NextResponse.json({ error: 'Au moins une réponse correcte est requise' }, { status: 400 })
        }

        // Get next order if not provided
        let questionOrder = order
        if (questionOrder === undefined) {
            const maxOrder = await prisma.question.findFirst({
                where: { sectionId },
                orderBy: { order: 'desc' },
                select: { order: true }
            })
            questionOrder = (maxOrder?.order ?? -1) + 1
        }

        // Create question with answers
        const question = await prisma.question.create({
            data: {
                sectionId,
                text,
                order: questionOrder,
                answers: {
                    create: answers.map((a: any, index: number) => ({
                        text: a.text,
                        isCorrect: a.isCorrect === true,
                        order: a.order ?? index
                    }))
                }
            },
            include: { answers: true }
        })

        return NextResponse.json(question, { status: 201 })
    } catch (error) {
        console.error('Failed to create question:', error)
        return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
    }
}
