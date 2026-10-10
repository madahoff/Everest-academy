/**
 * Règles d'envoi de médias partagées par le navigateur et le serveur.
 *
 * Le navigateur les applique pour refuser tôt et expliquer clairement ; le serveur les
 * réapplique toujours, car lui seul fait foi.
 */

export const UPLOAD_KINDS = ["video", "hero", "card", "misc"] as const
export type UploadKind = (typeof UPLOAD_KINDS)[number]

export type MediaFamily = "video" | "image" | "document"

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif"]
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"]

export const ALLOWED_EXTENSIONS: Record<UploadKind, string[]> = {
    video: VIDEO_EXTENSIONS,
    hero: IMAGE_EXTENSIONS,
    card: IMAGE_EXTENSIONS,
    misc: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, "pdf"],
}

export function isUploadKind(value: unknown): value is UploadKind {
    return typeof value === "string" && (UPLOAD_KINDS as readonly string[]).includes(value)
}

export function extensionOf(name: string): string {
    const dot = name.lastIndexOf(".")
    return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

export function familyOfExtension(extension: string): MediaFamily | null {
    if (IMAGE_EXTENSIONS.includes(extension)) return "image"
    if (VIDEO_EXTENSIONS.includes(extension)) return "video"
    if (extension === "pdf") return "document"
    return null
}

/**
 * Un type MIME déclaré est accepté s'il est vide (certains navigateurs n'en donnent pas
 * pour un .mov) ou s'il appartient à la famille de l'extension. La signature réelle du
 * fichier est contrôlée à part, côté serveur.
 */
export function mimeMatchesFamily(mime: string, family: MediaFamily): boolean {
    if (!mime || mime === "application/octet-stream") return true
    if (family === "image") return mime.startsWith("image/")
    if (family === "video") return mime.startsWith("video/")
    return mime === "application/pdf"
}

/** Configuration publiée par le serveur (`GET /api/upload/config`). */
export interface UploadConfig {
    /** Plafond par nature de média, en octets. */
    maxBytes: Record<UploadKind, number>
    /** Taille d'un morceau, en octets. */
    chunkBytes: number
    /** Nombre de transferts menés de front. */
    maxConcurrentTransfers: number
    /** Durée de vie d'une session de transfert, en heures. */
    sessionTtlHours: number
    /** Le serveur dispose de ffmpeg : il peut convertir une vidéo illisible sur le web. */
    serverCanTranscode: boolean
}

export type SessionState = "uploading" | "processing" | "ready" | "failed"

/** Vue d'une session de transfert renvoyée par l'API. */
export interface SessionView {
    id: string
    state: SessionState
    /** Octets déjà reçus et vérifiés : le point de reprise. */
    received: number
    size: number
    chunkBytes: number
    expiresAt: string
    /** Avancement du traitement serveur entre 0 et 1, `null` s'il n'est pas mesurable. */
    processingProgress: number | null
    processingStep: "verifying" | "optimizing" | "transcoding" | null
    url: string | null
    finalSize: number | null
    error: string | null
}

export function formatMb(bytes: number): string {
    return `${Math.round(bytes / 1024 / 1024)} Mo`
}
