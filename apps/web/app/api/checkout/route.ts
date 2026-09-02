import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { buildCartItems, createAndPayOrder, orderPayload } from "@/lib/wallet";
import { paymentErrorResponse } from "@/lib/api-errors";
import { defaultMethodFor } from "@/lib/pricing";
import { getRequestCurrency } from "@/lib/request-currency";
import { walletApiOrigin } from "@/lib/wallet-api";
import type { PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["WALLET", "MOBILE_MONEY", "CARD"];

/**
 * POST /api/checkout — règle le panier.
 *
 * Les prix sont relus en base : ce que le client envoie n'est jamais utilisé pour
 * calculer un montant.
 *
 *  - method WALLET       : débit immédiat du solde, accès accordés dans la réponse ;
 *  - MOBILE_MONEY / CARD : renvoie `paymentUrl` à présenter au payeur, la commande
 *                          reste PENDING jusqu'à confirmation par GET /api/orders/:id.
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    let body: { method?: unknown; returnPath?: unknown } = {};
    try {
        body = await request.json();
    } catch {
        // Corps absent : on retombe sur le règlement au solde, comportement historique.
    }

    const currency = await getRequestCurrency();
    const method = (METHODS.includes(body.method as PaymentMethod) ? body.method : defaultMethodFor(currency)) as PaymentMethod;

    try {
        const items = await buildCartItems(session.user.id, currency);
        const result = await createAndPayOrder({
            userId: session.user.id,
            items,
            method,
            currency,
            returnPath: typeof body.returnPath === "string" ? body.returnPath : "/profile?tab=courses",
            label: items.length === 1 ? items[0].title : `Panier Everest (${items.length} articles)`,
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
