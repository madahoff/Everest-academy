/**
 * Masterclass mensuelle — résolution de la session en cours et cycle de vie des
 * inscriptions.
 *
 * Deux principes tiennent tout le reste :
 *
 *  1. La « prochaine Masterclass » n'est pas un drapeau : c'est la première session
 *     PUBLIÉE dont la date n'est pas passée. Le 1er du mois n'a donc rien à
 *     déclencher pour que le site cesse d'annoncer la session écoulée — une tâche
 *     planifiée manquée ne peut pas laisser la vitrine dans le passé.
 *
 *  2. L'inscription n'est PAS un second circuit de paiement. Elle passe par la même
 *     `Order` que les cours, avec un `OrderItem.masterclassId`, et c'est
 *     `grantOrderAccess` (lib/wallet.ts) qui la confirme quand l'argent est encaissé.
 *     Cette table ne tient que ce que la commande ignore : la place et la présence.
 */

import { prisma } from "@/lib/prisma";
import { currentMonthKey, monthKeyOf } from "@/lib/masterclass-month";
import { resolvePrice, type Currency } from "@/lib/pricing";
import type { Masterclass, MasterclassRegistration, Prisma, RegistrationStatus } from "@prisma/client";

/** Erreur métier de l'inscription, traduite en réponse HTTP par le point d'appel. */
export class MasterclassError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "MasterclassError";
    }
}

/** Statuts qui occupent réellement une place. */
export const OCCUPYING_STATUSES: RegistrationStatus[] = ["CONFIRMED", "ATTENDED"];

/** Statuts qui interdisent une nouvelle inscription : la place est déjà tenue. */
const SETTLED_STATUSES: RegistrationStatus[] = ["CONFIRMED", "ATTENDED", "NO_SHOW"];

// ─── Résolution de la session ─────────────────────────────────────────────────

/**
 * Session à venir, celle que la vitrine annonce.
 *
 * « À venir » se mesure sur `scheduledAt` et non sur le mois : une session du 5 est
 * passée le 20, et c'est celle du mois suivant qu'il faut proposer. Le basculement
 * du 1er en découle sans être écrit nulle part.
 */
export async function getNextMasterclass(now: Date = new Date()): Promise<Masterclass | null> {
    return prisma.masterclass.findFirst({
        where: { status: "PUBLISHED", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
    });
}

/**
 * Archive les sessions publiées dont la date est passée.
 *
 * Idempotent et sans effet sur les inscriptions : l'historique est précisément ce
 * qu'on conserve. Appelé paresseusement à la lecture (voir `rolloverIfDue`) ET
 * exposé en route de tâche planifiée — les deux chemins font la même chose, si bien
 * qu'aucun des deux n'est indispensable à la justesse de l'affichage.
 */
export async function rolloverMasterclasses(now: Date = new Date()): Promise<{
    archived: number;
    expired: number;
    monthKey: string;
}> {
    const archived = await prisma.masterclass.updateMany({
        where: { status: "PUBLISHED", scheduledAt: { lt: now } },
        data: { status: "ARCHIVED" },
    });

    // Une inscription restée PENDING sur une séance déjà tenue n'a jamais été réglée.
    // Elle est close — et non supprimée : elle reste lisible dans l'historique, avec
    // sa date, son montant et sa commande en échec.
    const expired = await prisma.masterclassRegistration.updateMany({
        where: { status: "PENDING", masterclass: { scheduledAt: { lt: now } } },
        data: { status: "CANCELLED", cancelledAt: now },
    });

    return { archived: archived.count, expired: expired.count, monthKey: currentMonthKey(now) };
}

/**
 * Garde-fou de fréquence du basculement paresseux. Le rattrapage est idempotent :
 * ce compteur n'est là que pour ne pas écrire deux requêtes à chaque affichage de la
 * page d'accueil. Il vit dans le processus — un redémarrage le remet à zéro, sans
 * autre conséquence qu'un rattrapage de plus.
 */
let lastRollover = 0;
const ROLLOVER_INTERVAL_MS = 10 * 60 * 1000;

export async function rolloverIfDue(now: Date = new Date()): Promise<void> {
    if (now.getTime() - lastRollover < ROLLOVER_INTERVAL_MS) return;
    lastRollover = now.getTime();
    try {
        await rolloverMasterclasses(now);
    } catch (error) {
        // Un archivage manqué ne change RIEN à ce qui est affiché : la session à venir
        // est de toute façon choisie sur sa date. On n'échoue donc jamais là-dessus.
        console.error("Basculement mensuel des Masterclass échoué", error);
    }
}

// ─── Offre publique ───────────────────────────────────────────────────────────

export interface MasterclassOffer {
    id: string;
    monthKey: string;
    title: string;
    description: string;
    instructor: string;
    scheduledAt: string;
    duration: string | null;
    location: string | null;
    coverImage: string | null;
    /** Vidéo de présentation. `null` : aucun lecteur n'est affiché. */
    presentationVideo: string | null;
    /** Devise du visiteur : tous les montants de ce bloc y sont exprimés. */
    currency: Currency;
    /** Tarif. `null` : pas de tarif dans cette devise — inscription impossible ici. */
    price: number | null;
    /** Session offerte : aucune commande n'est ouverte, l'inscription est immédiate. */
    free: boolean;
    capacity: number | null;
    /** Places restantes. `null` quand la jauge n'est pas annoncée. */
    seatsLeft: number | null;
    confirmedCount: number;
    full: boolean;
}

/** État de l'inscription du visiteur à cette session. */
export interface MasterclassRegistrationView {
    id: string;
    status: RegistrationStatus;
    amount: number;
    currency: string;
    registeredAt: string;
    /** Commande rattachée, pour reprendre un paiement resté en attente. */
    orderId: string | null;
    orderStatus: string | null;
    /** Où sonder l'issue du paiement, quand il est encore ouvert. */
    pollUrl: string | null;
    paymentUrl: string | null;
}

/** Nombre de places réellement tenues. */
async function countOccupied(masterclassId: string): Promise<number> {
    return prisma.masterclassRegistration.count({
        where: { masterclassId, status: { in: OCCUPYING_STATUSES } },
    });
}

/** Rend la session publiable côté client, chiffrée dans la devise du visiteur. */
export async function toOffer(masterclass: Masterclass, currency: Currency): Promise<MasterclassOffer> {
    const view = resolvePrice(
        { price: String(masterclass.price), priceEur: masterclass.priceEur?.toString() },
        currency,
    );
    const confirmedCount = await countOccupied(masterclass.id);
    const seatsLeft = masterclass.capacity === null ? null : Math.max(0, masterclass.capacity - confirmedCount);

    return {
        id: masterclass.id,
        monthKey: masterclass.monthKey,
        title: masterclass.title,
        description: masterclass.description,
        instructor: masterclass.instructor,
        scheduledAt: masterclass.scheduledAt.toISOString(),
        duration: masterclass.duration,
        location: masterclass.location,
        coverImage: masterclass.coverImage,
        presentationVideo: masterclass.presentationVideo,
        currency,
        price: view.free ? 0 : view.amount,
        free: view.free,
        capacity: masterclass.capacity,
        seatsLeft,
        confirmedCount,
        full: seatsLeft !== null && seatsLeft <= 0,
    };
}

/** Inscription du visiteur à une session, telle que la vitrine doit la lire. */
export async function getRegistrationView(
    masterclassId: string,
    userId: string | null | undefined,
): Promise<MasterclassRegistrationView | null> {
    if (!userId) return null;

    const registration = await prisma.masterclassRegistration.findUnique({
        where: { masterclassId_userId: { masterclassId, userId } },
        include: { order: { select: { id: true, status: true, paymentUrl: true } } },
    });

    if (!registration) return null;

    return {
        id: registration.id,
        status: registration.status,
        amount: Number(registration.amount),
        currency: registration.currency,
        registeredAt: registration.registeredAt.toISOString(),
        orderId: registration.orderId,
        orderStatus: registration.order?.status ?? null,
        pollUrl: registration.orderId ? `/api/orders/${registration.orderId}` : null,
        // Lien de paiement conservé tant que la commande est en attente : c'est ce qui
        // permet de REPRENDRE un règlement abandonné plutôt que d'en ouvrir un second.
        paymentUrl: registration.order?.status === "PENDING" ? (registration.order.paymentUrl ?? null) : null,
    };
}

// ─── Inscription ──────────────────────────────────────────────────────────────

/** Une inscription est-elle déjà acquise ? */
export function isSettled(status: RegistrationStatus): boolean {
    return SETTLED_STATUSES.includes(status);
}

/**
 * Article de commande à régler pour une place. Les gardes d'inscription — déjà
 * inscrit, séance complète, séance passée — sont dans `assertRegistrable` ; il ne
 * reste ici que le tarif, refusé s'il n'existe pas dans la devise du visiteur.
 */
export function buildMasterclassItem(
    masterclass: Masterclass,
    currency: Currency,
): { masterclassId: string; title: string; amount: number } {
    const view = resolvePrice(
        { price: String(masterclass.price), priceEur: masterclass.priceEur?.toString() },
        currency,
    );

    if (view.amount === null) {
        throw new MasterclassError(
            "price_unavailable",
            409,
            "Cette Masterclass n'est pas encore proposée à l'inscription depuis votre pays. Écrivez-nous pour y participer.",
        );
    }
    if (view.free) {
        throw new MasterclassError("free_masterclass", 400, "Cette Masterclass est offerte : l'inscription est directe");
    }

    return { masterclassId: masterclass.id, title: registrationLabel(masterclass), amount: view.amount };
}

/** Libellé de la ligne de commande — figé sur la facture, d'où le titre complet. */
export function registrationLabel(masterclass: Masterclass): string {
    return `Masterclass — ${masterclass.title}`;
}

/**
 * Refuse une inscription impossible. Appelée avant toute ouverture de paiement.
 *
 * `existing` est l'inscription éventuelle du visiteur : une inscription ANNULÉE, ou
 * restée en attente sur un paiement échoué, ne bloque pas une nouvelle tentative —
 * c'est le cas normal de quelqu'un qui a abandonné puis revient.
 */
export async function assertRegistrable(
    masterclass: Masterclass,
    existing: (MasterclassRegistration & { order: { status: string } | null }) | null,
    now: Date = new Date(),
): Promise<void> {
    if (masterclass.status !== "PUBLISHED") {
        throw new MasterclassError("masterclass_unavailable", 409, "Cette Masterclass n'est pas ouverte aux inscriptions");
    }
    if (masterclass.scheduledAt.getTime() <= now.getTime()) {
        throw new MasterclassError("masterclass_past", 409, "Cette session a déjà eu lieu");
    }

    if (existing && isSettled(existing.status)) {
        throw new MasterclassError("already_registered", 409, "Vous êtes déjà inscrit à cette Masterclass");
    }

    // Paiement encore ouvert : on ne relance pas une seconde commande, l'appelant
    // renvoie celle-ci pour que le payeur la termine.
    if (existing && existing.status === "PENDING" && existing.order?.status === "PENDING") {
        throw new MasterclassError(
            "payment_pending",
            409,
            "Un paiement est déjà en cours pour cette Masterclass. Terminez-le ou réessayez dans quelques minutes.",
        );
    }

    if (masterclass.capacity !== null) {
        const occupied = await countOccupied(masterclass.id);
        if (occupied >= masterclass.capacity) {
            throw new MasterclassError("masterclass_full", 409, "Cette Masterclass affiche complet");
        }
    }
}

/**
 * Pose (ou rouvre) l'inscription en attente, AVANT d'ouvrir le paiement.
 *
 * Elle existe donc dès la première tentative : la console voit les inscriptions en
 * cours de règlement, et pas seulement celles qui ont abouti. Le passage à CONFIRMED
 * appartient à `confirmMasterclassRegistration`, déclenché par l'encaissement.
 */
export async function openRegistration(input: {
    userId: string;
    masterclassId: string;
    amount: number;
    currency: string;
}): Promise<MasterclassRegistration> {
    const { userId, masterclassId, amount, currency } = input;

    return prisma.masterclassRegistration.upsert({
        where: { masterclassId_userId: { masterclassId, userId } },
        create: { masterclassId, userId, amount, currency, status: "PENDING" },
        // Nouvelle tentative après un abandon : on repart d'une inscription propre,
        // en conservant la ligne — sa date d'origine reste l'historique du premier essai.
        update: { amount, currency, status: "PENDING", cancelledAt: null, orderId: null },
    });
}

/**
 * Confirme l'inscription rattachée à une commande encaissée.
 *
 * Idempotent : rejouée, elle ne change rien et ne redemande aucun e-mail. Appelée
 * dans la transaction d'octroi des accès (lib/wallet.ts) — d'où le client `tx`.
 *
 * Retourne l'identifiant de l'inscription si un e-mail de confirmation reste à
 * envoyer, `null` sinon. L'envoi lui-même a lieu HORS transaction : un service de
 * messagerie lent ne doit pas tenir une transaction de base ouverte.
 */
export async function confirmMasterclassRegistration(
    tx: Prisma.TransactionClient,
    input: { userId: string; masterclassId: string; orderId: string; amount: number; currency: string },
): Promise<string | null> {
    const { userId, masterclassId, orderId, amount, currency } = input;

    const existing = await tx.masterclassRegistration.findUnique({
        where: { masterclassId_userId: { masterclassId, userId } },
    });

    if (!existing) {
        const created = await tx.masterclassRegistration.create({
            data: {
                masterclassId,
                userId,
                orderId,
                amount,
                currency,
                status: "CONFIRMED",
                confirmedAt: new Date(),
            },
        });
        return created.id;
    }

    // ATTENDED / NO_SHOW sont postérieurs à la séance : un sondage tardif de la
    // commande ne doit pas les ramener à « inscrit ».
    const keepStatus = existing.status === "ATTENDED" || existing.status === "NO_SHOW";

    await tx.masterclassRegistration.update({
        where: { id: existing.id },
        data: {
            orderId,
            amount,
            currency,
            ...(keepStatus ? {} : { status: "CONFIRMED", cancelledAt: null }),
            confirmedAt: existing.confirmedAt ?? new Date(),
        },
    });

    // Déjà envoyé : la confirmation ne part qu'une fois, quel que soit le nombre de
    // sondages de la commande.
    return existing.confirmationEmailSentAt ? null : existing.id;
}
