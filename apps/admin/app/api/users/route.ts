import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users - List all users
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(users)
    } catch (error) {
        console.error('Failed to fetch users:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
}

// POST /api/users - Create new user
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, email, role, plan } = body

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        const user = await prisma.user.create({
            data: { name, email, role: role || 'STUDENT', plan: plan || 'FREE' }
        })
        return NextResponse.json(user, { status: 201 })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
}
