import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Vous devez être connecté pour vous inscrire" },
                { status: 401 }
            )
        }

        const { courseId } = await params

        // Check if course exists and is free
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true, price: true, title: true, sections: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 } }
        })

        if (!course) {
            return NextResponse.json(
                { error: "Cours introuvable" },
                { status: 404 }
            )
        }

        // Check if course is free (price = 0)
        if (parseFloat(course.price.toString()) > 0) {
            return NextResponse.json(
                { error: "Ce cours n'est pas gratuit" },
                { status: 400 }
            )
        }

        // Check if user already has this course
        const existingPurchase = await prisma.purchase.findFirst({
            where: {
                userId: session.user.id,
                courseId: courseId
            }
        })

        if (existingPurchase) {
            // Already enrolled, just return success with first section
            return NextResponse.json({
                success: true,
                message: "Vous êtes déjà inscrit à ce cours",
                firstSectionId: course.sections[0]?.id || null
            })
        }

        // Create a free purchase
        await prisma.purchase.create({
            data: {
                userId: session.user.id,
                courseId: courseId,
                amount: 0
            }
        })

        // Increment sales count
        await prisma.course.update({
            where: { id: courseId },
            data: { salesCount: { increment: 1 } }
        })

        return NextResponse.json({
            success: true,
            message: "Inscription réussie",
            firstSectionId: course.sections[0]?.id || null
        })

    } catch (error) {
        console.error("Enrollment error:", error)
        return NextResponse.json(
            { error: "Erreur lors de l'inscription" },
            { status: 500 }
        )
    }
}
