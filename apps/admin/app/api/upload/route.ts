
import { NextResponse } from "next/server"
import { mkdir, unlink } from "fs/promises"
import { createWriteStream, existsSync } from "fs"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { join } from "path"
import { auth } from "@/auth"
import { requireAdmin } from "@/lib/require-admin"

/**
 * Envoi d'un média depuis la console.
 *
 * Le fichier est écrit dans `public/uploads/<type>/`, monté en volume Docker partagé
 * avec la vitrine : celle-ci le sert ensuite par sa route `/uploads/[...path]`, avec
 * les Range Requests qui rendent une vidéo lisible et navigable.
 *
 * DEUX GARDES pour que l'envoi tienne en production :
 *
 *  1. une TAILLE MAXIMALE, refusée AVANT de lire le corps de la requête. Sans elle,
 *     un fichier trop gros ne produisait qu'une erreur 500 opaque après avoir saturé
 *     la mémoire du conteneur ;
 *  2. une écriture EN FLUX vers le disque, au lieu du `arrayBuffer()` + `Buffer.from`
 *     précédent qui gardait deux copies entières du fichier en mémoire.
 *
 * Reste une limite qu'aucun réglage ne lève ici : `request.formData()` matérialise
 * le corps multipart avant de nous le rendre. Pour une vidéo de plusieurs centaines
 * de mégaoctets, le chemin recommandé demeure le LIEN (YouTube), que le lecteur de
 * la vitrine sait afficher aussi bien qu'un fichier local.
 */

/** Plafonds par nature de média, en mégaoctets. Réglables sans redéploiement. */
const MAX_MB: Record<string, number> = {
    video: Number(process.env.MAX_VIDEO_UPLOAD_MB) || 200,
    hero: Number(process.env.MAX_IMAGE_UPLOAD_MB) || 10,
    card: Number(process.env.MAX_IMAGE_UPLOAD_MB) || 10,
    misc: Number(process.env.MAX_IMAGE_UPLOAD_MB) || 10,
}

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
    video: ["mp4", "webm", "mov", "m4v"],
    hero: ["jpg", "jpeg", "png", "webp", "gif", "avif"],
    card: ["jpg", "jpeg", "png", "webp", "gif", "avif"],
    misc: ["jpg", "jpeg", "png", "webp", "gif", "avif", "mp4", "webm", "mov", "m4v", "pdf"],
}

function limitMb(type: string): number {
    return MAX_MB[type] ?? MAX_MB.misc
}

export async function POST(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    const session = await auth()
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Le type voyage dans le corps multipart, donc illisible avant de l'avoir lu.
    // On applique ici le plafond le PLUS LARGE, uniquement pour écarter d'emblée
    // l'énorme envoi ; le plafond exact du type est vérifié juste après.
    const declared = Number(request.headers.get("content-length") || 0)
    const absoluteMax = Math.max(...Object.values(MAX_MB))
    if (declared > absoluteMax * 1024 * 1024) {
        return NextResponse.json(
            {
                error: `Fichier trop volumineux (${Math.round(declared / 1024 / 1024)} Mo). La limite est de ${absoluteMax} Mo — pour une vidéo plus lourde, hébergez-la sur YouTube et collez le lien.`,
            },
            { status: 413 },
        )
    }

    let path: string | null = null

    try {
        const data = await request.formData()
        const file = data.get("file") as File | null

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        const type = (data.get("type") as string) || "misc"
        const max = limitMb(type)

        if (file.size > max * 1024 * 1024) {
            return NextResponse.json(
                {
                    error:
                        type === "video"
                            ? `Vidéo trop volumineuse (${Math.round(file.size / 1024 / 1024)} Mo). La limite est de ${max} Mo — au-delà, hébergez-la sur YouTube et collez le lien.`
                            : `Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). La limite est de ${max} Mo.`,
                },
                { status: 413 },
            )
        }

        const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
        const allowed = ALLOWED_EXTENSIONS[type] ?? ALLOWED_EXTENSIONS.misc
        if (!allowed.includes(extension)) {
            return NextResponse.json(
                { error: `Format non accepté (.${extension}). Formats admis : ${allowed.join(", ")}.` },
                { status: 415 },
            )
        }

        // Nom nettoyé : le nom d'origine vient d'un poste client, il n'a pas à décider
        // d'un chemin sur le serveur.
        const timestamp = Date.now()
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_")
        const filename = `${timestamp}_${cleanName}`

        // En mode standalone Docker, cwd vaut /app alors que l'application vit dans
        // /app/apps/admin : c'est là que le volume partagé est monté.
        let projectRoot = process.cwd()
        if (existsSync(join(projectRoot, "apps/admin/public"))) {
            projectRoot = join(projectRoot, "apps/admin")
        }
        const uploadDir = join(projectRoot, "public/uploads", type)

        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true })
        }

        path = join(uploadDir, filename)

        // Écriture en flux : le fichier ne transite plus par un Buffer complet.
        await pipeline(Readable.fromWeb(file.stream() as never), createWriteStream(path))

        return NextResponse.json({ url: `/uploads/${type}/${filename}` })
    } catch (error) {
        // Un fichier à demi écrit serait servi tronqué : on le retire.
        if (path) await unlink(path).catch(() => null)

        console.error("Upload error:", error)
        return NextResponse.json(
            { error: "L'envoi a échoué", details: (error as Error).message },
            { status: 500 },
        )
    }
}
