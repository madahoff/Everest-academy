import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp, countryFromHeaders, forcedCountry, lookupCountry } from "@/lib/geo";
import {
    COUNTRY_COOKIE,
    COUNTRY_COOKIE_MAX_AGE,
    COUNTRY_HEADER,
    UNKNOWN_COOKIE_MAX_AGE,
    UNKNOWN_COUNTRY,
    isCountryCode,
} from "@/lib/pricing";

/**
 * Middleware du site public. Deux responsabilités, sans rapport l'une avec l'autre :
 *
 *  1. rejeter proprement les Server Actions malformées (bots et pages en cache) ;
 *  2. déterminer le PAYS du visiteur, dont découle la devise affichée — ariary à
 *     Madagascar, euro ailleurs.
 */

/**
 * Next.js Server Actions use a special "Next-Action" header with a hashed ID.
 * Bots, crawlers, and stale cached pages sometimes send POST requests with
 * invalid or missing action IDs, causing "Failed to find Server Action" errors.
 *
 * This middleware intercepts those requests and returns a clean 400 response
 * instead of letting Next.js throw an unhandled error in the logs.
 */
function malformedServerAction(request: NextRequest): boolean {
    const nextActionHeader = request.headers.get("Next-Action");
    if (request.method !== "POST" || nextActionHeader === null) return false;

    // Valid Next.js server action IDs are long hex hashes (40+ chars)
    // An ID like "x" or any very short/invalid string is malformed
    return !(nextActionHeader.length >= 32 && /^[a-f0-9]+$/.test(nextActionHeader));
}

export async function middleware(request: NextRequest) {
    if (malformedServerAction(request)) {
        return new NextResponse(
            JSON.stringify({
                error: "Bad Request",
                message: "Invalid server action request",
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    return withCountry(request);
}

/**
 * Résout le pays du visiteur et le transmet en aval.
 *
 * Le résultat est mémorisé en cookie : la géolocalisation par IP n'a lieu qu'à la
 * toute première requête d'un visiteur, jamais sur les suivantes. Il est en outre
 * recopié dans un en-tête de la requête, faute de quoi le cookie — posé sur la
 * RÉPONSE — ne serait lisible qu'à la page d'après, et un visiteur étranger verrait
 * l'ariary sur sa première page.
 */
async function withCountry(request: NextRequest) {
    const cached = request.cookies.get(COUNTRY_COOKIE)?.value;
    if (isCountryCode(cached)) {
        return forward(request, cached.toUpperCase());
    }

    const resolved = await resolveCountry(request);

    const response = forward(request, resolved);
    response.cookies.set(COUNTRY_COOKIE, resolved, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: request.nextUrl.protocol === "https:",
        // Un échec de localisation n'est mémorisé qu'une heure : le service peut
        // être revenu, et laisser un visiteur étranger un mois en ariary serait pire
        // que de retenter demain.
        maxAge: resolved === UNKNOWN_COUNTRY ? UNKNOWN_COOKIE_MAX_AGE : COUNTRY_COOKIE_MAX_AGE,
    });

    return response;
}

async function resolveCountry(request: NextRequest): Promise<string> {
    const forced = forcedCountry();
    if (forced) return forced;

    const fromProxy = countryFromHeaders(request.headers);
    if (fromProxy) return fromProxy;

    const ip = clientIp(request.headers);
    if (!ip) return UNKNOWN_COUNTRY;

    return lookupCountry(ip);
}

function forward(request: NextRequest, country: string) {
    const headers = new Headers(request.headers);
    headers.set(COUNTRY_HEADER, country);
    return NextResponse.next({ request: { headers } });
}

// Apply middleware to all routes except static files and images
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         * - public folder assets
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
