import { NextResponse } from "next/server"
import { chunkBytes } from "@/lib/media-upload/server/config"
import { guarded, readBounded } from "@/lib/media-upload/server/http"
import { abortSession, getSession, UploadError, writeChunk } from "@/lib/media-upload/server/sessions"

type Context = { params: Promise<{ id: string }> }

// GET — où en est la session : point de reprise, traitement final, média publié.
export function GET(_request: Request, { params }: Context) {
    return guarded(async () => NextResponse.json(await getSession((await params).id)))
}

// PUT ?offset=N — reçoit un morceau brut, accompagné de son empreinte SHA-256.
export function PUT(request: Request, { params }: Context) {
    return guarded(async () => {
        const offset = Number(new URL(request.url).searchParams.get("offset"))
        const hash = request.headers.get("x-chunk-sha256") ?? ""
        if (!/^[0-9a-f]{64}$/i.test(hash)) throw new UploadError(400, "Empreinte du morceau manquante.")

        const bytes = await readBounded(request, chunkBytes())
        return NextResponse.json(await writeChunk((await params).id, offset, bytes, hash))
    })
}

// DELETE — abandonne le transfert et libère la place occupée.
export function DELETE(_request: Request, { params }: Context) {
    return guarded(async () => {
        await abortSession((await params).id)
        return NextResponse.json({ success: true })
    })
}
