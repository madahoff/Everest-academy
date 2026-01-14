import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { amount } = await req.json();
        const depositAmount = Number(amount);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        // Update Wallet
        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                walletBalance: { increment: depositAmount }
            }
        });

        return NextResponse.json({ success: true, newBalance: user.walletBalance });

    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
