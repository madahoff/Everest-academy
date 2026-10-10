import { extensionOf } from "../shared"
import type { Analysis, PreparedMedia } from "./manager"

/**
 * Compression vidéo dans le navigateur, par WebCodecs (encodeur matériel quand il
 * existe) via la bibliothèque mediabunny, chargée à la demande.
 *
 * C'est la seule approche qui réduit réellement ce qui part sur le réseau. Elle n'est
 * tentée que si le navigateur sait DÉCODER la source et ENCODER en H.264 ; sinon la
 * vidéo part telle quelle et le serveur la convertit si nécessaire.
 *
 * L'audio déjà en AAC — le cas des téléphones, caméras et enregistreurs d'écran — est
 * recopié sans réencodage : aucune perte, et cela fonctionne aussi là où le navigateur
 * ne sait pas encoder l'AAC (Chrome sous Linux). Aucune piste n'est jamais sacrifiée :
 * si l'audio ne peut être ni recopié ni réencodé, on renonce à compresser.
 */

const AUDIO_BITRATE = 128_000
/** Plus grand côté de sortie : 1080p suffit à un cours, et se lit sur tous les appareils. */
const MAX_LONG_SIDE = 1920
/** Au-delà, la sortie — tenue en mémoire — risquerait de faire tomber l'onglet. */
const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024 * 1024

/** Débit vidéo visé selon la définition de sortie, en bits par seconde. */
function targetBitrate(longSide: number): number {
    if (longSide > 1280) return 4_500_000
    if (longSide > 854) return 2_500_000
    return 1_200_000
}

const mbps = (bits: number) => `${(bits / 1_000_000).toFixed(1).replace(".", ",")} Mb/s`

interface Plan {
    longSide: number
    landscape: boolean
    resize: boolean
    bitrate: number
    /** L'audio source est déjà en AAC : il est recopié tel quel. */
    copyAudio: boolean
}

const plans = new WeakMap<Blob, Plan>()

export async function analyzeVideo(blob: Blob, name: string): Promise<Analysis> {
    if (typeof VideoEncoder === "undefined") {
        return { compress: false, reason: "Ce navigateur ne sait pas compresser la vidéo : elle est envoyée telle quelle." }
    }

    const { Input, ALL_FORMATS, BlobSource, canEncode } = await import("mediabunny")
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    try {
        const video = await input.getPrimaryVideoTrack()
        if (!video) return { compress: false, reason: "Piste vidéo non reconnue : le serveur contrôlera le fichier." }

        const audio = await input.getPrimaryAudioTrack()
        const duration = await input.computeDuration()
        if (!(duration > 0)) return { compress: false, reason: "Durée illisible : la vidéo est envoyée telle quelle." }

        const copyAudio = audio?.codec === "aac"
        const audioReady = !audio || copyAudio || ((await audio.canDecode()) && (await canEncode("aac")))
        const decodable = (await video.canDecode()) && audioReady
        const encodable = await canEncode("avc")
        if (!decodable || !encodable) {
            return { compress: false, reason: "Codec non pris en charge par ce navigateur : le serveur convertira la vidéo si nécessaire." }
        }

        const longSide = Math.max(video.displayWidth, video.displayHeight)
        const outputLongSide = Math.min(longSide, MAX_LONG_SIDE)
        const bitrate = targetBitrate(outputLongSide)
        const currentBitrate = (blob.size * 8) / duration

        const webm = extensionOf(name) === "webm"
        const webCompatible = webm ? ["vp8", "vp9", "av1"].includes(video.codec ?? "") : video.codec === "avc"
        const resize = longSide > MAX_LONG_SIDE
        // Marge de 50 % : en dessous, le gain ne vaudrait ni le temps d'encodage ni la perte de qualité.
        const heavy = currentBitrate > (bitrate + AUDIO_BITRATE) * 1.5

        if (webCompatible && !resize && !heavy) {
            return { compress: false, reason: `Vidéo déjà optimisée (${mbps(currentBitrate)}) : envoyée telle quelle.` }
        }
        if (((bitrate + AUDIO_BITRATE) * duration) / 8 > MAX_OUTPUT_BYTES) {
            return { compress: false, reason: "Vidéo trop longue pour être compressée dans le navigateur : envoyée telle quelle." }
        }

        plans.set(blob, { longSide: outputLongSide, landscape: video.displayWidth >= video.displayHeight, resize, bitrate, copyAudio })
        const reasons = [
            !webCompatible && "conversion en H.264",
            resize && "réduction en 1080p",
            heavy && `débit ramené de ${mbps(currentBitrate)} à ${mbps(bitrate)}`,
        ].filter(Boolean)
        return { compress: true, reason: `Compression : ${reasons.join(", ")}` }
    } finally {
        input.dispose()
    }
}

export async function compressVideo(
    blob: Blob,
    name: string,
    onProgress: (fraction: number | null) => void,
    signal: AbortSignal,
): Promise<PreparedMedia | null> {
    const plan = plans.get(blob)
    if (!plan) return null

    const { Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, Mp4OutputFormat } = await import("mediabunny")
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    const target = new BufferTarget()
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target })

    try {
        const conversion = await Conversion.init({
            input,
            output,
            video: {
                codec: "avc",
                bitrate: plan.bitrate,
                // Une seule dimension : l'autre suit le rapport d'aspect.
                ...(plan.resize ? (plan.landscape ? { width: plan.longSide } : { height: plan.longSide }) : {}),
            },
            // Sans codec imposé, une piste compatible avec le MP4 est recopiée telle quelle.
            audio: plan.copyAudio ? {} : { codec: "aac", bitrate: AUDIO_BITRATE },
            showWarnings: false,
        })

        // Une piste écartée (audio non encodable…) donnerait une vidéo amputée : on renonce.
        if (!conversion.isValid || conversion.discardedTracks.length > 0) return null

        const onAbort = () => void conversion.cancel().catch(() => null)
        signal.addEventListener("abort", onAbort, { once: true })
        conversion.onProgress = (fraction) => onProgress(fraction)
        try {
            await conversion.execute()
        } finally {
            signal.removeEventListener("abort", onAbort)
        }
        if (signal.aborted) throw new DOMException("Aborted", "AbortError")
        if (!target.buffer) return null

        const base = name.replace(/\.[^.]+$/, "")
        return { blob: new Blob([target.buffer], { type: "video/mp4" }), name: `${base}.mp4` }
    } finally {
        input.dispose()
    }
}
