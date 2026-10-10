import { execFile, spawn } from "child_process"
import { promisify } from "util"

const run = promisify(execFile)

/**
 * Contrôle et mise au format web des vidéos reçues, via ffmpeg.
 *
 * ffmpeg est facultatif : sans lui, la console accepte toujours les vidéos, mais ne peut
 * ni vérifier qu'elles sont lisibles ni convertir celles qu'un navigateur refuse.
 */

let availability: Promise<boolean> | null = null

export function ffmpegAvailable(): Promise<boolean> {
    availability ??= Promise.all([run("ffprobe", ["-version"]), run("ffmpeg", ["-version"])])
        .then(() => true)
        .catch(() => {
            console.warn("[upload] ffmpeg introuvable : les vidéos ne seront ni vérifiées ni converties.")
            return false
        })
    return availability
}

export interface VideoProbe {
    container: string
    duration: number
    videoCodec: string | null
    audioCodec: string | null
    width: number
    height: number
}

export async function probeVideo(path: string): Promise<VideoProbe> {
    const { stdout } = await run(
        "ffprobe",
        ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
        { maxBuffer: 8 * 1024 * 1024 },
    )
    const data = JSON.parse(stdout) as {
        format?: { format_name?: string; duration?: string }
        streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; disposition?: { attached_pic?: number } }[]
    }
    const streams = data.streams ?? []
    const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic)
    const audio = streams.find((s) => s.codec_type === "audio")
    return {
        container: data.format?.format_name ?? "",
        duration: Number(data.format?.duration) || 0,
        videoCodec: video?.codec_name ?? null,
        audioCodec: audio?.codec_name ?? null,
        width: video?.width ?? 0,
        height: video?.height ?? 0,
    }
}

export type VideoPlan = "keep" | "remux" | "transcode"

/**
 * Que faire d'une vidéo reçue ?
 *  - `keep` : WebM déjà lisible partout, on n'y touche pas ;
 *  - `remux` : H.264/AAC, simple réécriture du conteneur en MP4 avec l'index en tête
 *    (lecture immédiate, sans attendre la fin du téléchargement) — aucune perte ;
 *  - `transcode` : codec qu'un navigateur ne lit pas (HEVC d'iPhone, ProRes…).
 */
export function planVideo(probe: VideoProbe): VideoPlan {
    const isWebm = probe.container.includes("webm")
    if (isWebm) {
        const videoOk = ["vp8", "vp9", "av1"].includes(probe.videoCodec ?? "")
        const audioOk = probe.audioCodec === null || ["opus", "vorbis"].includes(probe.audioCodec)
        return videoOk && audioOk ? "keep" : "transcode"
    }
    const videoOk = probe.videoCodec === "h264"
    const audioOk = probe.audioCodec === null || ["aac", "mp3"].includes(probe.audioCodec)
    return videoOk && audioOk ? "remux" : "transcode"
}

const STREAMS = ["-map", "0:v:0", "-map", "0:a:0?"]

export async function remuxToMp4(source: string, destination: string): Promise<void> {
    await run("ffmpeg", ["-y", "-v", "error", "-i", source, ...STREAMS, "-c", "copy", "-movflags", "+faststart", "-f", "mp4", destination])
}

// Une seule conversion à la fois : libx264 occupe déjà tous les cœurs du serveur.
let transcodeQueue: Promise<unknown> = Promise.resolve()

export function transcodeToMp4(
    source: string,
    destination: string,
    duration: number,
    onProgress: (progress: number | null) => void,
): Promise<void> {
    const job = transcodeQueue.then(() => runTranscode(source, destination, duration, onProgress))
    transcodeQueue = job.catch(() => null)
    return job
}

function runTranscode(
    source: string,
    destination: string,
    duration: number,
    onProgress: (progress: number | null) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("ffmpeg", [
            "-y", "-v", "error", "-i", source, ...STREAMS,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
            // Plafonne le grand côté à 1920 px, sans jamais agrandir.
            "-vf", "scale=w='if(gt(iw,ih),min(1920,iw),-2)':h='if(gt(iw,ih),-2,min(1920,ih))'",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart", "-f", "mp4",
            "-progress", "pipe:1", "-nostats",
            destination,
        ])

        let stderr = ""
        child.stderr.on("data", (chunk: Buffer) => {
            stderr = (stderr + chunk.toString()).slice(-2000)
        })
        child.stdout.on("data", (chunk: Buffer) => {
            const match = /out_time_us=(\d+)/.exec(chunk.toString())
            if (!match) return
            onProgress(duration > 0 ? Math.min(1, Number(match[1]) / 1e6 / duration) : null)
        })
        child.on("error", reject)
        child.on("close", (code) => {
            if (code === 0) resolve()
            else reject(new Error(`ffmpeg a échoué (code ${code}) : ${stderr.trim()}`))
        })
    })
}
