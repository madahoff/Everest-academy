/**
 * Reconnaît un média à sa signature binaire. L'extension et le type MIME viennent du
 * poste client : seuls les premiers octets disent ce que le fichier est réellement.
 */
export type SniffedFormat =
    | "jpeg" | "png" | "gif" | "webp" | "avif"
    | "isobmff" // mp4, m4v, mov
    | "webm"
    | "pdf"

const ascii = (bytes: Uint8Array, start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length))

export function sniffFormat(bytes: Uint8Array): SniffedFormat | null {
    if (bytes.length < 12) return null

    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"
    if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return "png"
    if (ascii(bytes, 0, 4) === "GIF8") return "gif"
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp"
    if (ascii(bytes, 0, 4) === "%PDF") return "pdf"
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm"

    const box = ascii(bytes, 4, 4)
    if (box === "ftyp") {
        const brand = ascii(bytes, 8, 4)
        return brand === "avif" || brand === "avis" ? "avif" : "isobmff"
    }
    // Un QuickTime ancien peut commencer directement par ses atomes, sans `ftyp`.
    if (["moov", "mdat", "wide", "free", "skip"].includes(box)) return "isobmff"

    return null
}

const FORMATS_BY_EXTENSION: Record<string, SniffedFormat[]> = {
    jpg: ["jpeg"],
    jpeg: ["jpeg"],
    png: ["png"],
    gif: ["gif"],
    webp: ["webp"],
    avif: ["avif"],
    mp4: ["isobmff"],
    m4v: ["isobmff"],
    mov: ["isobmff"],
    webm: ["webm"],
    pdf: ["pdf"],
}

/** Le contenu correspond-il à ce que l'extension annonce ? */
export function contentMatchesExtension(bytes: Uint8Array, extension: string): boolean {
    const format = sniffFormat(bytes)
    return format !== null && (FORMATS_BY_EXTENSION[extension] ?? []).includes(format)
}
