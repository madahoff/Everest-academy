import { NextResponse } from "next/server"
import { publicConfig } from "@/lib/media-upload/server/config"
import { guarded } from "@/lib/media-upload/server/http"
import { ffmpegAvailable } from "@/lib/media-upload/server/video"

// GET /api/upload/config — limites et réglages que le navigateur doit respecter.
export function GET() {
    return guarded(async () => NextResponse.json(publicConfig(await ffmpegAvailable())))
}
