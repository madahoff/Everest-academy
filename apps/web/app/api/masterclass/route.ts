import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import {
    enrollPremiumMember,
    getNextMasterclass,
    getRegistrationView,
    rolloverIfDue,
    toOffer,
} from "@/lib/masterclass";
import { isPremiumMember } from "@/lib/premium";
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
        return NextResponse.json({ masterclass: null, registration: null, isPremium: false });
    }

    const userId = session?.user?.id;
    const isPremium = await isPremiumMember(userId);

    // Membre du Pack Premium : sa place lui a été VENDUE avec le pack. On la
    // matérialise ici, à la lecture — il voit alors « vous êtes inscrit » plutôt qu'un
    // bouton de paiement, et il figure dans la liste des inscrits de la console sans
    // avoir eu à cliquer. Idempotent, donc sans effet dès la deuxième visite.
    //
    // Pas de `$transaction` : `enrollPremiumMember` ne pose qu'un `createMany`, et une
    // transaction ouverte à chaque affichage de la page ne protégerait rien.
    if (isPremium && userId) {
        try {
            await enrollPremiumMember(prisma, userId);
        } catch (error) {
            // Une inscription manquée n'empêche pas de consulter la séance, et la
            // console la rattrape de son côté. On n'échoue jamais sur un affichage.
            console.error("Inscription d'office du membre Premium échouée", error);
        }
    }

    const [offer, registration] = await Promise.all([
        toOffer(masterclass, currency),
        getRegistrationView(masterclass.id, userId),
    ]);

    // `isPremium` ne change RIEN au droit de s'inscrire — la route d'inscription le
    // relit elle-même. Il ne sert qu'à dire au membre d'où lui vient sa place.
    return NextResponse.json({ masterclass: offer, registration, isPremium });
}
