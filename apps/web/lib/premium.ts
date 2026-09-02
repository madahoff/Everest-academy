/**
 * Pack Premium — un achat unique qui ouvre l'intégralité du catalogue.
 *
 * Deux traces sont posées à l'achat, et elles ne font pas double emploi :
 *  - `users.plan = PREMIUM` couvre le catalogue À VENIR, sans quoi un cours publié
 *    après l'achat resterait verrouillé pour un membre qui a payé « tout le catalogue » ;
 *  - un `Purchase` par cours actif couvre l'EXISTANT, pour que tout ce qui interroge
 *    déjà les achats (profil, certifications, panier) reste juste sans être réécrit.
 *
 * L'accès est donc toujours la réunion des deux — voir `hasCourseAccess`.
 */

import { prisma } from "@/lib/prisma";
import { resolvePrice, type Currency } from "@/lib/pricing";

/**
 * Tarif de repli, en ariary entiers (le Wallet API refuse les fractions d'ariary).
 * Ne sert que si la ligne de réglage n'a jamais été écrite — la migration l'insère,
 * et la console d'administration en est ensuite la seule source.
 */
const DEFAULT_PREMIUM_PACK_PRICE = 199_000;

/** Identifiant de la ligne unique de réglage. */
export const PREMIUM_PLAN_ID = "default";

export const PREMIUM_PACK_TITLE = "Pack Premium — Catalogue intégral";

export interface PremiumPlan {
    price: number;
    /**
     * Tarif international, en euros entiers. `null` : le pack n'est pas proposé hors
     * de Madagascar. Aucun repli par conversion — voir `lib/pricing.ts`.
     */
    priceEur: number | null;
    /**
     * Modules annoncés sur la durée de l'offre — l'année académique. `null` : on
     * annonce ce qui est publié. Voir `PremiumOffer.announcedCourseCount`.
     */
    announcedCourseCount: number | null;
    /** Offre proposée à la vente. Retirée, elle n'ôte aucun accès déjà accordé. */
    active: boolean;
}

/** Réglage courant du pack, tel que la console d'administration l'a fixé. */
export async function getPremiumPlan(): Promise<PremiumPlan> {
    const plan = await prisma.premiumPlan.findUnique({ where: { id: PREMIUM_PLAN_ID } });
    if (!plan) {
        return { price: DEFAULT_PREMIUM_PACK_PRICE, priceEur: null, announcedCourseCount: null, active: true };
    }
    return {
        price: Number(plan.price),
        priceEur: plan.priceEur === null ? null : Number(plan.priceEur),
        announcedCourseCount: plan.announcedCourseCount,
        active: plan.active,
    };
}

export interface PremiumOffer {
    /** Devise dans laquelle tout ce bloc est exprimé. */
    currency: Currency;
    /** Tarif du pack. `null` : pas de tarif dans cette devise, donc rien à proposer. */
    price: number | null;
    /** L'offre est-elle proposée à la vente ? */
    active: boolean;
    /** Somme des cours payants du catalogue : ce que coûterait l'achat à l'unité. */
    catalogueValue: number;
    /** Économie réalisée par rapport à l'achat à l'unité (jamais négative). */
    savings: number;
    /** Modules DÉJÀ PUBLIÉS, ouverts dès l'achat. */
    courseCount: number;
    /**
     * Modules ANNONCÉS sur la durée de l'offre — le programme de l'année, dont une
     * partie n'est pas encore parue. C'est ce nombre que lit l'acheteur : le pack se
     * vend sur un programme, pas sur l'état du catalogue le jour de l'achat.
     *
     * Réglé depuis la console d'administration ; à défaut, il vaut le nombre publié,
     * et le bandeau retombe alors sur son ancien discours.
     */
    announcedCourseCount: number;
    premiumCourseCount: number;
}

/**
 * Argumentaire chiffré du pack, calculé sur le catalogue réellement publié et dans
 * la devise du visiteur.
 *
 * En euros, la valeur du catalogue ne compte que les cours effectivement tarifés en
 * euros : un cours sans tarif international n'est pas vendable à ce visiteur, il
 * n'a donc rien à faire dans le total qu'on lui oppose.
 */
export async function getPremiumOffer(currency: Currency): Promise<PremiumOffer> {
    const [courses, plan] = await Promise.all([
        prisma.course.findMany({ where: { status: "ACTIVE" }, select: { price: true, priceEur: true } }),
        getPremiumPlan(),
    ]);

    const prices = courses
        .map((c) => resolvePrice({ price: String(c.price), priceEur: c.priceEur?.toString() }, currency))
        .map((view) => view.amount ?? 0);

    const catalogueValue = prices.reduce((sum, price) => sum + price, 0);
    const price = currency === "EUR" ? plan.priceEur : plan.price;

    return {
        currency,
        price,
        // Un pack sans tarif dans cette devise n'est pas « retiré de la vente » au
        // sens du réglage, mais il ne peut pas être présenté : même conséquence.
        active: plan.active && price !== null && price > 0,
        catalogueValue,
        savings: price === null ? 0 : Math.max(0, catalogueValue - price),
        courseCount: courses.length,
        // Un programme annoncé inférieur au catalogue publié serait un réglage
        // périmé : on ne promet jamais moins que ce qui est déjà ouvert.
        announcedCourseCount: Math.max(plan.announcedCourseCount ?? 0, courses.length),
        premiumCourseCount: prices.filter((p) => p > 0).length,
    };
}

/** Le pack a-t-il déjà été acquis ? Source de vérité : le plan de l'utilisateur. */
export async function isPremiumMember(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    return user?.plan === "PREMIUM";
}

export interface CourseAccess {
    /** Le Pack Premium a été acheté. */
    isPremium: boolean;
    /** Rôle administrateur : ouvre le catalogue sans l'avoir acheté — à ne pas confondre. */
    isAdmin: boolean;
    /** Cours débloqués à l'unité (achat, code d'accès, inscription gratuite). */
    ownedCourseIds: string[];
}

/**
 * État d'accès complet d'un visiteur, en une seule lecture — de quoi rendre le
 * catalogue sans interroger la base une fois par carte.
 *
 * Un ADMIN voit tout : c'est déjà la règle appliquée sur la fiche d'un cours.
 */
export async function getCourseAccess(userId: string | null | undefined): Promise<CourseAccess> {
    if (!userId) return { isPremium: false, isAdmin: false, ownedCourseIds: [] };

    const [user, purchases] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } }),
        prisma.purchase.findMany({
            where: { userId, courseId: { not: null } },
            select: { courseId: true },
        }),
    ]);

    return {
        isPremium: user?.plan === "PREMIUM",
        isAdmin: user?.role === "ADMIN",
        ownedCourseIds: purchases.map((p) => p.courseId as string),
    };
}

/** Accès à un cours précis : achat unitaire, pack premium, ou rôle administrateur. */
export async function hasCourseAccess(userId: string | null | undefined, courseId: string): Promise<boolean> {
    if (!userId) return false;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } });
    if (user?.plan === "PREMIUM" || user?.role === "ADMIN") return true;

    const purchase = await prisma.purchase.findFirst({ where: { userId, courseId } });
    return purchase !== null;
}
