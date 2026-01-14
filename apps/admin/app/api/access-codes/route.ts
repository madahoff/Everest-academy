import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

// Helper function to generate a unique access code
function generateAccessCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid ambiguous chars like 0/O, 1/I/L
    let code = 'EVEREST-'
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    code += '-'
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// GET /api/access-codes?courseId=xxx - List all access codes for a course
export async function GET(request: Request) {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get("courseId")

    if (!courseId) {
        return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    const accessCodes = await prisma.accessCode.findMany({
        where: { courseId },
        include: {
            usedBy: {
                select: { id: true, name: true, email: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(accessCodes)
}

// POST /api/access-codes - Generate a new access code
export async function POST(request: Request) {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { courseId, count = 1 } = body

    if (!courseId) {
        return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Generate unique codes
    const generatedCodes = []
    for (let i = 0; i < Math.min(count, 100); i++) { // Max 100 codes at once
        let code = generateAccessCode()
        let attempts = 0

        // Ensure uniqueness
        while (attempts < 10) {
            const existing = await prisma.accessCode.findUnique({ where: { code } })
            if (!existing) break
            code = generateAccessCode()
            attempts++
        }

        const accessCode = await prisma.accessCode.create({
            data: {
                code,
                courseId
            }
        })
        generatedCodes.push(accessCode)
    }

    return NextResponse.json(generatedCodes)
}
