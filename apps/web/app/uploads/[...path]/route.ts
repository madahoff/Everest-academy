import { NextRequest, NextResponse } from "next/server"
import { stat, open } from "fs/promises"
import { join } from "path"
import { existsSync, createReadStream } from "fs"

const MIME_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
}
// Seuil pour le streaming progressif (10 MB)
// En dessous: on charge tout le fichier d'un coup
// Au dessus: on utilise HTTP Range Requests pour streamer petit à petit
const STREAMING_THRESHOLD = 1 * 1024 * 1024 // 1 MB

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params
    const filePath = path.join("/")

    // Determine the project root
    let projectRoot = process.cwd()
    if (existsSync(join(projectRoot, "apps/web/public"))) {
        projectRoot = join(projectRoot, "apps/web")
    }

    const fullPath = join(projectRoot, "public/uploads", filePath)

    // Security: prevent path traversal
    if (!fullPath.startsWith(join(projectRoot, "public/uploads"))) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    try {
        const fileStat = await stat(fullPath)
        if (!fileStat.isFile()) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const ext = "." + filePath.split(".").pop()?.toLowerCase()
        const contentType = MIME_TYPES[ext] || "application/octet-stream"
        const fileSize = fileStat.size
        const isVideo = contentType.startsWith("video/")

        // Pour les vidéos volumineuses : streaming progressif avec Range Requests
        if (isVideo && fileSize > STREAMING_THRESHOLD) {
            return handleRangeRequest(request, fullPath, fileSize, contentType)
        }

        // Pour les petits fichiers et images : charger tout d'un coup
        const fileHandle = await open(fullPath, "r")
        const fileBuffer = await fileHandle.readFile()
        await fileHandle.close()

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "Content-Length": fileSize.toString(),
            "Cache-Control": "public, max-age=31536000, immutable",
        }

        // Pour les vidéos en dessous du seuil, supporter quand même Range Requests
        // car le navigateur peut en envoyer
        if (isVideo) {
            headers["Accept-Ranges"] = "bytes"
            const rangeHeader = request.headers.get("range")
            if (rangeHeader) {
                return handleRangeRequest(request, fullPath, fileSize, contentType)
            }
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers,
        })
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
}

/**
 * Gère les HTTP Range Requests pour le streaming progressif des vidéos.
 * 
 * Le navigateur envoie un header "Range: bytes=0-" pour demander une portion du fichier.
 * On répond avec un status 206 (Partial Content) et les headers appropriés.
 * 
 * Cela permet :
 * - Démarrage instantané de la lecture sans attendre le chargement complet
 * - Seek (avance rapide / retour en arrière) sans re-télécharger tout le fichier
 * - Économie de bande passante si l'utilisateur ne regarde pas la vidéo en entier
 */
async function handleRangeRequest(
    request: NextRequest,
    fullPath: string,
    fileSize: number,
    contentType: string
): Promise<NextResponse> {
    const rangeHeader = request.headers.get("range")

    if (!rangeHeader) {
        // Pas de Range header mais fichier volumineux :
        // Répondre avec Accept-Ranges pour informer le navigateur
        // et streamer le fichier en chunks
        const stream = createReadStream(fullPath)
        const readable = streamToReadableStream(stream)

        return new NextResponse(readable, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": fileSize.toString(),
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    }

    // Parser le header Range: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
    if (!match) {
        return new NextResponse("Invalid range", {
            status: 416,
            headers: { "Content-Range": `bytes */${fileSize}` },
        })
    }

    const startStr = match[1]
    const endStr = match[2]

    let start: number
    let end: number

    if (startStr === "" && endStr !== "") {
        // bytes=-500 → les 500 derniers octets
        start = Math.max(0, fileSize - parseInt(endStr))
        end = fileSize - 1
    } else if (endStr === "") {
        // bytes=0- → depuis le début
        start = parseInt(startStr)
        // Envoyer des chunks de 1 MB maximum pour un streaming fluide
        const CHUNK_SIZE = 1 * 1024 * 1024 // 1 MB
        end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1)
    } else {
        start = parseInt(startStr)
        end = parseInt(endStr)
    }

    // Validation
    if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse("Range not satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${fileSize}` },
        })
    }

    const contentLength = end - start + 1
    const stream = createReadStream(fullPath, { start, end })
    const readable = streamToReadableStream(stream)

    return new NextResponse(readable, {
        status: 206,
        headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Content-Length": contentLength.toString(),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    })
}

/**
 * Convertit un Node.js ReadStream en Web ReadableStream
 */
function streamToReadableStream(nodeStream: ReturnType<typeof createReadStream>): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            nodeStream.on("data", (chunk: Buffer | string) => {
                if (typeof chunk === "string") {
                    controller.enqueue(new TextEncoder().encode(chunk))
                } else {
                    controller.enqueue(new Uint8Array(chunk))
                }
            })
            nodeStream.on("end", () => {
                controller.close()
            })
            nodeStream.on("error", (err) => {
                controller.error(err)
            })
        },
        cancel() {
            nodeStream.destroy()
        },
    })
}
