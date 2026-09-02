/**
 * Tarification régionale — Ariary à Madagascar, euro partout ailleurs.
 *
 * Deux tarifs coexistent sur chaque article vendable (cours, produit, Pack Premium) :
 * `price` en ariary et `priceEur` en euros. Ce ne sont PAS deux vues d'un même
 * montant : aucun taux de change n'intervient nulle part dans le produit, les deux
 * valeurs sont fixées à la main depuis la console d'administration. Un article dont
 * le tarif en euros n'a pas été saisi n'est simplement pas proposé hors de
 * Madagascar — mieux vaut une absence qu'une conversion inventée.
 *
 * Ce module est volontairement PUR et sans dépendance : il est importé aussi bien
 * par le middleware (runtime Edge), par des composants serveur, que par des
 * composants client.
 */

export type Currency = "MGA" | "EUR";

/** Pays du catalogue : le seul où les prix sont affichés et réglés en ariary. */
export const HOME_COUNTRY = "MG";

/** Devise appliquée quand le pays du visiteur n'a pas pu être déterminé. */
export const HOME_CURRENCY: Currency = "MGA";

/**
 * Pays indéterminé. Mémorisé comme tel plutôt que laissé vide, pour ne pas
 * relancer une géolocalisation à chaque requête d'un visiteur non localisable.
 */
export const UNKNOWN_COUNTRY = "XX";

/** Cookie où le middleware mémorise le pays résolu. */
export const COUNTRY_COOKIE = "everest_country";

/**
 * En-tête interne par lequel le middleware transmet le pays à la requête EN COURS.
 * Sans lui, le cookie posé sur la réponse ne serait lisible qu'à la requête suivante,
 * et la toute première page d'un visiteur étranger s'afficherait en ariary.
 */
export const COUNTRY_HEADER = "x-everest-country";

/** Un mois : le pays d'un visiteur ne change pas d'une visite à l'autre. */
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Une heure : durée de mémorisation d'un échec de géolocalisation. */
export const UNKNOWN_COOKIE_MAX_AGE = 60 * 60;

/**
 * Devise applicable à un pays.
 *
 * Tout ce qui n'est pas explicitement Madagascar bascule en euros — SAUF l'inconnu,
 * qui retombe sur l'ariary. Un doute doit ramener au comportement historique, jamais
 * imposer une devise étrangère à un visiteur malgache mal localisé.
 */
export function currencyForCountry(country: string | null | undefined): Currency {
    if (!country) return HOME_CURRENCY;
    const code = country.trim().toUpperCase();
    if (!code || code === UNKNOWN_COUNTRY || code === HOME_COUNTRY) return HOME_CURRENCY;
    return "EUR";
}

/** Le pays est-il un code ISO 3166-1 alpha-2 plausible ? */
export function isCountryCode(value: string | null | undefined): value is string {
    return typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim());
}

// ─── Affichage ────────────────────────────────────────────────────────────────

/**
 * Montant formaté pour l'affichage.
 *
 * Aucune décimale dans les deux devises : l'ariary n'a pas de subdivision, et le
 * tarif en euros est contraint aux euros entiers (voir `toMinorUnits`).
 */
export function formatAmount(amount: number, currency: Currency): string {
    const rounded = Math.round(amount);
    const formatted = rounded.toLocaleString("fr-FR");
    return currency === "EUR" ? `${formatted} €` : `${formatted} Ar`;
}

/** Symbole seul, pour les libellés de champ et les en-têtes de colonne. */
export function currencySymbol(currency: Currency): string {
    return currency === "EUR" ? "€" : "Ar";
}

// ─── Résolution du tarif d'un article ─────────────────────────────────────────

/** Un article porteur des deux tarifs. Les Decimal Prisma arrivent en chaînes. */
export interface PricedItem {
    price: number | string;
    priceEur?: number | string | null;
}

export interface PriceView {
    currency: Currency;
    /**
     * Montant à afficher ET à régler dans cette devise.
     * `null` : l'article n'a pas de tarif dans cette devise — il n'est pas vendable ici.
     */
    amount: number | null;
    /** Article offert : gratuit partout, quelle que soit la devise. */
    free: boolean;
    /** Peut-il être présenté à la vente auprès de ce visiteur ? */
    sellable: boolean;
}

function toNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Tarif d'un article dans la devise du visiteur.
 *
 * La gratuité se lit toujours sur le tarif en ariary, qui fait référence : un cours
 * offert l'est pour tout le monde, et n'attend aucun tarif en euros.
 */
export function resolvePrice(item: PricedItem, currency: Currency): PriceView {
    const ar = toNumber(item.price) ?? 0;

    if (ar <= 0) {
        return { currency, amount: 0, free: true, sellable: true };
    }

    if (currency === "MGA") {
        return { currency, amount: ar, free: false, sellable: true };
    }

    const eur = toNumber(item.priceEur);
    if (eur === null || eur <= 0) {
        return { currency, amount: null, free: false, sellable: false };
    }

    return { currency, amount: eur, free: false, sellable: true };
}

/** Libellé prêt à afficher d'un tarif résolu. */
export function formatPriceView(view: PriceView, options?: { unavailable?: string }): string {
    if (view.free) return "Gratuit";
    if (view.amount === null) return options?.unavailable ?? "Bientôt disponible";
    return formatAmount(view.amount, view.currency);
}

/**
 * Message affiché à un visiteur étranger devant un article sans tarif en euros.
 * Centralisé ici pour ne pas être reformulé différemment à chaque écran.
 */
export const UNAVAILABLE_ABROAD =
    "Ce contenu n'est pas encore proposé à l'achat depuis votre pays. Écrivez-nous pour y accéder.";

// ─── Moyens de paiement ───────────────────────────────────────────────────────

/**
 * Moyens de règlement ouverts dans une devise donnée.
 *
 * Hors ariary, il ne reste que la carte : le Mobile Money est un service malgache
 * (MVola, Orange Money, Airtel Money) qu'aucun payeur étranger ne peut utiliser, et
 * le portefeuille Everest est tenu en ariary — il ne peut pas solder une commande
 * libellée en euros.
 */
export function methodsFor(currency: Currency): ("WALLET" | "MOBILE_MONEY" | "CARD")[] {
    return currency === "EUR" ? ["CARD"] : ["WALLET", "MOBILE_MONEY", "CARD"];
}

/**
 * Moyen retenu quand l'appelant n'en désigne aucun. En ariary c'est le solde, comme
 * depuis toujours ; en euros la carte, seul chemin ouvert.
 *
 * Une méthode explicitement DEMANDÉE mais indisponible n'est jamais remplacée en
 * silence : elle est refusée avec un message, sans quoi un acheteur croirait avoir
 * payé par un moyen qu'il n'a pas choisi.
 */
export function defaultMethodFor(currency: Currency): "WALLET" | "CARD" {
    return currency === "EUR" ? "CARD" : "WALLET";
}
