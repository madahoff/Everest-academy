import { existsSync } from "fs"
import { join } from "path"
import type { UploadConfig, UploadKind } from "../shared"

const MB = 1024 * 1024

function positive(value: string | undefined, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Plafonds par nature de média. Réglables sans redéploiement. */
export function maxBytes(): Record<UploadKind, number> {
    const video = positive(process.env.MAX_VIDEO_UPLOAD_MB, 200) * MB
    const image = positive(process.env.MAX_IMAGE_UPLOAD_MB, 10) * MB
    return { video, hero: image, card: image, misc: image }
}

export function chunkBytes(): number {
    // Borné : un morceau est tenu en mémoire le temps d'en vérifier l'empreinte.
    return Math.min(32, Math.max(1, positive(process.env.UPLOAD_CHUNK_MB, 5))) * MB
}

export function maxConcurrentTransfers(): number {
    return Math.min(6, Math.max(1, Math.round(positive(process.env.UPLOAD_MAX_CONCURRENT, 2))))
}

export function sessionTtlHours(): number {
    return positive(process.env.UPLOAD_SESSION_TTL_HOURS, 24)
}

/**
 * Racine des médias. En mode standalone Docker, cwd vaut /app alors que l'application
 * vit dans /app/apps/admin : c'est là que le volume partagé est monté.
 * `UPLOADS_DIR` la remplace (tests, montage particulier).
 */
export function uploadsRoot(): string {
    if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR
    let projectRoot = process.cwd()
    if (existsSync(join(projectRoot, "apps/admin/public"))) {
        projectRoot = join(projectRoot, "apps/admin")
    }
    return join(projectRoot, "public/uploads")
}

/**
 * Dossier des transferts en cours. Il vit SUR le volume des médias pour que la mise en
 * ligne soit un simple renommage atomique ; son nom pointé le rend inaccessible par les
 * routes `/uploads/[...path]`, qui refusent tout segment commençant par un point.
 */
export function sessionsRoot(): string {
    return join(uploadsRoot(), ".tmp")
}

export function publicConfig(serverCanTranscode: boolean): UploadConfig {
    return {
        maxBytes: maxBytes(),
        chunkBytes: chunkBytes(),
        maxConcurrentTransfers: maxConcurrentTransfers(),
        sessionTtlHours: sessionTtlHours(),
        serverCanTranscode,
    }
}
