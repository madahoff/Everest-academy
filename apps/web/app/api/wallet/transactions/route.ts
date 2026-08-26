import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { ensureUserWallet } from "@/lib/wallet";
import { isWalletApiConfigured, listTransactions } from "@/lib/wallet-api";
import { paymentErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet/transactions — historique du grand livre, paginé par curseur.
 * Le curseur, et non un offset : l'historique reçoit de nouvelles lignes en tête,
 * un offset ferait sauter ou répéter des mouvements entre deux pages.
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    if (!isWalletApiConfigured()) {
        return NextResponse.json({ data: [], nextCursor: null, hasMore: false });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;

    try {
        await ensureUserWallet(session.user.id);
        const page = await listTransactions(session.user.id, {
            limit,
            cursor: searchParams.get("cursor") ?? undefined,
            type: searchParams.get("type") ?? undefined,
        });
        return NextResponse.json(page);
    } catch (error) {
        return paymentErrorResponse(error);
    }
}
