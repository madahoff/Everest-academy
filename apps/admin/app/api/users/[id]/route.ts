import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json(user)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const user = await prisma.user.update({ where: { id }, data: body })
        return NextResponse.json(user)
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await prisma.user.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
}
