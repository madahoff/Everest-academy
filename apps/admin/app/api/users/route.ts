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
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: USER_SELECT,
        })
        return NextResponse.json(users)
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
