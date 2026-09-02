/**
 * Devise de la requête en cours, côté serveur.
 *
 * Source unique de vérité pour tout ce qui affiche ou encaisse un montant : pages
 * rendues côté serveur ET routes d'API. Le montant d'une commande ne doit JAMAIS
 * être déduit d'une devise envoyée dans le corps de la requête — sinon un acheteur
 * choisirait son tarif.
 *
 * Le pays vient du middleware (`lib/geo.ts`) : en-tête de requête pour le rendu en
 * cours, cookie pour les requêtes suivantes.
 */

import { cookies, headers } from "next/headers";
import {
    COUNTRY_COOKIE,
    COUNTRY_HEADER,
    UNKNOWN_COUNTRY,
    currencyForCountry,
    isCountryCode,
    type Currency,
} from "@/lib/pricing";

/** Pays du visiteur, ou `XX` s'il n'a pas pu être déterminé. */
export async function getRequestCountry(): Promise<string> {
    const headerList = await headers();
    const fromMiddleware = headerList.get(COUNTRY_HEADER);
    if (isCountryCode(fromMiddleware)) return fromMiddleware.toUpperCase();

    // Repli : une route atteinte hors du champ du middleware (ou un rendu déclenché
    // sans requête HTTP) n'a pas l'en-tête, mais peut encore avoir le cookie.
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(COUNTRY_COOKIE)?.value;
    if (isCountryCode(fromCookie)) return fromCookie.toUpperCase();

    return UNKNOWN_COUNTRY;
}

/** Devise applicable au visiteur : ariary à Madagascar, euro ailleurs. */
export async function getRequestCurrency(): Promise<Currency> {
    return currencyForCountry(await getRequestCountry());
}
