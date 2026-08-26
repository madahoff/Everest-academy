import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getWalletSummary } from "@/lib/wallet";
import { isWalletApiConfigured } from "@/lib/wallet-api";
import { paymentErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/** GET /api/wallet — solde courant du portefeuille de l'utilisateur connecté. */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }

    if (!isWalletApiConfigured()) {
        // Dégradation explicite : la page peut s'afficher et proposer les autres moyens
        // de paiement plutôt que de tomber en erreur.
        return NextResponse.json({ configured: false, balance: 0, currency: "MGA", status: "ACTIVE" });
    }

    try {
        const summary = await getWalletSummary(session.user.id);
        return NextResponse.json({ configured: true, ...summary });
    } catch (error) {
        return paymentErrorResponse(error);
    }
}
