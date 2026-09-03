import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { paymentErrorResponse } from "@/lib/api-errors";
import {
    MasterclassError,
    assertRegistrable,
    buildMasterclassItem,
    enrollPremiumMember,
    getNextMasterclass,
    getRegistrationView,
    openRegistration,
    registrationLabel,
} from "@/lib/masterclass";
import { sendMasterclassConfirmation } from "@/lib/masterclass-email";
import { isPremiumMember } from "@/lib/premium";
import { createAndPayOrder, orderPayload } from "@/lib/wallet";
import { defaultMethodFor, resolvePrice } from "@/lib/pricing";
import { getRequestCurrency } from "@/lib/request-currency";
import { walletApiOrigin } from "@/lib/wallet-api";
import type { PaymentMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["WALLET", "MOBILE_MONEY", "CARD"];

/**
 * POST /api/masterclass/register — inscription à la prochaine Masterclass.
 *
 * Aucun circuit de paiement propre : exactement la même mécanique que l'achat d'un
 * cours ou du Pack Premium. Le solde règle immédiatement et l'inscription est
 * confirmée dans la foulée ; Mobile Money et carte ouvrent un paiement Vanilla Pay
 * dont l'issue est sondée sur `/api/orders/:id` — c'est ce sondage qui confirme
 * l'inscription et déclenche l'e-mail.
 *
 * L'inscription en attente est posée AVANT le paiement : la console voit ainsi les
 * inscriptions en cours de règlement, et pas seulement celles qui ont abouti.
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: { method?: unknown; returnPath?: unknown } = {};
    try {
        body = await request.json();
    } catch {
        // Corps optionnel.
    }

    const currency = await getRequestCurrency();
    const method = (
        METHODS.includes(body.method as PaymentMethod) ? body.method : defaultMethodFor(currency)
    ) as PaymentMethod;
    const returnPath = typeof body.returnPath === "string" ? body.returnPath : "/masterclass";

    try {
        const masterclass = await getNextMasterclass();
        if (!masterclass) {
            throw new MasterclassError(
                "no_masterclass",
                404,
                "Aucune Masterclass n'est ouverte aux inscriptions pour le moment",
            );
        }

        const existing = await prisma.masterclassRegistration.findUnique({
            where: { masterclassId_userId: { masterclassId: masterclass.id, userId } },
            include: { order: { select: { status: true } } },
        });

        // Résolu avant les gardes : le pack lève la jauge, et dispense du paiement.
        const premium = await isPremiumMember(userId);

        await assertRegistrable(masterclass, existing, { premium });

        // Séance offerte, OU membre du Pack Premium — qui a déjà payé toutes les
        // Masterclass. Dans les deux cas il n'y a rien à encaisser : aucune commande
        // n'est ouverte, la place est acquise sur-le-champ.
        //
        // Cette garde est la seule qui compte pour tenir la promesse du pack : elle
        // vaut quelle que soit la façon dont le plan a été accordé — achat, ou
        // basculement manuel depuis la console.
        const view = resolvePrice(
            { price: String(masterclass.price), priceEur: masterclass.priceEur?.toString() },
            currency,
        );
        if (view.free || premium) {
            const registration = await prisma.masterclassRegistration.upsert({
                where: { masterclassId_userId: { masterclassId: masterclass.id, userId } },
                create: {
                    masterclassId: masterclass.id,
                    userId,
                    amount: 0,
                    currency,
                    status: "CONFIRMED",
                    confirmedAt: new Date(),
                },
                update: { status: "CONFIRMED", amount: 0, currency, confirmedAt: new Date(), cancelledAt: null },
            });

            // Membre Premium : tant qu'à le traiter, on l'inscrit aux autres séances
            // déjà programmées — c'est ce que le pack lui a vendu.
            if (premium) {
                await prisma.$transaction((tx) => enrollPremiumMember(tx, userId));
            }

            if (!registration.confirmationEmailSentAt) {
                await sendMasterclassConfirmation(registration.id);
            }

            return NextResponse.json({
                order: null,
                paymentUrl: null,
                mode: null,
                registration: await getRegistrationView(masterclass.id, userId),
            });
        }

        const item = buildMasterclassItem(masterclass, currency);

        // Posée avant le paiement : une tentative abandonnée reste visible en console,
        // et la contrainte d'unicité (masterclass, utilisateur) interdit le doublon même
        // en cas de double clic.
        await openRegistration({
            userId,
            masterclassId: masterclass.id,
            amount: item.amount,
            currency,
        });

        const result = await createAndPayOrder({
            userId,
            items: [item],
            method,
            currency,
            returnPath,
            label: registrationLabel(masterclass),
        });

        // Rattachement de la commande à l'inscription. `updateMany` filtré sur la
        // paire : le règlement au solde a pu, entre-temps, faire passer la ligne à
        // CONFIRMED — on ne touche donc qu'au lien, jamais au statut.
        await prisma.masterclassRegistration.updateMany({
            where: { masterclassId: masterclass.id, userId },
            data: { orderId: result.order.id },
        });

        return NextResponse.json({
            order: await orderPayload(result.order),
            paymentUrl: result.paymentUrl ?? null,
            mode: result.mode ?? null,
            // Origine attendue du postMessage de fin de paiement, vérifiée par le client.
            paymentOrigin: walletApiOrigin(),
            balance: result.balance,
            registration: await getRegistrationView(masterclass.id, userId),
        });
    } catch (error) {
        if (error instanceof MasterclassError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        // Deux requêtes simultanées (double clic) peuvent franchir les gardes ensemble
        // et se heurter à la contrainte d'unicité. C'est exactement ce qu'elle protège :
        // on répond comme à une seconde inscription, pas comme à une panne.
        if ((error as { code?: string })?.code === "P2002") {
            return NextResponse.json(
                { error: "already_registered", message: "Vous êtes déjà inscrit à cette Masterclass" },
                { status: 409 },
            );
        }
        return paymentErrorResponse(error);
    }
}
