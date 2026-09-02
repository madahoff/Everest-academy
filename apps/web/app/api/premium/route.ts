import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { buildPremiumPackItem, createAndPayOrder, orderPayload } from "@/lib/wallet";
import { getPremiumOffer, isPremiumMember } from "@/lib/premium";
import { paymentErrorResponse } from "@/lib/api-errors";
import { defaultMethodFor } from "@/lib/pricing";
import { getRequestCurrency } from "@/lib/request-currency";
import { walletApiOrigin } from "@/lib/wallet-api";
import type { PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["WALLET", "MOBILE_MONEY", "CARD"];

/** GET /api/premium — offre du Pack Premium et état de l'abonné. */
export async function GET() {
    const session = await getServerSession(authOptions);
    const offer = await getPremiumOffer(await getRequestCurrency());

    return NextResponse.json({
        ...offer,
        isPremium: await isPremiumMember(session?.user?.id),
    });
}

/**
 * POST /api/premium — achat du Pack Premium, qui débloque l'intégralité du catalogue.
 *
 * Même mécanique que l'achat d'un cours : le solde règle immédiatement, Mobile Money
 * et carte ouvrent un paiement dont l'issue est ensuite sondée sur /api/orders/:id.
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
        // Corps optionnel.
    }

    const currency = await getRequestCurrency();
    const method = (METHODS.includes(body.method as PaymentMethod) ? body.method : defaultMethodFor(currency)) as PaymentMethod;

    try {
        const items = await buildPremiumPackItem(session.user.id, currency);
        const result = await createAndPayOrder({
            userId: session.user.id,
            items,
            method,
            currency,
            returnPath: typeof body.returnPath === "string" ? body.returnPath : "/courses",
            label: "Pack Premium",
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
