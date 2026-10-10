import { extensionOf, type UploadKind } from "../shared"
import { reencodeImage, type ImageJob, type ImageResult } from "./image-core"
import type { Analysis, MediaInput, MediaProcessor, PreparedMedia } from "./manager"
import { analyzeVideo, compressVideo } from "./video"

/** Plus grand côté conservé selon l'usage : une vignette n'a pas besoin de 2560 px. */
const MAX_DIMENSION: Record<UploadKind, number> = { hero: 2560, card: 1280, misc: 2000, video: 2000 }
const IMAGE_QUALITY = 0.82
/** En dessous, une image est déjà légère : la réencoder ne ferait que la dégrader. */
const SMALL_IMAGE_BYTES = 150 * 1024

const EXTENSION_BY_TYPE: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }

function analyzeImage(input: MediaInput): Analysis {
    const extension = extensionOf(input.name)
    if (extension === "gif") return { compress: false, reason: "GIF conservé tel quel pour préserver l'animation." }
    if (extension === "avif") return { compress: false, reason: "AVIF déjà optimisé : conservé tel quel." }
    if (input.blob.size < SMALL_IMAGE_BYTES) return { compress: false, reason: "Image déjà légère : conservée telle quelle." }
    return { compress: true, reason: `Redimensionnement à ${MAX_DIMENSION[input.kind]} px maximum et conversion en WebP` }
}

function runImageJob(source: Blob, job: ImageJob, signal: AbortSignal): Promise<ImageResult> {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return reencodeImage(source, job)

    return new Promise<ImageResult>((resolve, reject) => {
        let worker: Worker
        try {
            worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" })
        } catch {
            // Worker refusé (politique de sécurité, bundler) : repli sur le fil principal.
            return void reencodeImage(source, job).then(resolve, reject)
        }
        const stop = () => {
            worker.terminate()
            signal.removeEventListener("abort", onAbort)
        }
        const onAbort = () => {
            stop()
            reject(new DOMException("Aborted", "AbortError"))
        }
        signal.addEventListener("abort", onAbort, { once: true })
        worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: ImageResult; error?: string }>) => {
            stop()
            if (event.data.ok && event.data.result) resolve(event.data.result)
            else reject(new Error(event.data.error))
        }
        worker.onerror = () => {
            stop()
            void reencodeImage(source, job).then(resolve, reject)
        }
        worker.postMessage({ source, job })
    })
}

async function compressImage(input: MediaInput, signal: AbortSignal): Promise<PreparedMedia | null> {
    // Un PNG peut porter de la transparence : son repli reste le PNG, jamais le JPEG.
    const fallbackType = extensionOf(input.name) === "png" ? "image/png" : "image/jpeg"
    const result = await runImageJob(input.blob, { maxDimension: MAX_DIMENSION[input.kind], quality: IMAGE_QUALITY, fallbackType }, signal)

    // Moins de 10 % de gain : la perte de qualité d'un réencodage ne se justifie pas.
    if (result.blob.size > input.blob.size * 0.9) return null
    const extension = EXTENSION_BY_TYPE[result.type]
    if (!extension) return null
    const base = input.name.replace(/\.[^.]+$/, "")
    return { blob: result.blob, name: `${base}.${extension}` }
}

/** Analyse et compression des médias dans le navigateur. */
export const browserProcessor: MediaProcessor = {
    async analyze(input) {
        if (input.family === "image") return analyzeImage(input)
        if (input.family === "video") return analyzeVideo(input.blob, input.name)
        return { compress: false, reason: "Document envoyé tel quel." }
    },

    async compress(input, onProgress, signal) {
        if (input.family === "image") {
            // L'encodage d'une image est bref et ne publie pas d'avancement : indicateur d'activité.
            onProgress(null)
            return compressImage(input, signal)
        }
        if (input.family === "video") return compressVideo(input.blob, input.name, onProgress, signal)
        return null
    },
}
