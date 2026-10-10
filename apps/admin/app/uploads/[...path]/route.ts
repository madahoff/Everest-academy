import { NextRequest, NextResponse } from "next/server"
import { stat } from "fs/promises"
import { join } from "path"
import { createReadStream } from "fs"
import { Readable } from "stream"
import { uploadsRoot } from "@/lib/media-upload/server/config"

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
    ".m4v": "video/mp4",
    ".avif": "image/avif",
    ".pdf": "application/pdf",
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params
    const filePath = path.join("/")

    // Les dossiers pointés (transferts en cours dans `.tmp`) ne sont jamais servis.
    if (path.some((segment) => segment.startsWith("."))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const root = uploadsRoot()
    const fullPath = join(root, filePath)

    // Security: prevent path traversal
    if (!fullPath.startsWith(root)) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    try {
        const fileStat = await stat(fullPath)
        if (!fileStat.isFile()) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const ext = "." + filePath.split(".").pop()?.toLowerCase()
        const headers: Record<string, string> = {
            "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
        }

        // Lecture en flux, avec Range Requests : une vidéo se prévisualise et se parcourt
        // dans la console sans être chargée entièrement en mémoire.
        const size = fileStat.size
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "")
        if (range && (range[1] || range[2])) {
            const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
            const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
            if (start > end || start >= size) {
                return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
            }
            return new NextResponse(Readable.toWeb(createReadStream(fullPath, { start, end })) as ReadableStream, {
                status: 206,
                headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
            })
        }

        return new NextResponse(Readable.toWeb(createReadStream(fullPath)) as ReadableStream, {
            status: 200,
            headers: { ...headers, "Content-Length": String(size) },
        })
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
}
