/**
 * Client HTTP du Wallet API MADA.H — le service de portefeuille et de paiement
 * partagé avec Viktoo (https://wallet-api.madahoff.com), lui-même adossé à
 * Vanilla Pay International.
 *
 * ⚠ Serveur uniquement. La clé d'API identifie TOUTE l'application Everest :
 * quiconque la lit peut vider les portefeuilles de tous les utilisateurs. Elle ne
 * doit jamais atteindre le navigateur — donc aucun import de ce fichier depuis un
 * composant client, et jamais de préfixe NEXT_PUBLIC_ sur WALLET_API_KEY.
 *
 * Conventions imposées par le service et respectées ici :
 *  - les montants sont des ENTIERS dans l'unité mineure de la devise ; pour le MGA
 *    l'ariary, qui n'a pas de subdivision (25000 = 25 000 Ar) ;
 *  - les montants reviennent toujours en CHAÎNES, jamais en nombres ;
 *  - toute écriture monétaire porte un en-tête Idempotency-Key : rejouer la même
 *    clé avec le même corps rejoue la réponse au lieu de refaire l'opération.
 */

export type WalletCurrency = "MGA" | "EUR";
export type PaymentMode = "mobile_money" | "international";
export type PaymentPurpose = "TOPUP" | "DIRECT";
export type PaymentStatus = "INITIATED" | "PENDING" | "SUCCESS" | "FAILED";

export interface WalletDto {
    id: string;
    externalId: string;
    currency: WalletCurrency;
    balance: string;
    status: "ACTIVE" | "FROZEN";
    msisdn: string | null;
    holderName: string | null;
    metadata: unknown;
    createdAt: string;
    updatedAt: string;
}

export interface LedgerEntryDto {
    id: string;
    walletId: string;
    direction: "CREDIT" | "DEBIT";
    type: "TOPUP" | "PAYOUT" | "PAYOUT_REVERSAL" | "PAYMENT" | "REFUND" | "ADJUSTMENT";
    amount: string;
    balanceAfter: string;
    currency: WalletCurrency;
    description: string | null;
    reference: string | null;
    externalReference: string | null;
    createdAt: string;
}

export interface PaymentDto {
    id: string;
    reference: string;
    purpose: PaymentPurpose;
    status: PaymentStatus;
    mode: PaymentMode;
    currency: WalletCurrency;
    amount: string;
    amountReceived: string | null;
    paymentUrl: string | null;
    walletId: string | null;
    settled: boolean;
    settledAt: string | null;
    settlementError: string | null;
    externalReference: string | null;
    referenceVpi: string | null;
    returnUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CursorPage<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

/**
 * Erreur normalisée du Wallet API. `code` est l'identifiant stable renvoyé dans le
 * champ `error` (insufficient_funds, wallet_frozen, upstream_error…) : c'est sur lui
 * qu'il faut brancher la logique, jamais sur `message`, qui est destiné à l'humain.
 */
export class WalletApiError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
        this.name = "WalletApiError";
    }
}

const BASE_URL = (process.env.WALLET_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.WALLET_API_KEY || "";

/**
 * Les clés d'idempotence sont scopées par APPLICATION, pas par produit. La caisse
 * étant désormais partagée avec Viktoo, deux produits qui choisiraient la même
 * valeur — « order-42 » — se confondraient : le second recevrait la réponse
 * mémorisée du premier, ou un 409. Le préfixe est appliqué ici, au seul endroit
 * qui émet l'en-tête, pour qu'aucun appelant ne puisse l'oublier.
 */
const IDEMPOTENCY_PREFIX = "everest";

/** Le module de paiement est-il configuré ? Permet de dégrader proprement en dev. */
export function isWalletApiConfigured(): boolean {
    return Boolean(BASE_URL && API_KEY);
}

/**
 * Origine du Wallet API, transmise au navigateur avec chaque ouverture de paiement.
 *
 * C'est SA page de retour qui émet le postMessage « vpi:done » : le client doit
 * pouvoir comparer `event.origin` à cette valeur. Elle est renvoyée par l'API plutôt
 * que lue depuis une variable NEXT_PUBLIC_*, que Next.js fige à la compilation — un
 * changement d'environnement imposerait sinon de reconstruire l'image.
 */
export function walletApiOrigin(): string | null {
    if (!BASE_URL) return null;
    try {
        return new URL(BASE_URL).origin;
    } catch {
        return null;
    }
}

interface RequestOptions {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    /** Obligatoire en pratique sur toute écriture monétaire. */
    idempotencyKey?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!isWalletApiConfigured()) {
        throw new WalletApiError(
            "wallet_not_configured",
            503,
            "Le module de paiement n'est pas configuré (WALLET_API_URL / WALLET_API_KEY).",
        );
    }

    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
        "X-Api-Key": API_KEY,
        Accept: "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) {
        headers["Idempotency-Key"] = `${IDEMPOTENCY_PREFIX}-${options.idempotencyKey}`;
    }

    let response: Response;
    try {
        response = await fetch(url, {
            method: options.method ?? "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            // Ces réponses portent des soldes : jamais de cache.
            cache: "no-store",
        });
    } catch (error) {
        // Service injoignable : réseau, DNS, TLS. Distinct d'une erreur métier.
        throw new WalletApiError(
            "service_unavailable",
            503,
            `Service de paiement injoignable : ${error instanceof Error ? error.message : "erreur réseau"}`,
        );
    }

    const text = await response.text();
    let payload: any = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = null;
        }
    }

    if (!response.ok) {
        throw new WalletApiError(
            payload?.error ?? "upstream_error",
            response.status,
            payload?.message ?? `Le service de paiement a répondu ${response.status}`,
            payload?.details,
        );
    }

    return payload as T;
}

// ─── Conversion des montants ──────────────────────────────────────────────────

/**
 * Convertit un prix Everest (Decimal, éventuellement « 25000.00 ») vers l'entier
 * attendu par le Wallet API.
 *
 * Les deux devises exigent un ENTIER, pour des raisons distinctes :
 *  - l'ariary n'a pas de subdivision en usage — un centime d'ariary n'existe pas ;
 *  - l'euro en a une, mais elle ne survit pas au trajet : le Wallet API transmet le
 *    montant TEL QUEL à Vanilla Pay avec `devise: EUR`, et applique son taux EUR→MGA
 *    sur ce même nombre. Un montant exprimé en centimes y serait lu comme des euros,
 *    soit un facteur 100. Les tarifs en euros sont donc des euros entiers.
 *
 * Dans les deux cas on refuse, plutôt que d'arrondir en silence une fraction
 * significative — un tarif à virgule est une erreur de saisie, pas une intention.
 */
export function toMinorUnits(value: string | number, currency: WalletCurrency = "MGA"): number {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount)) {
        throw new WalletApiError("validation_error", 400, `Montant invalide : ${value}`);
    }
    const rounded = Math.round(amount);
    if (Math.abs(amount - rounded) > 0.005) {
        throw new WalletApiError(
            "validation_error",
            400,
            currency === "EUR"
                ? `Montant non entier en euros : ${value}. Le service de paiement ne transporte pas les centimes.`
                : `Montant non entier en ariary : ${value}. L'ariary n'a pas de subdivision.`,
        );
    }
    if (rounded <= 0) {
        throw new WalletApiError("validation_error", 400, "Le montant doit être strictement positif.");
    }
    return rounded;
}

/** Les montants reviennent en chaînes ; ce helper est le seul endroit qui les relit. */
export function fromMinorUnits(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// ─── Portefeuilles ────────────────────────────────────────────────────────────

/**
 * Normalise une adresse e-mail employée comme externalId : trim puis minuscules,
 * et RIEN D'AUTRE.
 *
 * En particulier on ne retire ni les points ni les suffixes +… : ce sont des
 * adresses distinctes pour la plupart des serveurs de messagerie, et les confondre
 * donnerait à jean+test@ l'accès au solde de jean@.
 *
 * Cette règle doit rester identique, au caractère près, à celle de Viktoo
 * (`normalizeEmailExternalId` de @repo/wallet-client) : `Jean@X.mg` et `jean@x.mg`
 * sont deux portefeuilles distincts. Everest vivant dans un autre dépôt, elle est
 * ici dupliquée et non importée — toute évolution doit être répercutée des deux
 * côtés.
 */
export function normalizeEmailExternalId(email: string): string {
    return email.trim().toLowerCase();
}

/**
 * Désigne le portefeuille d'une personne par son e-mail.
 *
 * Seul l'identifiant est encodé, jamais le préfixe `ext:` — le service applique un
 * decodeURIComponent sur le paramètre, et encoder les deux ferait un décodage de
 * trop sur un identifiant contenant lui-même un %.
 */
export function walletRefForEmail(email: string): string {
    return `ext:${encodeURIComponent(normalizeEmailExternalId(email))}`;
}

/** Idempotent sur externalId : rappelable à chaque connexion, renvoie l'existant. */
export function createWallet(input: {
    externalId: string;
    currency?: WalletCurrency;
    msisdn?: string;
    holderName?: string;
    metadata?: Record<string, unknown>;
}): Promise<{ wallet: WalletDto; created: boolean }> {
    return request("/v1/wallets", { method: "POST", body: input });
}

export function getWallet(ref: string): Promise<WalletDto> {
    return request(`/v1/wallets/${ref}`);
}

export function updateWallet(
    ref: string,
    input: { msisdn?: string | null; holderName?: string | null; status?: "ACTIVE" | "FROZEN" },
): Promise<WalletDto> {
    return request(`/v1/wallets/${ref}`, { method: "PATCH", body: input });
}

export function listTransactions(
    ref: string,
    query: { limit?: number; cursor?: string; type?: string; direction?: "CREDIT" | "DEBIT" } = {},
): Promise<CursorPage<LedgerEntryDto>> {
    return request(`/v1/wallets/${ref}/transactions`, { query });
}

/**
 * Débite le portefeuille. Échoue en 422 `insufficient_funds` si le solde ne suffit
 * pas — le contrôle et le débit sont indivisibles côté service, deux débits
 * simultanés ne peuvent pas rendre un solde négatif.
 */
export function debitWallet(
    ref: string,
    input: { amount: number; description?: string; externalReference?: string; metadata?: Record<string, unknown> },
    idempotencyKey: string,
): Promise<{ transaction: LedgerEntryDto; balance: string }> {
    return request(`/v1/wallets/${ref}/debit`, { method: "POST", body: input, idempotencyKey });
}

/** Crédit (remboursement d'une commande annulée, geste commercial…). */
export function creditWallet(
    ref: string,
    input: { amount: number; description?: string; externalReference?: string; metadata?: Record<string, unknown> },
    idempotencyKey: string,
): Promise<{ transaction: LedgerEntryDto; balance: string }> {
    return request(`/v1/wallets/${ref}/credit`, { method: "POST", body: input, idempotencyKey });
}

// ─── Paiements (argent entrant via Vanilla Pay) ───────────────────────────────

export function createPayment(
    input: {
        purpose: PaymentPurpose;
        amount: number;
        currency?: WalletCurrency;
        mode?: PaymentMode;
        /** Obligatoire si TOPUP, interdit si DIRECT. */
        walletRef?: string;
        returnUrl?: string;
        label?: string;
        externalReference?: string;
        description?: string;
        metadata?: Record<string, unknown>;
    },
    idempotencyKey: string,
): Promise<PaymentDto> {
    return request("/v1/payments", { method: "POST", body: input, idempotencyKey });
}

/**
 * Statut d'un paiement — ce n'est PAS une simple lecture : si le paiement n'est pas
 * dans un état terminal, le service réinterroge Vanilla Pay, applique le résultat et
 * crédite le portefeuille d'une recharge confirmée mais non réglée. C'est le filet
 * qui rattrape une notification perdue, et la seule source de vérité sur l'issue
 * d'un paiement (jamais les paramètres d'URL du retour navigateur).
 */
export function getPayment(reference: string): Promise<PaymentDto> {
    return request(`/v1/payments/${encodeURIComponent(reference)}`);
}
