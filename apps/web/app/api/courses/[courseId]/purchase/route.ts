import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { buildCourseItems, createAndPayOrder, orderPayload } from "@/lib/wallet";
import { paymentErrorResponse } from "@/lib/api-errors";
import { walletApiOrigin } from "@/lib/wallet-api";
import type { PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["WALLET", "MOBILE_MONEY", "CARD"];

/**
 * POST /api/courses/:courseId/purchase — achat immédiat d'un cours, sans passer par
 * le panier ni par un code d'accès.
 */
export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    const { courseId } = await params;

    let body: { method?: unknown; returnPath?: unknown } = {};
    try {
        body = await request.json();
    } catch {
        // Corps optionnel.
    }

    const method = (METHODS.includes(body.method as PaymentMethod) ? body.method : "WALLET") as PaymentMethod;

    try {
        const items = await buildCourseItems(session.user.id, [courseId]);
        const result = await createAndPayOrder({
            userId: session.user.id,
            items,
            method,
            returnPath: typeof body.returnPath === "string" ? body.returnPath : `/courses/${courseId}`,
            label: items[0].title,
        });

        return NextResponse.json({
            order: await orderPayload(result.order),
            paymentUrl: result.paymentUrl ?? null,
            mode: result.mode ?? null,
            // Origine attendue du postMessage de fin de paiement, vérifiée par le client.
            paymentOrigin: walletApiOrigin(),
            balance: result.balance,
        });
    } catch (error) {
        return paymentErrorResponse(error);
    }
}
