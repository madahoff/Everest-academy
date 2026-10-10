import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { UploadError } from "./sessions"

/**
 * Enveloppe commune des routes d'envoi : contrôle d'accès administrateur, puis
 * traduction des erreurs métier en réponses JSON `{ error, session? }`.
 */
export async function guarded(handler: () => Promise<NextResponse>): Promise<NextResponse> {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        return await handler()
    } catch (error) {
        if (error instanceof UploadError) {
            return NextResponse.json({ error: error.message, session: error.session }, { status: error.status })
        }
        console.error("[upload] erreur inattendue:", error)
        return NextResponse.json({ error: "Erreur interne du serveur pendant l'envoi." }, { status: 500 })
    }
}

/** Lit le corps d'une requête sans jamais dépasser `maxBytes`, quoi qu'annonce le client. */
export async function readBounded(request: Request, maxBytes: number): Promise<Uint8Array> {
    if (Number(request.headers.get("content-length") || 0) > maxBytes) {
        throw new UploadError(413, "Morceau trop volumineux.")
    }
    const reader = request.body?.getReader()
    if (!reader) return new Uint8Array(0)

    const parts: Uint8Array[] = []
    let total = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        if (total > maxBytes) {
            await reader.cancel().catch(() => null)
            throw new UploadError(413, "Morceau trop volumineux.")
        }
        parts.push(value)
    }

    const bytes = new Uint8Array(total)
    let position = 0
    for (const part of parts) {
        bytes.set(part, position)
        position += part.length
    }
    return bytes
}
