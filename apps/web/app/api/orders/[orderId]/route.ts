import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { orderPayload, syncOrder } from "@/lib/wallet";
import { paymentErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/:orderId — état réel d'une commande.
 *
 * Le Wallet API n'appelle jamais Everest : c'est cet appel qui réinterroge le
 * paiement, accorde les accès si l'encaissement est confirmé, et rattrape une
 * notification perdue. C'est donc la route à sonder après le retour du payeur.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    const { orderId } = await params;

    // Filtré par utilisateur : une commande d'autrui répond 404, jamais 403 — inutile
    // de confirmer son existence.
    const order = await prisma.order.findFirst({
        where: { id: orderId, userId: session.user.id },
        include: { items: true },
    });

    if (!order) {
        return NextResponse.json({ error: "order_not_found", message: "Commande introuvable" }, { status: 404 });
    }

    try {
        const synced = await syncOrder(order);
        const payload = await orderPayload(synced);
        return NextResponse.json({
            ...payload,
            // « Terminal » n'est vrai que si les accès sont effectivement accordés :
            // une commande payée mais non octroyée doit continuer d'être sondée, c'est
            // ce sondage qui déclenche la nouvelle tentative d'octroi.
            terminal:
                (payload.status === "PAID" && payload.granted) ||
                payload.status === "FAILED" ||
                payload.status === "CANCELLED",
        });
    } catch (error) {
        return paymentErrorResponse(error);
    }
}
