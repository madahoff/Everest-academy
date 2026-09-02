import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth.config"
import { resolvePrice } from "@/lib/pricing"
import { getRequestCurrency } from "@/lib/request-currency"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json([], { status: 401 })

    try {
        // Le panier est chiffré dans la devise du visiteur. `price` peut être null :
        // l'article n'a pas de tarif dans cette devise, le règlement le refusera —
        // autant le dire dès l'affichage plutôt qu'au moment de payer.
        const currency = await getRequestCurrency()

        const cartItems = await prisma.cartItem.findMany({
            where: { userId: session.user.id },
            include: { course: true, product: true }
        })

        const formattedItems = cartItems.map((item: any) => {
            if (item.course) {
                const view = resolvePrice(
                    { price: item.course.price.toString(), priceEur: item.course.priceEur?.toString() },
                    currency,
                )
                return {
                    id: item.courseId,
                    title: item.course.title,
                    price: view.amount,
                    currency,
                    available: view.amount !== null,
                    image: item.course.cardImage,
                    type: 'course'
                }
            } else if (item.product) {
                const view = resolvePrice(
                    { price: item.product.price.toString(), priceEur: item.product.priceEur?.toString() },
                    currency,
                )
                return {
                    id: item.productId,
                    title: item.product.name,
                    price: view.amount,
                    currency,
                    available: view.amount !== null,
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
