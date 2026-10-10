import type { SessionView, UploadConfig } from "../shared"
import { TransportError, type Transport } from "./manager"

/** Délai au-delà duquel un appel sans réponse est tenu pour perdu. */
const REQUEST_TIMEOUT_MS = 30_000
/** Un morceau de quelques mégaoctets doit passer en deux minutes, même sur une liaison lente. */
const CHUNK_TIMEOUT_MS = 120_000

async function parseError(status: number, read: () => Promise<unknown>): Promise<TransportError> {
    // Les routes d'envoi répondent `{ error }` ; la garde d'accès, `{ error: code, message }`.
    const body = (await read().catch(() => null)) as { error?: string; message?: string; session?: SessionView } | null
    return new TransportError(status, body?.message ?? body?.error ?? `Erreur ${status}`, body?.session)
}

async function call<T>(path: string, init: RequestInit, signal: AbortSignal): Promise<T> {
    // Délai d'attente propre à l'appel, combiné à l'annulation de la tâche.
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal.addEventListener("abort", onAbort, { once: true })
    const timer = setTimeout(onAbort, REQUEST_TIMEOUT_MS)

    try {
        let response: Response
        try {
            response = await fetch(path, { ...init, signal: controller.signal, credentials: "same-origin" })
        } catch (error) {
            if (signal.aborted) throw error
            throw new TransportError(0, "Connexion au serveur impossible.")
        }
        if (!response.ok) throw await parseError(response.status, () => response.json())
        return (await response.json().catch(() => {
            throw new TransportError(502, "Réponse du serveur illisible.")
        })) as T
    } finally {
        clearTimeout(timer)
        signal.removeEventListener("abort", onAbort)
    }
}

const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
})

/**
 * Accès à l'API d'envoi. Les morceaux passent par XMLHttpRequest : c'est le seul moyen
 * fiable, dans tous les navigateurs, de mesurer les octets réellement partis.
 */
export const browserTransport: Transport = {
    getConfig: (signal) => call<UploadConfig>("/api/upload/config", { method: "GET" }, signal),

    createSession: (input, signal) => call<SessionView>("/api/upload/sessions", json("POST", input), signal),

    getSession: (id, signal) => call<SessionView>(`/api/upload/sessions/${id}`, { method: "GET", cache: "no-store" }, signal),

    complete: (id, manifest, signal) => call<SessionView>(`/api/upload/sessions/${id}/complete`, json("POST", { manifest }), signal),

    abort: async (id) => {
        await fetch(`/api/upload/sessions/${id}`, { method: "DELETE", keepalive: true })
    },

    attach: async (input, signal) => {
        await call("/api/upload/attach", json("POST", input), signal)
    },

    putChunk: (id, offset, bytes, hash, onProgress, signal) =>
        new Promise<SessionView>((resolve, reject) => {
            const request = new XMLHttpRequest()
            request.open("PUT", `/api/upload/sessions/${id}?offset=${offset}`)
            request.responseType = "json"
            request.timeout = CHUNK_TIMEOUT_MS
            request.setRequestHeader("Content-Type", "application/octet-stream")
            request.setRequestHeader("X-Chunk-Sha256", hash)

            const onAbort = () => request.abort()
            signal.addEventListener("abort", onAbort, { once: true })
            const finish = () => signal.removeEventListener("abort", onAbort)

            request.upload.onprogress = (event) => onProgress(event.loaded)
            request.onload = () => {
                finish()
                if (request.status >= 200 && request.status < 300 && request.response) {
                    resolve(request.response as SessionView)
                } else if (request.status >= 200 && request.status < 300) {
                    reject(new TransportError(502, "Réponse du serveur illisible."))
                } else {
                    void parseError(request.status, async () => request.response).then(reject)
                }
            }
            request.onerror = request.ontimeout = () => {
                finish()
                reject(new TransportError(0, "Connexion au serveur impossible."))
            }
            request.onabort = () => {
                finish()
                reject(new DOMException("Aborted", "AbortError"))
            }
            request.send(bytes)
        }),
}
