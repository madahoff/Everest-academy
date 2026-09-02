import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from "@/lib/require-admin"
import { USER_SELECT } from "@/lib/user-fields"

// GET /api/users - List all users
export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        // `select` explicite : sans lui, findMany renvoie la ligne entière — hachage de
        // mot de passe compris — à tout appelant de la console.
        //
        // Les achats de cours accompagnent chaque compte : c'est ce qui permet à
        // l'annuaire d'afficher et de modifier les accès sans une requête par ligne.
        // Un compte PREMIUM voit tout le catalogue quoi qu'il arrive (voir
        // `lib/course-access.ts`) ; `courseIds` ne porte que les accès unitaires.
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                ...USER_SELECT,
                purchases: {
                    where: { courseId: { not: null } },
                    select: { courseId: true, amount: true },
                },
            },
        })

        return NextResponse.json(users.map(({ purchases, ...user }) => ({
            ...user,
            courseIds: [...new Set(purchases.map((p) => p.courseId as string))],
            // Accès effectivement payés : les retirer efface de la recette, l'interface
            // en avertit avant d'agir.
            paidCourseIds: [...new Set(
                purchases.filter((p) => Number(p.amount) > 0).map((p) => p.courseId as string),
            )],
        })))
    } catch (error) {
        console.error('Failed to fetch users:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
}

// POST /api/users - Create new user
export async function POST(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const body = await request.json()
        const { name, email, role, plan } = body

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        const user = await prisma.user.create({
            data: { name, email, role: role || 'STUDENT', plan: plan || 'FREE' },
            select: USER_SELECT,
        })
        return NextResponse.json(user, { status: 201 })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
}
