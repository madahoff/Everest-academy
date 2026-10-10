import { createHash, randomUUID } from "crypto"
import { mkdir, open, readFile, readdir, rename, rm, stat, statfs, writeFile } from "fs/promises"
import { join } from "path"
import {
    ALLOWED_EXTENSIONS,
    extensionOf,
    familyOfExtension,
    formatMb,
    isUploadKind,
    mimeMatchesFamily,
    type SessionState,
    type SessionView,
    type UploadKind,
} from "../shared"
import { chunkBytes, maxBytes, sessionTtlHours, sessionsRoot, uploadsRoot } from "./config"
import { contentMatchesExtension } from "./sniff"
import { ffmpegAvailable, planVideo, probeVideo, remuxToMp4, transcodeToMp4 } from "./video"

/**
 * Sessions de transfert reprenable.
 *
 * Un fichier arrive par morceaux dans `.tmp/<id>/data`. La taille de ce fichier EST le
 * point de reprise : après une coupure, le navigateur demande où en est la session et
 * repart de là, sans rien renvoyer de ce qui est déjà arrivé.
 *
 * Le média n'apparaît dans `uploads/<type>/` qu'à la toute fin, par un renommage
 * atomique, une fois son intégrité vérifiée : un fichier incomplet n'est jamais servi.
 *
 * Les sessions vivent sur le disque et non en base : aucune migration, et elles
 * survivent au redémarrage du conteneur.
 */

export class UploadError extends Error {
    constructor(
        public status: number,
        message: string,
        /** État de la session, joint quand il aide le navigateur à se réaligner. */
        public session?: SessionView,
    ) {
        super(message)
    }
}

interface SessionMeta {
    id: string
    kind: UploadKind
    originalName: string
    cleanBase: string
    extension: string
    size: number
    mime: string
    chunkBytes: number
    createdAt: string
    expiresAt: string
    state: SessionState
    manifest: string[] | null
    /** Destination décidée avant le renommage final, pour survivre à un arrêt brutal. */
    pending: { path: string; url: string } | null
    url: string | null
    finalSize: number | null
    error: string | null
}

interface Job {
    progress: number | null
    step: SessionView["processingStep"]
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SAFETY_MARGIN = 100 * 1024 * 1024

const jobs = new Map<string, Job>()
const locks = new Map<string, Promise<unknown>>()

/** Sérialise les opérations d'une même session : deux morceaux ne s'écrivent jamais ensemble. */
function withLock<T>(id: string, task: () => Promise<T>): Promise<T> {
    const previous = locks.get(id) ?? Promise.resolve()
    const next = previous.catch(() => null).then(task)
    const settled = next.catch(() => null)
    locks.set(id, settled)
    void settled.then(() => {
        if (locks.get(id) === settled) locks.delete(id)
    })
    return next
}

const dirOf = (id: string) => join(sessionsRoot(), id)
const dataOf = (id: string) => join(dirOf(id), "data")
const metaOf = (id: string) => join(dirOf(id), "meta.json")

async function saveMeta(meta: SessionMeta): Promise<void> {
    const temporary = `${metaOf(meta.id)}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(meta))
    await rename(temporary, metaOf(meta.id))
}

async function loadMeta(id: string): Promise<SessionMeta> {
    if (!ID_PATTERN.test(id)) throw new UploadError(404, "Session de transfert introuvable.")
    try {
        return JSON.parse(await readFile(metaOf(id), "utf8")) as SessionMeta
    } catch {
        throw new UploadError(404, "Session de transfert introuvable ou expirée. Relancez l'envoi.")
    }
}

async function receivedBytes(id: string): Promise<number> {
    return stat(dataOf(id)).then((s) => s.size).catch(() => 0)
}

async function toView(meta: SessionMeta): Promise<SessionView> {
    const job = jobs.get(meta.id)
    return {
        id: meta.id,
        state: meta.state,
        received: meta.state === "uploading" ? await receivedBytes(meta.id) : meta.size,
        size: meta.size,
        chunkBytes: meta.chunkBytes,
        expiresAt: meta.expiresAt,
        processingProgress: job?.progress ?? null,
        processingStep: meta.state === "processing" ? (job?.step ?? "verifying") : null,
        url: meta.url,
        finalSize: meta.finalSize,
        error: meta.error,
    }
}

function assertNotExpired(meta: SessionMeta): void {
    if (meta.state === "uploading" && Date.parse(meta.expiresAt) < Date.now()) {
        throw new UploadError(410, "La session de transfert a expiré. Relancez l'envoi du fichier.")
    }
}

export interface CreateSessionInput {
    name: unknown
    size: unknown
    mime: unknown
    kind: unknown
}

export async function createSession(input: CreateSessionInput): Promise<SessionView> {
    const { name, size, kind } = input
    const mime = typeof input.mime === "string" ? input.mime : ""

    if (!isUploadKind(kind)) throw new UploadError(400, "Nature de média inconnue.")
    if (typeof name !== "string" || !name.trim()) throw new UploadError(400, "Nom de fichier manquant.")
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
        throw new UploadError(400, "Le fichier est vide ou sa taille est invalide.")
    }

    const extension = extensionOf(name)
    const allowed = ALLOWED_EXTENSIONS[kind]
    const family = familyOfExtension(extension)
    if (!allowed.includes(extension) || !family) {
        throw new UploadError(415, `Format non accepté (.${extension || "?"}). Formats admis : ${allowed.join(", ")}.`)
    }
    if (!mimeMatchesFamily(mime, family)) {
        throw new UploadError(415, `Le type du fichier (${mime}) ne correspond pas à son extension .${extension}.`)
    }

    const limit = maxBytes()[kind]
    if (size > limit) {
        throw new UploadError(
            413,
            family === "video"
                ? `Vidéo trop volumineuse (${formatMb(size)}). La limite est de ${formatMb(limit)} — au-delà, hébergez-la sur YouTube et collez le lien.`
                : `Fichier trop volumineux (${formatMb(size)}). La limite est de ${formatMb(limit)}.`,
        )
    }

    await mkdir(sessionsRoot(), { recursive: true })
    void sweepExpiredSessions().catch(() => null)

    // Une vidéo peut être réécrite à l'arrivée : il faut alors la place de deux copies.
    const needed = size * (family === "video" ? 2 : 1) + SAFETY_MARGIN
    const disk = await statfs(sessionsRoot()).catch(() => null)
    if (disk && disk.bavail * disk.bsize < needed) {
        throw new UploadError(507, "Espace de stockage insuffisant sur le serveur. Libérez de la place ou utilisez un lien YouTube.")
    }

    const now = Date.now()
    const base = name.slice(0, name.length - extension.length - 1)
    const meta: SessionMeta = {
        id: randomUUID(),
        kind,
        originalName: name,
        // Le nom d'origine vient d'un poste client, il n'a pas à décider d'un chemin sur le serveur.
        cleanBase: base.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80) || "media",
        extension,
        size,
        mime,
        chunkBytes: chunkBytes(),
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + sessionTtlHours() * 3600 * 1000).toISOString(),
        state: "uploading",
        manifest: null,
        pending: null,
        url: null,
        finalSize: null,
        error: null,
    }

    await mkdir(dirOf(meta.id), { recursive: true })
    await writeFile(dataOf(meta.id), "")
    await saveMeta(meta)
    return toView(meta)
}

export async function getSession(id: string): Promise<SessionView> {
    const meta = await loadMeta(id)
    assertNotExpired(meta)
    // Le serveur a redémarré en plein traitement : on le relance, les données sont toujours là.
    if (meta.state === "processing" && !jobs.has(id)) startProcessing(meta)
    return toView(meta)
}

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

export async function writeChunk(id: string, offset: number, bytes: Uint8Array, expectedHash: string): Promise<SessionView> {
    return withLock(id, async () => {
        const meta = await loadMeta(id)
        assertNotExpired(meta)
        if (meta.state !== "uploading") return toView(meta)

        if (!Number.isSafeInteger(offset) || offset < 0 || offset % meta.chunkBytes !== 0) {
            throw new UploadError(400, "Position de morceau invalide.")
        }

        const received = await receivedBytes(id)
        // Morceau déjà reçu (réponse perdue, nouvelle tentative) : rien à réécrire.
        if (offset + bytes.length <= received) return toView(meta)
        if (offset !== received) {
            throw new UploadError(409, "Le transfert n'est plus aligné avec le serveur.", await toView(meta))
        }

        const expectedLength = Math.min(meta.chunkBytes, meta.size - offset)
        if (bytes.length !== expectedLength) {
            throw new UploadError(400, "Taille de morceau inattendue.", await toView(meta))
        }
        if (sha256(bytes) !== expectedHash.toLowerCase()) {
            throw new UploadError(422, "Morceau altéré pendant le transfert.", await toView(meta))
        }

        if (offset === 0 && !contentMatchesExtension(bytes, meta.extension)) {
            await rm(dirOf(id), { recursive: true, force: true })
            throw new UploadError(415, `Le contenu du fichier ne correspond pas à un .${meta.extension} valide.`)
        }

        const handle = await open(dataOf(id), "r+")
        try {
            await handle.write(bytes, 0, bytes.length, offset)
        } finally {
            await handle.close()
        }
        return toView(meta)
    })
}

export async function completeSession(id: string, manifest: unknown): Promise<SessionView> {
    return withLock(id, async () => {
        const meta = await loadMeta(id)
        assertNotExpired(meta)
        // Terminer deux fois ne publie pas deux fichiers : la session est la clé d'idempotence.
        if (meta.state !== "uploading") return getSession(id)

        const received = await receivedBytes(id)
        if (received !== meta.size) {
            throw new UploadError(409, "Le fichier n'est pas encore entièrement reçu.", await toView(meta))
        }

        const expectedChunks = Math.ceil(meta.size / meta.chunkBytes)
        if (
            !Array.isArray(manifest) ||
            manifest.length !== expectedChunks ||
            !manifest.every((hash) => typeof hash === "string" && /^[0-9a-f]{64}$/i.test(hash))
        ) {
            throw new UploadError(400, "Empreintes de contrôle manquantes ou invalides.")
        }

        meta.manifest = manifest.map((hash: string) => hash.toLowerCase())
        meta.state = "processing"
        await saveMeta(meta)
        startProcessing(meta)
        return toView(meta)
    })
}

export async function abortSession(id: string): Promise<void> {
    if (!ID_PATTERN.test(id)) return
    await withLock(id, async () => {
        const meta = await loadMeta(id).catch(() => null)
        // Un média déjà publié n'est pas retiré ici : il peut être référencé par un contenu.
        if (meta?.state === "processing") throw new UploadError(409, "Le traitement final est en cours, il ne peut plus être annulé.")
        await rm(dirOf(id), { recursive: true, force: true })
    })
}

function startProcessing(meta: SessionMeta): void {
    const job: Job = { progress: 0, step: "verifying" }
    jobs.set(meta.id, job)
    void finalize(meta, job)
        .catch(async (error: unknown) => {
            const message = error instanceof UploadError ? error.message : "Le traitement final du fichier a échoué sur le serveur."
            if (!(error instanceof UploadError)) console.error("[upload] traitement en échec:", error)
            meta.state = "failed"
            meta.error = message
            await saveMeta(meta).catch(() => null)
            await rm(dataOf(meta.id), { force: true }).catch(() => null)
            await rm(join(dirOf(meta.id), "out.mp4"), { force: true }).catch(() => null)
        })
        .finally(() => jobs.delete(meta.id))
}

async function finalize(meta: SessionMeta, job: Job): Promise<void> {
    const source = dataOf(meta.id)

    // Reprise après un arrêt survenu entre le renommage final et son enregistrement.
    if (meta.pending) {
        const published = await stat(meta.pending.path).catch(() => null)
        if (published) return markReady(meta, published.size)
    }

    await verifyIntegrity(meta, source, job)

    let file = source
    let extension = meta.extension

    if (familyOfExtension(meta.extension) === "video" && (await ffmpegAvailable())) {
        job.step = "optimizing"
        job.progress = null
        const probe = await probeVideo(source).catch(() => null)
        if (!probe?.videoCodec) {
            throw new UploadError(422, "Vidéo illisible ou endommagée : aucune piste vidéo n'a pu être lue.")
        }

        const plan = planVideo(probe)
        if (plan !== "keep") {
            const output = join(dirOf(meta.id), "out.mp4")
            const remuxed = plan === "remux" && (await remuxToMp4(source, output).then(() => true, () => false))
            if (!remuxed) {
                job.step = "transcoding"
                job.progress = 0
                await transcodeToMp4(source, output, probe.duration, (progress) => {
                    job.progress = progress
                })
            }
            file = output
            extension = "mp4"
        }
    }

    const filename = `${Date.now()}_${meta.cleanBase}.${extension}`
    const directory = join(uploadsRoot(), meta.kind)
    await mkdir(directory, { recursive: true })

    meta.pending = { path: join(directory, filename), url: `/uploads/${meta.kind}/${filename}` }
    await saveMeta(meta)
    await rename(file, meta.pending.path)
    await markReady(meta, (await stat(meta.pending.path)).size)
}

async function markReady(meta: SessionMeta, finalSize: number): Promise<void> {
    meta.state = "ready"
    meta.url = meta.pending!.url
    meta.finalSize = finalSize
    await saveMeta(meta)
    await rm(dataOf(meta.id), { force: true })
    await rm(join(dirOf(meta.id), "out.mp4"), { force: true })
}

/**
 * Relit le fichier assemblé et compare chaque morceau aux empreintes calculées par le
 * navigateur À PARTIR DU FICHIER D'ORIGINE : c'est le contrôle de bout en bout.
 */
async function verifyIntegrity(meta: SessionMeta, path: string, job: Job): Promise<void> {
    const manifest = meta.manifest ?? []
    const handle = await open(path, "r")
    try {
        const buffer = Buffer.alloc(meta.chunkBytes)
        for (let index = 0; index < manifest.length; index++) {
            const { bytesRead } = await handle.read(buffer, 0, meta.chunkBytes, index * meta.chunkBytes)
            if (sha256(buffer.subarray(0, bytesRead)) !== manifest[index]) {
                throw new UploadError(422, "Le fichier reçu ne correspond pas au fichier d'origine (contrôle d'intégrité). Relancez l'envoi.")
            }
            job.progress = (index + 1) / manifest.length
        }
    } finally {
        await handle.close()
    }
}

let lastSweep = 0

/** Retire les sessions expirées — transferts abandonnés compris. Au plus une passe toutes les dix minutes. */
export async function sweepExpiredSessions(force = false): Promise<number> {
    if (!force && Date.now() - lastSweep < 10 * 60 * 1000) return 0
    lastSweep = Date.now()

    let removed = 0
    const entries = await readdir(sessionsRoot(), { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
        if (!entry.isDirectory() || jobs.has(entry.name)) continue
        const directory = join(sessionsRoot(), entry.name)
        const meta = await readFile(join(directory, "meta.json"), "utf8").then((raw) => JSON.parse(raw) as SessionMeta, () => null)
        const expiry = meta ? Date.parse(meta.expiresAt) : (await stat(directory)).mtimeMs + sessionTtlHours() * 3600 * 1000
        if (expiry < Date.now()) {
            await rm(directory, { recursive: true, force: true })
            removed++
        }
    }
    return removed
}
