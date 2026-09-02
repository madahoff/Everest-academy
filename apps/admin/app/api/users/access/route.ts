import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { applyCourseAccess, parseAccessRequest } from "@/lib/course-access"

/**
 * POST /api/users/access — donne ou retire l'accès à des cours, pour un utilisateur
 * ou pour toute une sélection.
 *
 * Corps attendu :
 *   { userIds: string[], mode: "set" | "grant" | "revoke", courseIds: string[], plan?: "FREE" | "PREMIUM" }
 *
 * `set` sert l'édition en ligne (la liste cochée devient la liste des accès), `grant`
 * et `revoke` les actions groupées. `plan` porte le Pack Premium, qui ouvre aussi le
 * catalogue à venir — voir `lib/course-access.ts`.
 */
export async function POST(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "invalid_json", message: "Corps de requête illisible" }, { status: 400 })
    }

    const parsed = parseAccessRequest(body)
    if (!parsed) {
        return NextResponse.json(
            { error: "invalid_payload", message: "Utilisateurs, mode ou cours invalides" },
            { status: 400 },
        )
    }

    try {
        const result = await applyCourseAccess(parsed)
        return NextResponse.json(result)
    } catch (error) {
        console.error("Failed to update course access:", error)
        return NextResponse.json({ error: "Failed to update course access" }, { status: 500 })
    }
}
