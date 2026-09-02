import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from "@/lib/require-admin"
import { parsePriceEur } from "@/lib/pricing"

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
        return NextResponse.json(products)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const body = await request.json()
        const { name, category, price, priceEur, stock } = body
        if (!name || !category) return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })

        // Tarif international : facultatif, mais s'il est fourni il doit être payable.
        const eur = parsePriceEur(priceEur)
        if ('error' in eur) return NextResponse.json({ error: eur.error }, { status: 400 })

        const product = await prisma.product.create({
            data: { name, category, price: price || 0, priceEur: eur.value, stock: stock || 0, status: stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK' }
        })
        return NextResponse.json(product, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
    }
}
