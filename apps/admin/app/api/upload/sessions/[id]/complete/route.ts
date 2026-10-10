import { NextResponse } from "next/server"
import { guarded } from "@/lib/media-upload/server/http"
import { completeSession } from "@/lib/media-upload/server/sessions"

type Context = { params: Promise<{ id: string }> }

/**
 * POST — tous les morceaux sont arrivés : lance la vérification d'intégrité et le
 * traitement final. Répond aussitôt (202) ; l'avancement se suit par GET sur la session.
 */
export function POST(request: Request, { params }: Context) {
    return guarded(async () => {
        const body = (await request.json().catch(() => null)) as { manifest?: unknown } | null
        const session = await completeSession((await params).id, body?.manifest)
        return NextResponse.json(session, { status: session.state === "ready" ? 200 : 202 })
    })
}
