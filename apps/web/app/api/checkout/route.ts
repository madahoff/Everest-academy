import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // updated import path if needed, usually its valid
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        // 1. Fetch User's Cart from DB to ensure integrity
        const cartItems = await prisma.cartItem.findMany({
            where: { userId },
            include: {
                course: true,
                product: true
            }
        });

        if (cartItems.length === 0) {
            return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
        }

        // 2. Calculate Total
        let total = 0;
        const purchaseItems: any[] = [];

        for (const item of cartItems) {
            let price = 0;
            if (item.course) {
                price = Number(item.course.price);
                purchaseItems.push({ courseId: item.courseId, price });
            } else if (item.product) {
                price = Number(item.product.price);
                purchaseItems.push({ productId: item.productId, price });
            }
            total += price;
        }

        // 3. User Wallet Transaction
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        const currentBalance = Number(user?.walletBalance || 0);

        if (currentBalance < total) {
            return NextResponse.json({ error: "INSUFFICIENT_FUNDS" }, { status: 400 });
        }

        // 4. Processing Transaction (Prisma Transaction)
        await prisma.$transaction(async (tx: any) => {
            // Deduct Balance
            await tx.user.update({
                where: { id: userId },
                data: { walletBalance: currentBalance - total }
            });

            // Create Purchases
            for (const p of purchaseItems) {
                await tx.purchase.create({
                    data: {
                        userId,
                        amount: p.price,
                        courseId: p.courseId,
                        productId: p.productId
                    }
                });
            }

            // Clear Cart
            await tx.cartItem.deleteMany({
                where: { userId }
            });
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Checkout Error:", error);
        return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
    }
}
