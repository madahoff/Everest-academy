import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getNextMasterclass, getRegistrationView, rolloverIfDue, toOffer } from "@/lib/masterclass";
import { getRequestCurrency } from "@/lib/request-currency";

export const dynamic = "force-dynamic";

/**
 * GET /api/masterclass — la prochaine Masterclass, et l'état du visiteur vis-à-vis
 * d'elle.
 *
 * Une seule route pour les trois emplacements de la vitrine (accueil, catalogue,
 * page dédiée) : ils affichent tous la même session, il ne doit y avoir qu'une
 * façon de la déterminer.
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    const currency = await getRequestCurrency();

    // Archivage des séances écoulées, au passage. Sans effet sur la réponse — la
    // session à venir est choisie sur sa date, pas sur son statut d'archive.
    await rolloverIfDue();

    const masterclass = await getNextMasterclass();
    if (!masterclass) {
        return NextResponse.json({ masterclass: null, registration: null });
    }

    const [offer, registration] = await Promise.all([
        toOffer(masterclass, currency),
        getRegistrationView(masterclass.id, session?.user?.id),
    ]);

    return NextResponse.json({ masterclass: offer, registration });
}
