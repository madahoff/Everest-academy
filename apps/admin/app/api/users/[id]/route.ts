import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from "@/lib/require-admin"
import { USER_SELECT, pickUserUpdate } from "@/lib/user-fields"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json(user)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const body = await request.json()

        // Le corps n'est JAMAIS transmis tel quel à Prisma : il portait jusqu'ici
        // n'importe quel champ, `email` compris — l'identité du portefeuille dans la
        // caisse partagée. Voir EDITABLE_USER_FIELDS pour ce qui est admis, et pourquoi.
        const data = pickUserUpdate(body)
        if (!data) {
            return NextResponse.json(
                { error: 'invalid_payload', message: 'Champ non modifiable ou valeur invalide' },
                { status: 400 },
            )
        }
        if (Object.keys(data).length === 0) {
            return NextResponse.json(
                { error: 'empty_payload', message: 'Aucun champ modifiable fourni' },
                { status: 400 },
            )
        }

        const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT })
        return NextResponse.json(user)
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        await prisma.user.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 })
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
}
