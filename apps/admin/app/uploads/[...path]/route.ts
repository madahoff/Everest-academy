import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params
    const filePath = path.join("/")

    // Determine the project root
    let projectRoot = process.cwd()
    if (existsSync(join(projectRoot, "apps/admin/public"))) {
        projectRoot = join(projectRoot, "apps/admin")
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

        const fileBuffer = await readFile(fullPath)
        const ext = "." + filePath.split(".").pop()?.toLowerCase()
        const contentType = MIME_TYPES[ext] || "application/octet-stream"

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
}
