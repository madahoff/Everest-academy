import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json([], { status: 401 })

    try {
        const cartItems = await prisma.cartItem.findMany({
            where: { userId: session.user.id },
            include: { course: true, product: true }
        })

        const formattedItems = cartItems.map((item: any) => {
            if (item.course) {
                return {
                    id: item.courseId,
                    title: item.course.title,
                    price: parseFloat(item.course.price.toString()),
                    image: item.course.cardImage,
                    type: 'course'
                }
            } else if (item.product) {
                return {
                    id: item.productId,
                    title: item.product.name,
                    price: parseFloat(item.product.price.toString()),
                    image: null, // Product model doesn't have image field yet, usually would have
                    type: 'product'
                }
            }
            return null
        }).filter(Boolean)

        return NextResponse.json(formattedItems)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { itemId, type } = await req.json()

    try {
        if (type === 'course') {
            // Check if already in cart
            const existing = await prisma.cartItem.findFirst({
                where: { userId: session.user.id, courseId: itemId }
            })
            if (existing) return NextResponse.json({ message: "Already in cart" })

            await prisma.cartItem.create({
                data: {
                    userId: session.user.id,
                    courseId: itemId
                }
            })
        } else if (type === 'product') {
            await prisma.cartItem.create({
                data: {
                    userId: session.user.id,
                    productId: itemId
                }
            })
        }
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to add to cart" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!session?.user?.id || !id) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

    try {
        // We need to delete by courseId or productId relation
        // OR changing the logic to pass CartItem ID. 
        // But frontend sends Item ID (Course ID or Product ID).
        // Delete where courseId = id OR productId = id

        await prisma.cartItem.deleteMany({
            where: {
                userId: session.user.id,
                OR: [
                    { courseId: id },
                    { productId: id }
                ]
            }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }
}
