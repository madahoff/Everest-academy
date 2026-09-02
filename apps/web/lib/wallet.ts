/**
 * Couche métier entre Everest et le Wallet API.
 *
 * Répartition des responsabilités, volontairement stricte :
 *  - le Wallet API détient le SOLDE, les ENCAISSEMENTS et le grand livre ;
 *  - Everest détient les ACCÈS aux cours, et la commande qui les relie à un paiement.
 *
 * Le Wallet API n'appelle jamais Everest en retour (aucun webhook sortant) : l'issue
 * d'un paiement direct s'apprend uniquement en sondant son statut. C'est
 * `syncOrder` / `syncTopup` qui font ce rattrapage, appelés à chaque consultation.
 */

import { prisma } from "@/lib/prisma";
import { PREMIUM_PACK_TITLE, getPremiumPlan } from "@/lib/premium";
import { UNAVAILABLE_ABROAD, methodsFor, resolvePrice, type Currency } from "@/lib/pricing";
import * as walletApi from "@/lib/wallet-api";
import { WalletApiError, fromMinorUnits, toMinorUnits, walletRefForEmail } from "@/lib/wallet-api";
import type { Order, OrderItem, PaymentMethod, Prisma } from "@prisma/client";

/** Erreur métier Everest (distincte d'une erreur du service de paiement). */
export class CheckoutError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "CheckoutError";
    }
}

/**
 * Devise du PORTEFEUILLE, et elle seule. Un portefeuille Everest est tenu en ariary,
 * quel que soit le pays de son titulaire : il est alimenté par Mobile Money malgache
 * et partagé avec Viktoo.
 *
 * La devise d'une COMMANDE, elle, dépend du pays du visiteur (voir `lib/pricing.ts`)
 * et voyage explicitement jusqu'ici — d'où le paramètre `currency` porté par chaque
 * constructeur d'articles. Les deux ne se confondent pas : c'est précisément parce
 * que le portefeuille est en ariary qu'il ne peut pas régler une commande en euros.
 */
const WALLET_CURRENCY = "MGA" as const;

/**
 * Le règlement au solde et le Mobile Money sont des chemins malgaches : le premier
 * puise dans un portefeuille en ariary, le second dans MVola / Orange / Airtel.
 * Une commande en euros ne peut donc être réglée que par carte.
 */
function assertMethodAllowed(currency: Currency, method: PaymentMethod): void {
    if (methodsFor(currency).includes(method)) return;

    throw new CheckoutError(
        "method_unavailable",
        400,
        method === "WALLET"
            ? "Votre portefeuille est tenu en ariary : il ne peut pas régler une commande en euros. Réglez par carte bancaire."
            : "Le Mobile Money n'est disponible que depuis Madagascar. Réglez par carte bancaire.",
    );
}

/**
 * URL publique du site, pour construire les URL de retour de paiement.
 * Volontairement sans préfixe NEXT_PUBLIC_ : cette valeur n'est lue que côté serveur,
 * et un nom public serait figé à la compilation.
 */
function appUrl(): string {
    const base = process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || "";
    return base.replace(/\/+$/, "");
}

/**
 * Le chemin de retour vient du navigateur : on n'accepte qu'un chemin relatif à
 * notre propre origine. `//evil.tld` est un chemin valide pour une URL et une
 * redirection ouverte pour un hameçonneur — d'où le second test.
 */
function absoluteReturnUrl(returnPath?: string | null): string | undefined {
    const base = appUrl();
    if (!base) return undefined;
    if (!returnPath || !returnPath.startsWith("/") || returnPath.startsWith("//")) return base;
    return `${base}${returnPath}`;
}

function modeFor(method: PaymentMethod): walletApi.PaymentMode {
    return method === "CARD" ? "international" : "mobile_money";
}

/**
 * Vanilla Pay refuse le champ `panier` au-delà d'une longueur qu'il ne documente
 * nulle part — il répond « Panier trop long », et le paiement n'est jamais ouvert.
 * Ses propres exemples tiennent en une dizaine de caractères (`panier123`), d'où
 * cette troncature franche : ce libellé n'est qu'un repère visuel sur la page de
 * paiement, la vraie identification de la commande passe par `externalReference`.
 */
const VPI_LABEL_MAX = 20;

function vpiLabel(value: string): string {
    return value.trim().slice(0, VPI_LABEL_MAX).trim();
}

// ─── Portefeuille ─────────────────────────────────────────────────────────────

/**
 * Ouvre (ou retrouve) le portefeuille de l'utilisateur. Idempotent sur `externalId`
 * côté service : invocable à chaque affichage sans risque.
 *
 * L'identité du portefeuille est l'E-MAIL, pas l'identifiant Everest — c'est la
 * condition pour que le solde soit le même sur Everest et sur Viktoo, qui partagent
 * désormais une seule application au sens du Wallet API.
 *
 * L'e-mail est relu EN BASE et jamais pris dans le jeton de session : il donne accès
 * à l'argent, la source de vérité doit être la table `users`.
 */
export async function ensureUserWallet(userId: string): Promise<{ wallet: walletApi.WalletDto; ref: string }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, walletId: true },
    });

    if (!user) throw new CheckoutError("user_not_found", 404, "Utilisateur introuvable");
    if (!user.email) throw new CheckoutError("missing_email", 400, "Aucune adresse e-mail sur ce compte");

    const ref = walletRefForEmail(user.email);

    const { wallet } = await walletApi.createWallet({
        externalId: walletApi.normalizeEmailExternalId(user.email),
        currency: WALLET_CURRENCY,
        holderName: user.name || undefined,
        metadata: { app: "everest-academy" },
    });

    if (user.walletId !== wallet.id) {
        await prisma.user.update({ where: { id: user.id }, data: { walletId: wallet.id } });
    }

    return { wallet, ref };
}

/**
 * Recopie le solde distant dans `users.walletBalance`. Ce champ n'a AUCUNE autorité :
 * il n'est jamais lu pour décider d'un débit, il ne sert qu'à afficher un montant
 * plausible sur une page rendue côté serveur quand le service est momentanément
 * injoignable. Toute décision monétaire passe par le Wallet API.
 */
async function mirrorBalance(userId: string, balance: string): Promise<void> {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { walletBalance: fromMinorUnits(balance) },
        });
    } catch {
        // Un miroir d'affichage qui échoue ne doit jamais faire échouer un paiement.
    }
}

export interface WalletSummary {
    walletId: string;
    balance: number;
    currency: string;
    status: "ACTIVE" | "FROZEN";
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
    const { wallet } = await ensureUserWallet(userId);
    await mirrorBalance(userId, wallet.balance);
    return {
        walletId: wallet.id,
        balance: fromMinorUnits(wallet.balance),
        currency: wallet.currency,
        status: wallet.status,
    };
}

// ─── Commandes ────────────────────────────────────────────────────────────────

export interface OrderDraftItem {
    courseId?: string;
    productId?: string;
    /** Ligne « Pack Premium » : ouvre tout le catalogue, ne vise aucun article. */
    isPremiumPack?: boolean;
    title: string;
    amount: number;
}

export type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Construit la commande à partir des cours demandés, en refusant ceux auxquels
 * l'utilisateur a déjà accès — payer deux fois le même cours est toujours une erreur,
 * jamais une intention.
 *
 * `currency` est la devise du VISITEUR, résolue côté serveur depuis son pays. Elle
 * décide lequel des deux tarifs du cours fait foi ; elle n'est jamais lue dans le
 * corps de la requête, faute de quoi un acheteur choisirait son prix.
 */
export async function buildCourseItems(
    userId: string,
    courseIds: string[],
    currency: Currency,
): Promise<OrderDraftItem[]> {
    if (await hasPremiumPlan(userId)) {
        throw new CheckoutError("already_owned", 409, "Votre Pack Premium vous donne déjà accès à ce cours");
    }

    const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true, price: true, priceEur: true },
    });

    if (courses.length !== courseIds.length) {
        throw new CheckoutError("course_not_found", 404, "Un des cours demandés est introuvable");
    }

    const owned = await prisma.purchase.findMany({
        where: { userId, courseId: { in: courseIds } },
        select: { courseId: true },
    });
    const ownedIds = new Set(owned.map((p) => p.courseId));

    const items: OrderDraftItem[] = [];
    for (const course of courses) {
        if (ownedIds.has(course.id)) {
            throw new CheckoutError("already_owned", 409, `Vous avez déjà accès à « ${course.title} »`);
        }

        const view = resolvePrice({ price: String(course.price), priceEur: course.priceEur?.toString() }, currency);

        if (view.free) {
            throw new CheckoutError("free_course", 400, "Ce cours est gratuit : utilisez l'inscription directe");
        }
        // Tarif jamais saisi dans cette devise : le cours n'est pas en vente ici. Le
        // catalogue le dit déjà, cette garde couvre l'appel direct à l'API.
        if (view.amount === null) {
            throw new CheckoutError("price_unavailable", 409, UNAVAILABLE_ABROAD);
        }

        items.push({ courseId: course.id, title: course.title, amount: view.amount });
    }

    return items;
}

async function hasPremiumPlan(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    return user?.plan === "PREMIUM";
}

/**
 * Construit la commande d'un Pack Premium. Le prix vient de la configuration serveur,
 * jamais du client — c'est la seule ligne de commande dont le montant n'est adossé à
 * aucune ligne du catalogue.
 */
export async function buildPremiumPackItem(userId: string, currency: Currency): Promise<OrderDraftItem[]> {
    if (await hasPremiumPlan(userId)) {
        throw new CheckoutError("already_premium", 409, "Vous disposez déjà du Pack Premium");
    }

    const plan = await getPremiumPlan();
    if (!plan.active) {
        throw new CheckoutError("premium_unavailable", 409, "Le Pack Premium n'est pas proposé pour le moment");
    }

    const amount = currency === "EUR" ? plan.priceEur : plan.price;
    if (amount === null || amount <= 0) {
        throw new CheckoutError("price_unavailable", 409, UNAVAILABLE_ABROAD);
    }

    return [{ isPremiumPack: true, title: PREMIUM_PACK_TITLE, amount }];
}

/** Items du panier en base — source de vérité des prix, jamais ceux envoyés par le client. */
export async function buildCartItems(userId: string, currency: Currency): Promise<OrderDraftItem[]> {
    const isPremium = await hasPremiumPlan(userId);

    const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: { course: true, product: true },
    });

    if (cartItems.length === 0) {
        throw new CheckoutError("empty_cart", 400, "Votre panier est vide");
    }

    const courseIds = cartItems.filter((i) => i.courseId).map((i) => i.courseId as string);
    const owned = await prisma.purchase.findMany({
        where: { userId, courseId: { in: courseIds } },
        select: { courseId: true },
    });
    const ownedIds = new Set(owned.map((p) => p.courseId));

    const items: OrderDraftItem[] = [];
    for (const item of cartItems) {
        if (item.course) {
            // Un cours déjà acquis (offert entre-temps, code d'accès utilisé, Pack Premium)
            // est retiré silencieusement du panier plutôt que de bloquer tout le règlement.
            if (isPremium || ownedIds.has(item.course.id)) continue;

            const view = resolvePrice(
                { price: String(item.course.price), priceEur: item.course.priceEur?.toString() },
                currency,
            );
            // Un article sans tarif dans la devise du payeur bloque, lui, tout le
            // règlement : le retirer en silence ferait payer un panier amputé sans
            // que l'acheteur l'ait décidé.
            if (view.amount === null) {
                throw new CheckoutError(
                    "price_unavailable",
                    409,
                    `« ${item.course.title} » n'est pas proposé à l'achat depuis votre pays. Retirez-le du panier pour continuer.`,
                );
            }
            items.push({ courseId: item.course.id, title: item.course.title, amount: view.amount });
        } else if (item.product) {
            const view = resolvePrice(
                { price: String(item.product.price), priceEur: item.product.priceEur?.toString() },
                currency,
            );
            if (view.amount === null) {
                throw new CheckoutError(
                    "price_unavailable",
                    409,
                    `« ${item.product.name} » n'est pas proposé à l'achat depuis votre pays. Retirez-le du panier pour continuer.`,
                );
            }
            items.push({ productId: item.product.id, title: item.product.name, amount: view.amount });
        }
    }

    if (items.length === 0) {
        throw new CheckoutError(
            "already_owned",
            409,
            isPremium
                ? "Votre Pack Premium couvre déjà tous les cours de votre panier"
                : "Vous avez déjà accès à tous les articles du panier",
        );
    }

    return items;
}

export interface PayOrderResult {
    order: OrderWithItems;
    /** URL de paiement Vanilla Pay à présenter au payeur (méthodes MOBILE_MONEY / CARD). */
    paymentUrl?: string;
    mode?: walletApi.PaymentMode;
    balance?: number;
}

/**
 * Crée la commande puis la règle selon la méthode choisie.
 *
 * WALLET : le débit est synchrone et l'accès est accordé dans la foulée.
 * MOBILE_MONEY / CARD : un paiement Vanilla Pay est ouvert et la commande reste
 * PENDING jusqu'à ce qu'un sondage de statut la confirme.
 *
 * `currency` est celle des articles, déjà résolue par leur constructeur. Elle est
 * écrite sur la commande — qui garde ainsi la trace de ce qui a réellement été
 * facturé, même si le tarif ou le pays du client changent ensuite.
 */
export async function createAndPayOrder(input: {
    userId: string;
    items: OrderDraftItem[];
    method: PaymentMethod;
    currency: Currency;
    returnPath?: string | null;
    label?: string;
}): Promise<PayOrderResult> {
    const { userId, items, method, currency } = input;

    assertMethodAllowed(currency, method);

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    // Lève si le montant n'est pas entier — ni centime d'ariary, ni centime d'euro.
    const minorTotal = toMinorUnits(total, currency);

    const order = await prisma.order.create({
        data: {
            userId,
            amount: total,
            currency,
            method,
            status: "PENDING",
            items: {
                create: items.map((item) => ({
                    courseId: item.courseId ?? null,
                    productId: item.productId ?? null,
                    isPremiumPack: item.isPremiumPack ?? false,
                    title: item.title,
                    amount: item.amount,
                })),
            },
        },
        include: { items: true },
    });

    if (method === "WALLET") {
        const { ref } = await ensureUserWallet(userId);

        let result: { transaction: walletApi.LedgerEntryDto; balance: string };
        try {
            result = await walletApi.debitWallet(
                ref,
                {
                    amount: minorTotal,
                    description: input.label ?? `Commande Everest ${order.id}`,
                    externalReference: order.id,
                },
                // La clé est l'identifiant de la commande : un rejeu (double clic, retry
                // réseau) rejoue la réponse mémorisée au lieu de débiter deux fois.
                `order-${order.id}`,
            );
        } catch (error) {
            const reason = error instanceof Error ? error.message : "Échec du débit";
            await prisma.order.update({
                where: { id: order.id },
                data: { status: "FAILED", failureReason: reason },
            });
            throw error;
        }

        await prisma.order.update({
            where: { id: order.id },
            data: { ledgerEntryId: result.transaction.id },
        });
        await mirrorBalance(userId, result.balance);

        try {
            const granted = await grantOrderAccess(order.id);
            return { order: granted, balance: fromMinorUnits(result.balance) };
        } catch (error) {
            // Le débit a abouti, l'octroi non. Surtout PAS d'erreur remontée telle
            // quelle : le client réessaierait, et une nouvelle commande porterait une
            // nouvelle clé d'idempotence — donc un second débit. On renvoie la commande
            // en l'état ; `syncOrder` la rattrapera au prochain sondage.
            console.error(`Octroi des accès échoué après débit (commande ${order.id})`, error);
            return { order: await loadOrder(order.id), balance: fromMinorUnits(result.balance) };
        }
    }

    // Paiement direct : l'argent est encaissé sur le compte marchand, aucun
    // portefeuille n'est touché — inutile d'en ouvrir un pour acheter un cours.
    let payment: walletApi.PaymentDto;
    try {
        payment = await walletApi.createPayment(
            {
                purpose: "DIRECT",
                amount: minorTotal,
                currency,
                mode: modeFor(method),
                externalReference: order.id,
                label: vpiLabel(input.label ?? "Formation Everest"),
                returnUrl: absoluteReturnUrl(input.returnPath),
                metadata: { orderId: order.id, userId },
            },
            `order-${order.id}`,
        );
    } catch (error) {
        const reason = error instanceof Error ? error.message : "Échec de l'ouverture du paiement";
        await prisma.order.update({
            where: { id: order.id },
            data: { status: "FAILED", failureReason: reason },
        });
        throw error;
    }

    const updated = await prisma.order.update({
        where: { id: order.id },
        data: { paymentReference: payment.reference, paymentUrl: payment.paymentUrl },
        include: { items: true },
    });

    return { order: updated, paymentUrl: payment.paymentUrl ?? undefined, mode: payment.mode };
}

/**
 * Accorde les accès d'une commande réglée. Idempotent : `grantedAt` est réclamé par
 * une mise à jour conditionnelle atomique, si bien que deux sondages simultanés ne
 * peuvent pas créer deux fois le même Purchase. Si l'octroi échoue ensuite, la
 * réclamation est relâchée pour que le prochain appel réessaie.
 */
export async function grantOrderAccess(orderId: string): Promise<OrderWithItems> {
    const claim = await prisma.order.updateMany({
        where: { id: orderId, grantedAt: null },
        data: { grantedAt: new Date(), paidAt: new Date(), status: "PAID" },
    });

    if (claim.count === 0) {
        // Déjà accordée par un autre appel : on n'y touche pas.
        return loadOrder(orderId);
    }

    try {
        const order = await loadOrder(orderId);

        await prisma.$transaction(async (tx) => {
            for (const item of order.items) {
                if (item.isPremiumPack) {
                    await grantPremiumPack(tx, order.userId);
                } else if (item.courseId) {
                    const existing = await tx.purchase.findFirst({
                        where: { userId: order.userId, courseId: item.courseId },
                    });
                    if (!existing) {
                        await tx.purchase.create({
                            data: { userId: order.userId, courseId: item.courseId, amount: item.amount },
                        });
                        await tx.course.update({
                            where: { id: item.courseId },
                            data: { salesCount: { increment: 1 } },
                        });
                    }
                } else if (item.productId) {
                    await tx.purchase.create({
                        data: { userId: order.userId, productId: item.productId, amount: item.amount },
                    });
                }
            }

            // Le panier ne doit plus contenir ce qui vient d'être payé.
            await tx.cartItem.deleteMany({
                where: {
                    userId: order.userId,
                    OR: [
                        { courseId: { in: order.items.map((i) => i.courseId).filter(Boolean) as string[] } },
                        { productId: { in: order.items.map((i) => i.productId).filter(Boolean) as string[] } },
                    ],
                },
            });
        });

        return loadOrder(orderId);
    } catch (error) {
        // Relâcher la réclamation : sans cela la commande resterait PAID sans accès,
        // et aucun sondage ultérieur ne la rattraperait.
        await prisma.order.updateMany({ where: { id: orderId }, data: { grantedAt: null } });
        throw error;
    }
}

/**
 * Ouvre le catalogue à un acheteur du Pack Premium.
 *
 * Le plan seul suffirait à autoriser la lecture, mais tout le produit interroge déjà
 * les `Purchase` — « mes cours » du profil, les certifications, le panier. On matérialise
 * donc l'existant, et le plan prend le relais pour les cours publiés ensuite.
 *
 * `salesCount` n'est pas incrémenté : ce compteur mesure les ventes d'un cours, et le
 * pack n'en est pas une.
 */
async function grantPremiumPack(
    tx: Prisma.TransactionClient,
    userId: string,
): Promise<void> {
    await tx.user.update({
        where: { id: userId },
        data: { plan: "PREMIUM", premiumSince: new Date() },
    });

    const [courses, owned] = await Promise.all([
        tx.course.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
        tx.purchase.findMany({ where: { userId, courseId: { not: null } }, select: { courseId: true } }),
    ]);

    const ownedIds = new Set(owned.map((p) => p.courseId));
    const missing = courses.filter((course) => !ownedIds.has(course.id));

    if (missing.length > 0) {
        await tx.purchase.createMany({
            data: missing.map((course) => ({ userId, courseId: course.id, amount: 0 })),
        });
    }

    // Plus rien à régler à l'unité : le panier n'aurait plus de sens.
    await tx.cartItem.deleteMany({ where: { userId, courseId: { not: null } } });
}

async function loadOrder(orderId: string): Promise<OrderWithItems> {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new CheckoutError("order_not_found", 404, "Commande introuvable");
    return order;
}

/**
 * Réconcilie une commande avec le Wallet API. C'est le seul chemin par lequel Everest
 * apprend qu'un paiement direct a réussi : à appeler au retour du payeur, puis à
 * chaque ouverture de la page de commande.
 */
export async function syncOrder(order: OrderWithItems): Promise<OrderWithItems> {
    // Réparation : payée mais accès jamais accordés (échec technique au moment de l'octroi).
    if (order.status === "PAID" && !order.grantedAt) {
        return grantOrderAccess(order.id);
    }

    // Réparation du règlement au solde : le débit a abouti (ledgerEntryId présent) mais
    // l'octroi a échoué juste après. Sans ce rattrapage, l'argent serait prélevé sans
    // que le cours ne soit jamais débloqué, et rien ne repasserait dessus.
    if (order.status === "PENDING" && order.method === "WALLET" && order.ledgerEntryId && !order.grantedAt) {
        return grantOrderAccess(order.id);
    }

    if (order.status !== "PENDING" || !order.paymentReference) {
        return order;
    }

    let payment: walletApi.PaymentDto;
    try {
        payment = await walletApi.getPayment(order.paymentReference);
    } catch (error) {
        // Service momentanément indisponible : la commande reste PENDING, le prochain
        // sondage réessaiera. Ne jamais marquer FAILED sur une erreur de transport.
        if (error instanceof WalletApiError && error.status >= 500) return order;
        throw error;
    }

    if (payment.status === "SUCCESS") {
        return grantOrderAccess(order.id);
    }

    if (payment.status === "FAILED") {
        await prisma.order.update({
            where: { id: order.id },
            data: { status: "FAILED", failureReason: "Paiement échoué ou abandonné" },
        });
        return loadOrder(order.id);
    }

    return order;
}

// ─── Recharges ────────────────────────────────────────────────────────────────

export async function createTopup(input: {
    userId: string;
    amount: number;
    method: PaymentMethod;
    returnPath?: string | null;
}) {
    if (input.method === "WALLET") {
        throw new CheckoutError("invalid_method", 400, "Une recharge ne peut pas être payée par le solde");
    }

    // Une recharge crédite le portefeuille, tenu en ariary : elle l'est donc aussi,
    // quel que soit le pays depuis lequel elle est faite.
    const minorAmount = toMinorUnits(input.amount, WALLET_CURRENCY);
    const { ref } = await ensureUserWallet(input.userId);

    const payment = await walletApi.createPayment(
        {
            purpose: "TOPUP",
            walletRef: ref,
            amount: minorAmount,
            currency: WALLET_CURRENCY,
            mode: modeFor(input.method),
            label: vpiLabel("Recharge Everest"),
            returnUrl: absoluteReturnUrl(input.returnPath ?? "/wallet"),
            metadata: { userId: input.userId },
        },
        `topup-${input.userId}-${Date.now()}`,
    );

    // Créé après coup : si cette écriture échoue, la recharge aboutit quand même —
    // c'est le Wallet API qui crédite le portefeuille, pas Everest. Seul le suivi
    // local de la recharge serait perdu.
    const topup = await prisma.walletTopup.create({
        data: {
            userId: input.userId,
            reference: payment.reference,
            amount: input.amount,
            currency: WALLET_CURRENCY,
            method: input.method,
            status: payment.status,
            settled: payment.settled,
            paymentUrl: payment.paymentUrl,
        },
    });

    return { topup, paymentUrl: payment.paymentUrl, mode: payment.mode };
}

/**
 * Réconcilie une recharge. Le crédit du portefeuille est fait par le Wallet API
 * lui-même : Everest ne recopie ici que l'état, pour l'afficher.
 */
export async function syncTopup(reference: string, userId: string) {
    const topup = await prisma.walletTopup.findFirst({ where: { reference, userId } });
    if (!topup) throw new CheckoutError("topup_not_found", 404, "Recharge introuvable");

    const terminal = (topup.status === "SUCCESS" && topup.settled) || topup.status === "FAILED";
    if (terminal) return topup;

    let payment: walletApi.PaymentDto;
    try {
        payment = await walletApi.getPayment(reference);
    } catch (error) {
        if (error instanceof WalletApiError && error.status >= 500) return topup;
        throw error;
    }

    const updated = await prisma.walletTopup.update({
        where: { id: topup.id },
        data: {
            status: payment.status,
            settled: payment.settled,
            settlementError: payment.settlementError,
        },
    });

    // Le portefeuille a été crédité par le Wallet API : on rafraîchit le miroir
    // d'affichage. Un échec ici n'a aucune conséquence sur l'argent réel.
    if (payment.settled) {
        await getWalletSummary(userId).catch(() => null);
    }

    return updated;
}

// ─── Sérialisation pour l'API HTTP ────────────────────────────────────────────

export interface OrderPayload {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number;
    currency: string;
    paymentUrl: string | null;
    failureReason: string | null;
    granted: boolean;
    /** Commande de Pack Premium : tout le catalogue est ouvert, aucun cours à cibler. */
    premium: boolean;
    items: { courseId: string | null; productId: string | null; title: string; amount: number }[];
    /** Première section du premier cours acheté : où emmener l'apprenant après paiement. */
    firstCourseId: string | null;
    firstSectionId: string | null;
    pollUrl: string;
}

export async function orderPayload(order: OrderWithItems): Promise<OrderPayload> {
    const firstCourseId = order.items.find((item) => item.courseId)?.courseId ?? null;

    let firstSectionId: string | null = null;
    if (firstCourseId && order.status === "PAID") {
        const section = await prisma.section.findFirst({
            where: { courseId: firstCourseId },
            orderBy: { order: "asc" },
            select: { id: true },
        });
        firstSectionId = section?.id ?? null;
    }

    return {
        id: order.id,
        status: order.status,
        method: order.method,
        amount: Number(order.amount),
        currency: order.currency,
        paymentUrl: order.paymentUrl,
        failureReason: order.failureReason,
        granted: order.grantedAt !== null,
        premium: order.items.some((item) => item.isPremiumPack),
        items: order.items.map((item) => ({
            courseId: item.courseId,
            productId: item.productId,
            title: item.title,
            amount: Number(item.amount),
        })),
        firstCourseId,
        firstSectionId,
        pollUrl: `/api/orders/${order.id}`,
    };
}
