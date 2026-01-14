
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { auth } from "@/auth"
import { existsSync } from "fs"

export async function POST(request: Request) {
    const session = await auth()

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File

    if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const type = data.get("type") as string || "misc"

    // Clean filename to prevent weird characters
    const timestamp = Date.now()
    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_")
    const filename = `${timestamp}_${cleanName}`

    // Store in the app's public/uploads directory
    // This is mounted as a shared Docker volume accessible by both admin and web
    const uploadDir = join(process.cwd(), "public/uploads", type)

    // Ensure directory exists
    if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
    }

    const path = join(uploadDir, filename)

    try {
        await writeFile(path, buffer)
        // Return URL that Next.js can serve from public folder
        const url = `/uploads/${type}/${filename}`
        return NextResponse.json({ url })
    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
}
