import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to filter out malformed Server Action requests.
 *
 * Next.js Server Actions use a special "Next-Action" header with a hashed ID.
 * Bots, crawlers, and stale cached pages sometimes send POST requests with
 * invalid or missing action IDs, causing "Failed to find Server Action" errors.
 *
 * This middleware intercepts those requests and returns a clean 400 response
 * instead of letting Next.js throw an unhandled error in the logs.
 */
export function middleware(request: NextRequest) {
    // Only check POST requests that contain the Next-Action header
    const nextActionHeader = request.headers.get("Next-Action");

    if (request.method === "POST" && nextActionHeader !== null) {
        // Valid Next.js server action IDs are long hex hashes (40+ chars)
        // An ID like "x" or any very short/invalid string is malformed
        const isValidActionId =
            nextActionHeader.length >= 32 && /^[a-f0-9]+$/.test(nextActionHeader);

        if (!isValidActionId) {
            // Return a clean 400 response for malformed server action requests
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
    }

    return NextResponse.next();
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
