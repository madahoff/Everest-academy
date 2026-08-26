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
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

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
 * Convertit un prix Everest (Decimal Ar, éventuellement « 25000.00 ») vers l'entier
 * attendu par le Wallet API. Les prix sont exprimés en ariary, devise sans
 * subdivision : un centime d'ariary n'existe pas, on refuse donc plutôt que
 * d'arrondir en silence une fraction significative.
 */
export function toMinorUnits(value: string | number): number {
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount)) {
        throw new WalletApiError("validation_error", 400, `Montant invalide : ${value}`);
    }
    const rounded = Math.round(amount);
    if (Math.abs(amount - rounded) > 0.005) {
        throw new WalletApiError(
            "validation_error",
            400,
            `Montant non entier en ariary : ${value}. L'ariary n'a pas de subdivision.`,
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

/** Désigne un portefeuille par l'identifiant Everest de son porteur. */
export function walletRef(userId: string): string {
    return `ext:${encodeURIComponent(userId)}`;
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

export function getWallet(userId: string): Promise<WalletDto> {
    return request(`/v1/wallets/${walletRef(userId)}`);
}

export function updateWallet(
    userId: string,
    input: { msisdn?: string | null; holderName?: string | null; status?: "ACTIVE" | "FROZEN" },
): Promise<WalletDto> {
    return request(`/v1/wallets/${walletRef(userId)}`, { method: "PATCH", body: input });
}

export function listTransactions(
    userId: string,
    query: { limit?: number; cursor?: string; type?: string; direction?: "CREDIT" | "DEBIT" } = {},
): Promise<CursorPage<LedgerEntryDto>> {
    return request(`/v1/wallets/${walletRef(userId)}/transactions`, { query });
}

/**
 * Débite le portefeuille. Échoue en 422 `insufficient_funds` si le solde ne suffit
 * pas — le contrôle et le débit sont indivisibles côté service, deux débits
 * simultanés ne peuvent pas rendre un solde négatif.
 */
export function debitWallet(
    userId: string,
    input: { amount: number; description?: string; externalReference?: string; metadata?: Record<string, unknown> },
    idempotencyKey: string,
): Promise<{ transaction: LedgerEntryDto; balance: string }> {
    return request(`/v1/wallets/${walletRef(userId)}/debit`, { method: "POST", body: input, idempotencyKey });
}

/** Crédit (remboursement d'une commande annulée, geste commercial…). */
export function creditWallet(
    userId: string,
    input: { amount: number; description?: string; externalReference?: string; metadata?: Record<string, unknown> },
    idempotencyKey: string,
): Promise<{ transaction: LedgerEntryDto; balance: string }> {
    return request(`/v1/wallets/${walletRef(userId)}/credit`, { method: "POST", body: input, idempotencyKey });
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
