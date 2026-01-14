import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// POST /api/redeem - Redeem an access code
export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Vous devez être connecté pour utiliser un code" }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: "Code d'accès invalide" }, { status: 400 })
    }

    // Clean and normalize the code
    const normalizedCode = code.trim().toUpperCase()

    // Find the access code
    const accessCode = await prisma.accessCode.findUnique({
        where: { code: normalizedCode },
        include: { course: true }
    })

    if (!accessCode) {
        return NextResponse.json({ error: "Code d'accès introuvable" }, { status: 404 })
    }

    if (accessCode.used) {
        return NextResponse.json({ error: "Ce code a déjà été utilisé" }, { status: 400 })
    }

    // Check if user already has access to this course
    const existingPurchase = await prisma.purchase.findFirst({
        where: {
            userId: session.user.id,
            courseId: accessCode.courseId
        }
    })

    if (existingPurchase) {
        return NextResponse.json({ error: "Vous avez déjà accès à ce cours" }, { status: 400 })
    }

    // Use a transaction to mark code as used and create purchase
    const result = await prisma.$transaction(async (tx) => {
        // Mark code as used
        await tx.accessCode.update({
            where: { id: accessCode.id },
            data: {
                used: true,
                usedById: session.user.id,
                usedAt: new Date()
            }
        })

        // Create a purchase record (amount = 0 for code redemption)
        const purchase = await tx.purchase.create({
            data: {
                userId: session.user.id,
                courseId: accessCode.courseId,
                amount: 0
            }
        })

        return { purchase, course: accessCode.course }
    })

    return NextResponse.json({
        success: true,
        message: `Accès accordé au cours "${result.course.title}"`,
        courseId: result.course.id,
        courseTitle: result.course.title
    })
}
