import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function generateAccessCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = "EVEREST-"
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    code += "-"
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

export async function POST(request: Request) {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { courseId, count } = body

        if (!courseId) {
            return NextResponse.json({ error: "courseId est requis" }, { status: 400 })
        }

        if (!count || count < 1) {
            return NextResponse.json({ error: "count doit être >= 1" }, { status: 400 })
        }

        // Verify course exists
        const course = await prisma.course.findUnique({ where: { id: courseId } })
        if (!course) {
            return NextResponse.json({ error: "Cours introuvable" }, { status: 404 })
        }

        const generatedCodes: string[] = []

        for (let i = 0; i < Math.min(count, 500); i++) {
            let code = generateAccessCode()
            let attempts = 0

            // Ensure uniqueness
            while (attempts < 10) {
                const existing = await prisma.accessCode.findUnique({ where: { code } })
                if (!existing) break
                code = generateAccessCode()
                attempts++
            }

            await prisma.accessCode.create({
                data: { code, courseId },
            })

            generatedCodes.push(code)
        }

        return NextResponse.json({
            codes: generatedCodes,
            courseTitle: course.title,
            count: generatedCodes.length,
        })
    } catch (error) {
        console.error("Generate codes error:", error)
        return NextResponse.json(
            { error: "Erreur lors de la génération des codes" },
            { status: 500 }
        )
    }
}
