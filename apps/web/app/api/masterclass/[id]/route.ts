import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getMasterclassById, getRegistrationView, toOffer } from "@/lib/masterclass";
import { isPremiumMember } from "@/lib/premium";
import { getRequestCurrency } from "@/lib/request-currency";

export const dynamic = "force-dynamic";

/**
 * GET /api/masterclass/:id — le détail d'une séance précise.
 *
 * Même charge utile que `/api/masterclass`, à ceci près qu'elle ne désigne pas la
 * prochaine séance mais celle qu'on demande : c'est ce qui permet à un membre
 * d'ouvrir le détail d'une Masterclass passée depuis son profil. Les brouillons
 * répondent 404 — une séance en préparation n'a pas d'adresse publique.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    const masterclass = await getMasterclassById(id);
    if (!masterclass) {
        return NextResponse.json({ error: "not_found", message: "Masterclass introuvable" }, { status: 404 });
    }

    const currency = await getRequestCurrency();
    const [offer, registration, isPremium] = await Promise.all([
        toOffer(masterclass, currency),
        getRegistrationView(masterclass.id, session?.user?.id),
        isPremiumMember(session?.user?.id),
    ]);

    return NextResponse.json({ masterclass: offer, registration, isPremium });
}
