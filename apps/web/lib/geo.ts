/**
 * Localisation du visiteur — uniquement pour choisir la devise d'affichage.
 *
 * Trois sources, dans l'ordre de confiance décroissante :
 *  1. un réglage d'exploitation (`GEO_FORCE_COUNTRY`), qui court-circuite tout —
 *     indispensable pour tester la vitrine en euros depuis Antananarivo ;
 *  2. un en-tête posé par le reverse proxy (Cloudflare, Vercel…) quand il y en a un ;
 *  3. à défaut, une interrogation d'un service de géolocalisation d'IP, faite UNE
 *     SEULE FOIS par visiteur puis mémorisée en cookie.
 *
 * Écrit sans dépendance et sans API Node : ce module est importé par le middleware,
 * qui s'exécute dans le runtime Edge.
 *
 * ⚠ Ce n'est pas un contrôle d'accès. Un en-tête peut être forgé si le proxy ne le
 * réécrit pas, et le cookie appartient au navigateur. L'enjeu se limite à savoir
 * lequel des deux tarifs — tous deux fixés par l'administration — est présenté.
 */

import { UNKNOWN_COUNTRY, isCountryCode } from "@/lib/pricing";

/**
 * En-têtes de pays posés par les hébergeurs et CDN courants. Le premier renseigné
 * gagne ; aucun n'est présent sur l'infrastructure Traefik actuelle, d'où le repli
 * par géolocalisation d'IP.
 */
const GEO_HEADERS = [
    "cf-ipcountry", // Cloudflare
    "x-vercel-ip-country", // Vercel
    "x-geo-country",
    "x-country-code",
];

/**
 * Service de géolocalisation. Surchargeable par `GEO_LOOKUP_URL` (le jeton `{ip}` y
 * est remplacé) pour basculer sur un service payant ou une base locale sans toucher
 * au code. Le format de réponse accepté est soit un code pays brut, soit un JSON
 * portant `country_code`, `countryCode` ou `country`.
 */
const DEFAULT_LOOKUP_URL = "https://ipapi.co/{ip}/country/";

/**
 * Une géolocalisation ne doit jamais retarder l'affichage : passé ce délai on
 * abandonne et le visiteur voit le catalogue en ariary, comportement historique.
 */
const LOOKUP_TIMEOUT_MS = 1200;

/** Pays imposé par l'exploitation, s'il y en a un. */
export function forcedCountry(): string | null {
    const forced = process.env.GEO_FORCE_COUNTRY?.trim();
    return isCountryCode(forced) ? forced.toUpperCase() : null;
}

/** Pays annoncé par le reverse proxy, s'il en annonce un. */
export function countryFromHeaders(headers: Headers): string | null {
    for (const name of GEO_HEADERS) {
        const value = headers.get(name);
        if (isCountryCode(value)) return value.trim().toUpperCase();
    }
    return null;
}

/**
 * IP publique du visiteur.
 *
 * `X-Forwarded-For` est une LISTE, du client vers le proxy le plus proche : la
 * première entrée publique est celle du visiteur. On ignore les adresses privées,
 * qui sont celles du réseau Docker interne et ne renseignent sur aucun pays.
 */
export function clientIp(headers: Headers): string | null {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
        for (const part of forwarded.split(",")) {
            const ip = part.trim();
            if (ip && !isPrivateIp(ip)) return ip;
        }
    }

    const real = headers.get("x-real-ip")?.trim();
    if (real && !isPrivateIp(real)) return real;

    return null;
}

/** Adresses non routables : boucle locale, réseaux privés, IPv6 locales. */
export function isPrivateIp(ip: string): boolean {
    const value = ip.replace(/^\[|\]$/g, "").toLowerCase();

    if (value === "::1" || value === "localhost") return true;
    if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")) return true;
    // IPv4 encapsulée en IPv6 (::ffff:10.0.0.1) : on juge sur la partie IPv4.
    const v4 = value.startsWith("::ffff:") ? value.slice(7) : value;

    const octets = v4.split(".");
    if (octets.length !== 4) return false;

    const [a, b] = octets.map((o) => Number(o));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;

    return false;
}

/**
 * Interroge le service de géolocalisation. Ne lève jamais : toute panne, tout délai
 * dépassé et toute réponse incompréhensible se résolvent en « pays inconnu », c'est
 * à dire en ariary.
 */
export async function lookupCountry(ip: string): Promise<string> {
    const template = process.env.GEO_LOOKUP_URL?.trim() || DEFAULT_LOOKUP_URL;
    const url = template.includes("{ip}") ? template.replace("{ip}", encodeURIComponent(ip)) : `${template}${encodeURIComponent(ip)}`;

    try {
        const response = await fetch(url, {
            headers: { accept: "text/plain, application/json" },
            signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
            cache: "no-store",
        });

        if (!response.ok) return UNKNOWN_COUNTRY;

        const body = (await response.text()).trim();
        return parseCountry(body) ?? UNKNOWN_COUNTRY;
    } catch {
        // Service injoignable ou trop lent : le visiteur ne doit rien en savoir.
        return UNKNOWN_COUNTRY;
    }
}

/** Code pays d'une réponse, qu'elle soit un code brut ou un objet JSON. */
function parseCountry(body: string): string | null {
    if (isCountryCode(body)) return body.toUpperCase();

    try {
        const json = JSON.parse(body) as Record<string, unknown>;
        for (const key of ["country_code", "countryCode", "country"]) {
            const value = json[key];
            if (isCountryCode(typeof value === "string" ? value : null)) {
                return (value as string).toUpperCase();
            }
        }
    } catch {
        // Réponse ni code ni JSON — par exemple une page d'erreur HTML du service.
    }

    return null;
}
