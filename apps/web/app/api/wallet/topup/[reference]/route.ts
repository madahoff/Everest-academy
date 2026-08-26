import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getWalletSummary, syncTopup } from "@/lib/wallet";
import { paymentErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet/topup/:reference — état réel d'une recharge.
 *
 * C'est la seule source de vérité : les paramètres `payment_status` ajoutés à l'URL
 * de retour viennent du navigateur du payeur, qui peut les modifier. L'appel
 * déclenche aussi, côté Wallet API, la régularisation d'une recharge encaissée dont
 * la notification se serait perdue.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    const { reference } = await params;

    try {
        const topup = await syncTopup(reference, session.user.id);

        // `settled` (portefeuille crédité) et `status: SUCCESS` (argent encaissé) sont
        // deux choses distinctes : on ne dit « terminé » que quand les deux sont vrais.
        const done = topup.status === "SUCCESS" && topup.settled;
        const balance = done ? (await getWalletSummary(session.user.id).catch(() => null))?.balance : undefined;

        return NextResponse.json({
            reference: topup.reference,
            status: topup.status,
            settled: topup.settled,
            settlementError: topup.settlementError,
            amount: Number(topup.amount),
            done,
            terminal: done || topup.status === "FAILED",
            balance,
        });
    } catch (error) {
        return paymentErrorResponse(error);
    }
}
