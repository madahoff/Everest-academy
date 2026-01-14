import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Delete user (cascade will handle accounts/sessions usually, but schema defines it)
        // In our schema:
        // Account -> onDelete: Cascade
        // Session -> onDelete: Cascade
        // So deleting User is enough.
        await prisma.user.delete({
            where: {
                id: session.user.id
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[PROFILE_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
