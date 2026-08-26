import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { createTopup } from "@/lib/wallet";
import { paymentErrorResponse } from "@/lib/api-errors";
import { walletApiOrigin } from "@/lib/wallet-api";
import type { PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Bornes de reversement Vanilla Pay, reprises ici pour refuser au plus tôt. */
const MIN_TOPUP = 1000;
const MAX_TOPUP = 5_000_000;

/**
 * POST /api/wallet/topup — ouvre une recharge Mobile Money ou carte.
 *
 * Ne crédite rien : renvoie l'URL de paiement Vanilla Pay à présenter au payeur. Le
 * portefeuille est crédité par le Wallet API dès que Vanilla Pay confirme
 * l'encaissement ; l'état s'obtient ensuite via GET /api/wallet/topup/:reference.
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    let body: { amount?: unknown; method?: unknown; returnPath?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "validation_error", message: "Corps de requête invalide" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
        return NextResponse.json(
            {
                error: "validation_error",
                message: `Le montant doit être compris entre ${MIN_TOPUP.toLocaleString("fr-FR")} Ar et ${MAX_TOPUP.toLocaleString("fr-FR")} Ar`,
            },
            { status: 400 },
        );
    }

    const method = body.method === "CARD" ? "CARD" : "MOBILE_MONEY";

    try {
        const result = await createTopup({
            userId: session.user.id,
            amount,
            method: method as PaymentMethod,
            returnPath: typeof body.returnPath === "string" ? body.returnPath : "/wallet",
        });

        return NextResponse.json({
            reference: result.topup.reference,
            amount: Number(result.topup.amount),
            status: result.topup.status,
            paymentUrl: result.paymentUrl,
            mode: result.mode,
            // Origine attendue du postMessage de fin de paiement, vérifiée par le client.
            paymentOrigin: walletApiOrigin(),
            pollUrl: `/api/wallet/topup/${encodeURIComponent(result.topup.reference)}`,
        });
    } catch (error) {
        return paymentErrorResponse(error);
    }
}
