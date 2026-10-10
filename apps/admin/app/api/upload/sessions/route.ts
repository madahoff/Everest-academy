import { NextResponse } from "next/server"
import { guarded } from "@/lib/media-upload/server/http"
import { createSession, UploadError } from "@/lib/media-upload/server/sessions"

// POST /api/upload/sessions — ouvre un transfert reprenable après validation du fichier annoncé.
export function POST(request: Request) {
    return guarded(async () => {
        const body = await request.json().catch(() => null)
        if (!body || typeof body !== "object") throw new UploadError(400, "Requête invalide.")
        return NextResponse.json(await createSession(body), { status: 201 })
    })
}
