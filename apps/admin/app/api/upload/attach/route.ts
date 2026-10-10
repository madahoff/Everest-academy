import { stat } from "fs/promises"
import { join } from "path"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { uploadsRoot } from "@/lib/media-upload/server/config"
import { guarded } from "@/lib/media-upload/server/http"
import { UploadError } from "@/lib/media-upload/server/sessions"
import { ATTACH_FIELDS, isAttachable, MEDIA_URL_PATTERN } from "@/lib/media-upload/targets"

/**
 * POST /api/upload/attach — rattache un média publié à un contenu existant.
 *
 * Sert quand l'envoi se termine alors que le formulaire d'origine est fermé. Trois
 * garde-fous : le champ doit figurer dans la liste fermée, le fichier doit réellement
 * exister, et le champ ne doit pas avoir changé depuis le lancement de l'envoi — un
 * média choisi entre-temps n'est jamais écrasé.
 *
 * L'ancien fichier n'est pas supprimé : il peut encore être référencé ailleurs.
 */
export function POST(request: Request) {
    return guarded(async () => {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
        const { entity, id, field, url } = body ?? {}
        const expected = typeof body?.expected === "string" ? body.expected : ""

        if (typeof entity !== "string" || typeof field !== "string" || !isAttachable(entity, field)) {
            throw new UploadError(400, "Ce champ ne peut pas recevoir de média.")
        }
        if (typeof id !== "string" || !id) throw new UploadError(400, "Contenu cible manquant.")
        if (typeof url !== "string" || !MEDIA_URL_PATTERN.test(url)) throw new UploadError(400, "Adresse de média invalide.")

        const file = await stat(join(uploadsRoot(), url.slice("/uploads/".length))).catch(() => null)
        if (!file?.isFile()) throw new UploadError(404, "Le média n'existe pas sur le serveur.")

        const nullable = (ATTACH_FIELDS[entity] as Record<string, boolean>)[field]
        const unchanged = expected
            ? { [field]: expected }
            : nullable
              ? { OR: [{ [field]: null }, { [field]: "" }] }
              : { [field]: "" }
        const args = { where: { id, ...unchanged }, data: { [field]: url } }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- délégué choisi dynamiquement parmi trois modèles
        const delegate = prisma[entity] as any
        const { count } = await delegate.updateMany(args)
        if (count === 0) {
            const exists = await delegate.count({ where: { id } })
            if (!exists) throw new UploadError(404, "Le contenu cible n'existe plus.")
            throw new UploadError(409, "Le champ a été modifié entre-temps : le média n'a pas été rattaché pour ne rien écraser.")
        }
        return NextResponse.json({ success: true })
    })
}
