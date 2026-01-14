import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
        return NextResponse.json(products)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, category, price, stock } = body
        if (!name || !category) return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
        const product = await prisma.product.create({
            data: { name, category, price: price || 0, stock: stock || 0, status: stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK' }
        })
        return NextResponse.json(product, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
    }
}
