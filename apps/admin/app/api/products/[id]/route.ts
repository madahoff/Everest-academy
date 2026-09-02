import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from "@/lib/require-admin"
import { parsePriceEur } from "@/lib/pricing"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const product = await prisma.product.findUnique({ where: { id } })
        if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        return NextResponse.json(product)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const body = await request.json()
        if (body.stock !== undefined) body.status = body.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'

        // Champ vidé : la colonne repasse à NULL et le produit n'est plus vendu à l'étranger.
        if (body.priceEur !== undefined) {
            const eur = parsePriceEur(body.priceEur)
            if ('error' in eur) return NextResponse.json({ error: eur.error }, { status: 400 })
            body.priceEur = eur.value
        }

        const product = await prisma.product.update({ where: { id }, data: body })
        return NextResponse.json(product)
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        await prisma.product.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }
}
