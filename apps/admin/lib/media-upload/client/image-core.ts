/**
 * Redimensionnement et réencodage d'une image. Ce module ne dépend d'aucun objet de
 * page : il tourne aussi bien dans un Web Worker que sur le fil principal.
 */

export interface ImageJob {
    /** Plus grand côté autorisé, en pixels. */
    maxDimension: number
    quality: number
    /** Format de repli quand le navigateur ne sait pas encoder en WebP. */
    fallbackType: "image/jpeg" | "image/png"
}

export interface ImageResult {
    blob: Blob
    type: string
}

export async function reencodeImage(source: Blob, job: ImageJob): Promise<ImageResult> {
    // `from-image` applique l'orientation EXIF : une photo de téléphone reste dans le bon sens
    // une fois ses métadonnées retirées par le réencodage.
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" })
    try {
        const scale = Math.min(1, job.maxDimension / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))

        if (typeof OffscreenCanvas !== "undefined") {
            const canvas = new OffscreenCanvas(width, height)
            draw(canvas.getContext("2d"), bitmap, width, height)
            let blob = await canvas.convertToBlob({ type: "image/webp", quality: job.quality })
            // Un navigateur qui ne sait pas encoder le WebP rend silencieusement du PNG.
            if (blob.type !== "image/webp") blob = await canvas.convertToBlob({ type: job.fallbackType, quality: job.quality })
            return { blob, type: blob.type }
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        draw(canvas.getContext("2d"), bitmap, width, height)
        const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, job.quality))
        let blob = await encode("image/webp")
        if (blob?.type !== "image/webp") blob = await encode(job.fallbackType)
        if (!blob) throw new Error("Encodage de l'image impossible")
        return { blob, type: blob.type }
    } finally {
        bitmap.close()
    }
}

function draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null,
    bitmap: ImageBitmap,
    width: number,
    height: number,
): void {
    if (!context) throw new Error("Canvas 2D indisponible")
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(bitmap, 0, 0, width, height)
}
