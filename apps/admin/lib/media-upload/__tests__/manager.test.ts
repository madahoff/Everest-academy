import { createHash } from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    TransportError,
    UploadManager,
    type Analysis,
    type Env,
    type MediaProcessor,
    type PreparedMedia,
    type TaskStore,
    type Transport,
} from "../client/manager"
import type { ManagerEvent, UploadTask } from "../client/types"
import type { SessionView, UploadConfig } from "../shared"

/**
 * La file d'envois, testée sans navigateur : le réseau, le stockage et la compression
 * sont remplacés par des doublures en mémoire qui respectent le contrat du serveur.
 */

const CHUNK = 4
const sha = (bytes: ArrayBuffer | Uint8Array) => createHash("sha256").update(new Uint8Array(bytes as ArrayBuffer)).digest("hex")

interface FakeSession {
    view: SessionView
    data: number[]
    name: string
    /** Nombre de relevés « processing » avant de passer à « ready ». */
    processingPolls: number
}

class FakeServer implements Transport {
    config: UploadConfig = {
        maxBytes: { video: 1000, hero: 100, card: 100, misc: 100 },
        chunkBytes: CHUNK,
        maxConcurrentTransfers: 2,
        sessionTtlHours: 24,
        serverCanTranscode: true,
    }
    sessions = new Map<string, FakeSession>()
    calls: string[] = []
    chunkOffsets: Record<string, number[]> = {}
    attached: unknown[] = []
    aborted: string[] = []
    concurrentPuts = 0
    maxConcurrentPuts = 0
    /** Chaque appel consulte ce crochet : il peut lever une erreur ou retarder la réponse. */
    intercept: (call: string, session?: FakeSession) => void | Promise<void> = () => undefined
    attachError: TransportError | null = null
    failProcessing: string | null = null
    private counter = 0

    private async enter(call: string, id?: string): Promise<FakeSession | undefined> {
        this.calls.push(call)
        const session = id ? this.sessions.get(id) : undefined
        await this.intercept(call, session)
        if (id && !session) throw new TransportError(404, "Session de transfert introuvable.")
        return session
    }

    async getConfig() {
        await this.enter("config")
        return this.config
    }

    async createSession(input: { name: string; size: number; mime: string; kind: string }) {
        await this.enter("create")
        if (input.name.endsWith(".exe")) throw new TransportError(415, "Format non accepté (.exe).")
        const id = `s${++this.counter}`
        const view: SessionView = {
            id, state: "uploading", received: 0, size: input.size, chunkBytes: CHUNK, expiresAt: "", processingProgress: null,
            processingStep: null, url: null, finalSize: null, error: null,
        }
        this.sessions.set(id, { view, data: [], name: input.name, processingPolls: 1 })
        return { ...view }
    }

    async getSession(id: string) {
        const session = (await this.enter("get", id))!
        if (session.view.state === "processing") {
            if (this.failProcessing) {
                session.view = { ...session.view, state: "failed", error: this.failProcessing }
            } else if (session.processingPolls-- <= 0) {
                session.view = { ...session.view, state: "ready", processingStep: null, url: `/uploads/video/${session.name}`, finalSize: session.data.length }
            } else {
                session.view = { ...session.view, processingStep: "optimizing", processingProgress: null }
            }
        }
        return { ...session.view }
    }

    async putChunk(id: string, offset: number, bytes: ArrayBuffer, hash: string, onProgress: (loaded: number) => void, signal: AbortSignal) {
        this.concurrentPuts++
        this.maxConcurrentPuts = Math.max(this.maxConcurrentPuts, this.concurrentPuts)
        try {
            const session = (await this.enter("put", id))!
            // Requête annulée en vol : comme un XHR interrompu, elle n'écrit rien.
            if (signal.aborted) throw new DOMException("Aborted", "AbortError")
            if (offset !== session.view.received) throw new TransportError(409, "Désaligné", { ...session.view })
            if (sha(bytes) !== hash) throw new TransportError(422, "Morceau altéré")
            onProgress(bytes.byteLength)
            session.data.push(...new Uint8Array(bytes))
            session.view = { ...session.view, received: session.data.length }
            ;(this.chunkOffsets[id] ??= []).push(offset)
            return { ...session.view }
        } finally {
            this.concurrentPuts--
        }
    }

    async complete(id: string, manifest: string[]) {
        const session = (await this.enter("complete", id))!
        const expected = Math.ceil(session.view.size / CHUNK)
        if (manifest.length !== expected) throw new TransportError(400, "Empreintes manquantes")
        for (let index = 0; index < expected; index++) {
            if (manifest[index] !== sha(Uint8Array.from(session.data.slice(index * CHUNK, (index + 1) * CHUNK)))) {
                throw new TransportError(400, "Empreinte fausse")
            }
        }
        session.view = { ...session.view, state: "processing", processingStep: "verifying", processingProgress: 0.5 }
        return { ...session.view }
    }

    async abort(id: string) {
        this.aborted.push(id)
        this.sessions.delete(id)
    }

    async attach(input: unknown) {
        await this.enter("attach")
        if (this.attachError) throw this.attachError
        this.attached.push(input)
    }
}

class FakeStore implements TaskStore {
    owner = true
    saved: UploadTask[] = []
    blobs = new Map<string, PreparedMedia>()
    acquire = async () => this.owner
    loadTasks = () => structuredClone(this.saved)
    saveTasks = (tasks: UploadTask[]) => void (this.saved = structuredClone(tasks))
    putBlob = async (id: string, media: PreparedMedia) => (this.blobs.set(id, media), true)
    getBlob = async (id: string) => this.blobs.get(id) ?? null
    deleteBlob = async (id: string) => void this.blobs.delete(id)
}

class FakeProcessor implements MediaProcessor {
    analysis: Analysis = { compress: false, reason: "Déjà optimisée" }
    result: ((input: Blob) => PreparedMedia | null) | Error = () => null
    hold: Promise<void> | null = null
    running = 0
    maxRunning = 0

    analyze = async () => this.analysis

    async compress(input: { blob: Blob; name: string }, onProgress: (fraction: number | null) => void, signal: AbortSignal) {
        this.running++
        this.maxRunning = Math.max(this.maxRunning, this.running)
        try {
            onProgress(0.5)
            if (this.hold) await this.hold
            if (signal.aborted) throw new DOMException("Aborted", "AbortError")
            if (this.result instanceof Error) throw this.result
            return this.result(input.blob)
        } finally {
            this.running--
        }
    }
}

const file = (name: string, size: number, type = "video/mp4") =>
    new File([Uint8Array.from({ length: size }, (_, index) => index % 251)], name, { type })

function setup(options: { store?: FakeStore; server?: FakeServer } = {}) {
    const server = options.server ?? new FakeServer()
    const store = options.store ?? new FakeStore()
    const processor = new FakeProcessor()
    let online = true
    let onlineCallback = () => undefined as void
    let ids = 0
    const env: Env = {
        now: () => Date.now(),
        isOnline: () => online,
        onOnline: (callback) => void (onlineCallback = callback),
        hash: async (bytes) => sha(bytes),
        uuid: () => `id${++ids}`,
    }
    const manager = new UploadManager({ transport: server, processor, store, env })
    const events: ManagerEvent[] = []
    manager.onEvent((event) => events.push(event))

    const task = (id: string) => manager.getSnapshot().tasks.find((t) => t.id === id)!
    /** Fait avancer l'horloge jusqu'à ce que la condition soit vraie. */
    const until = async (condition: () => boolean, label = "condition") => {
        for (let step = 0; step < 400; step++) {
            if (condition()) return
            await vi.advanceTimersByTimeAsync(250)
        }
        throw new Error(`Jamais atteint : ${label}`)
    }
    const settled = (...taskIds: string[]) =>
        until(() => taskIds.every((id) => ["done", "failed", "canceled", "paused"].includes(task(id).status)), "fin des tâches")

    return {
        manager, server, store, processor, events, task, until, settled,
        setOnline(value: boolean) {
            online = value
            if (value) onlineCallback()
        },
    }
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe("parcours complet d'un fichier", () => {
    it("traverse toutes les étapes et n'atteint 100 % qu'une fois disponible", async () => {
        const { manager, server, task, until } = setup()
        await manager.init()
        const seen: number[] = []
        manager.subscribe(() => seen.push(...manager.getSnapshot().tasks.map((t) => t.progress)))

        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        expect(task(id)).toMatchObject({ status: "running", stage: "prepare", progress: 0 })

        await until(() => task(id).phases.upload.status === "done", "transfert terminé")
        expect(task(id).status).toBe("running")
        expect(task(id).progress).toBeLessThan(1)

        await until(() => task(id).status === "done")
        const final = task(id)
        expect(final.progress).toBe(1)
        expect(final.url).toBe("/uploads/video/cours.mp4")
        expect(final.bytesSent).toBe(10)
        expect(final.phases).toMatchObject({
            validation: { status: "done" },
            compression: { status: "skipped", note: "Déjà optimisée" },
            preparation: { status: "done" },
            upload: { status: "done" },
            verification: { status: "done" },
            processing: { status: "done" },
            available: { status: "done" },
        })
        expect(server.chunkOffsets.s1).toEqual([0, 4, 8])
        expect([...server.sessions.get("s1")!.data]).toEqual(Array.from({ length: 10 }, (_, i) => i))

        // La barre n'a jamais reculé, et n'a jamais affiché 100 % avant la fin.
        expect(seen).toEqual([...seen].sort((a, b) => a - b))
        expect(seen.filter((value) => value === 1).length).toBeLessThanOrEqual(1)
    })

    it("refuse un format non autorisé avant tout transfert", async () => {
        const { manager, server, task, settled, events } = setup()
        const [id] = manager.add([file("virus.exe", 10, "application/x-msdownload")], { kind: "video" })
        await settled(id)
        expect(task(id).status).toBe("failed")
        expect(task(id).error).toMatchObject({ retryable: false })
        expect(task(id).error!.message).toContain(".exe")
        expect(server.calls).not.toContain("create")
        expect(events.map((e) => e.type)).toEqual(["failed"])
    })

    it("refuse un type MIME incohérent avec l'extension", async () => {
        const { manager, task, settled } = setup()
        const [id] = manager.add([file("photo.jpg", 10, "video/mp4")], { kind: "hero" })
        await settled(id)
        expect(task(id).error!.message).toContain("ne correspond pas")
    })

    it("refuse un fichier au-dessus de la limite de sa nature", async () => {
        const { manager, server, task, settled } = setup()
        const [id] = manager.add([file("affiche.png", 101, "image/png")], { kind: "hero" })
        await settled(id)
        expect(task(id).status).toBe("failed")
        expect(task(id).error!.message).toContain("trop volumineux")
        expect(server.calls).not.toContain("create")
    })
})

describe("compression", () => {
    it("envoie la version compressée et rapporte le gain", async () => {
        const { manager, server, processor, task, settled } = setup()
        processor.analysis = { compress: true, reason: "Compression : débit ramené à 4,5 Mb/s" }
        processor.result = () => ({ blob: new Blob([new Uint8Array(6)], { type: "video/mp4" }), name: "cours.mp4" })

        const [id] = manager.add([file("cours.mov", 20, "video/quicktime")], { kind: "video" })
        await settled(id)

        expect(task(id)).toMatchObject({ status: "done", originalSize: 20, preparedSize: 6, bytesTotal: 6 })
        expect(task(id).phases.compression).toMatchObject({ status: "done", note: "Taille réduite de 70 %" })
        expect(task(id).compressionMs).not.toBeNull()
        expect(server.sessions.get("s1")!.data).toHaveLength(6)
        expect(server.sessions.get("s1")!.name).toBe("cours.mp4")
    })

    it("accepte une vidéo au-dessus de la limite si la compression la ramène dessous", async () => {
        const { manager, processor, task, settled } = setup()
        processor.analysis = { compress: true, reason: "Compression" }
        processor.result = () => ({ blob: new Blob([new Uint8Array(500)]), name: "long.mp4" })
        const [id] = manager.add([file("long.mp4", 1500)], { kind: "video" })
        await settled(id)
        expect(task(id).status).toBe("done")
    })

    it("conserve l'original quand la compression n'apporte rien", async () => {
        const { manager, server, processor, task, settled } = setup()
        processor.analysis = { compress: true, reason: "Compression" }
        processor.result = () => null
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id).phases.compression.note).toContain("original est conservé")
        expect(server.sessions.get("s1")!.data).toHaveLength(10)
    })

    it("envoie le fichier tel quel si la compression échoue dans le navigateur", async () => {
        const { manager, server, processor, task, settled } = setup()
        processor.analysis = { compress: true, reason: "Compression" }
        processor.result = new Error("codec indisponible")
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id).status).toBe("done")
        expect(task(id).phases.compression.note).toContain("Compression impossible")
        expect(server.sessions.get("s1")!.data).toHaveLength(10)
    })

    it("ne compresse qu'une vidéo à la fois", async () => {
        const { manager, processor, task, until, settled } = setup()
        processor.analysis = { compress: true, reason: "Compression" }
        let release = () => undefined as void
        processor.hold = new Promise((resolve) => (release = resolve))

        const ids = manager.add([file("a.mp4", 8), file("b.mp4", 8), file("c.mp4", 8)], { kind: "video" })
        await until(() => processor.running === 1)
        expect(ids.map((id) => task(id).status)).toEqual(["running", "queued", "queued"])
        expect(task(ids[0]).phases.compression).toMatchObject({ status: "active", progress: 0.5 })

        release()
        await settled(...ids)
        expect(processor.maxRunning).toBe(1)
        expect(ids.map((id) => task(id).status)).toEqual(["done", "done", "done"])
    })
})

describe("envois simultanés", () => {
    it("respecte la limite de transferts et met le reste en attente", async () => {
        const { manager, server, task, until, settled } = setup()
        let release = () => undefined as void
        const gate = new Promise<void>((resolve) => (release = resolve))
        server.intercept = (call) => (call === "put" ? gate : undefined)

        const ids = manager.add(Array.from({ length: 5 }, (_, i) => file(`v${i}.mp4`, 8)), { kind: "video" })
        await until(() => server.concurrentPuts === 2)
        await vi.advanceTimersByTimeAsync(2000)

        const waiting = ids.filter((id) => task(id).status === "queued")
        expect(waiting).toHaveLength(3)
        expect(waiting.every((id) => task(id).stage === "transfer")).toBe(true)
        expect(manager.getSnapshot().global).toMatchObject({ active: 5, queued: 3 })

        release()
        await settled(...ids)
        expect(server.maxConcurrentPuts).toBe(2)
        expect(ids.every((id) => task(id).status === "done")).toBe(true)
        expect(manager.getSnapshot().global).toMatchObject({ active: 0, done: 5 })
    })

    it("isole l'échec d'un fichier : les autres aboutissent", async () => {
        const { manager, server, task, settled, events } = setup()
        server.intercept = (call, session) => {
            if (call === "put" && session?.name === "b.mp4" && session.view.received === 4) throw new TransportError(413, "Refusé par le serveur")
        }
        const ids = manager.add([file("a.mp4", 10), file("b.mp4", 10), file("c.mp4", 10)], { kind: "video" })
        await settled(...ids)
        expect(ids.map((id) => task(id).status)).toEqual(["done", "failed", "done"])
        expect(task(ids[1]).error).toEqual({ message: "Refusé par le serveur", retryable: false })
        expect(events.filter((e) => e.type === "failed")).toHaveLength(1)
        expect(manager.getSnapshot().global).toMatchObject({ failed: 1, done: 2 })
    })

    it("annule une tâche sans toucher aux autres et libère sa session", async () => {
        const { manager, server, task, until, settled } = setup()
        let release = () => undefined as void
        const gate = new Promise<void>((resolve) => (release = resolve))
        server.intercept = (call, session) => (call === "put" && session!.view.received === 4 ? gate : undefined)

        const [a, b] = manager.add([file("a.mp4", 10), file("b.mp4", 10)], { kind: "video" })
        await until(() => task(a).bytesSent === 4 && task(b).bytesSent === 4)
        manager.cancel(a)
        expect(task(a).status).toBe("canceled")
        expect(server.aborted).toEqual([task(a).sessionId])

        release()
        await settled(b)
        expect(task(b).status).toBe("done")
        expect(task(a).status).toBe("canceled")
    })

    it("remplace l'envoi en cours quand un nouveau fichier vise le même emplacement", async () => {
        const { manager, task, settled } = setup()
        const [first] = manager.add([file("a.mp4", 10)], { kind: "video", slotKey: "section:1:video" })
        const [second] = manager.add([file("b.mp4", 10)], { kind: "video", slotKey: "section:1:video" })
        await settled(second)
        expect(task(first).status).toBe("canceled")
        expect(task(second).status).toBe("done")
    })
})

describe("pause, reprise et interruptions", () => {
    it("reprend à l'octet où le serveur en est, sans rien renvoyer", async () => {
        const { manager, server, task, until, settled } = setup()
        let release = () => undefined as void
        const gate = new Promise<void>((resolve) => (release = resolve))
        server.intercept = (call, session) => (call === "put" && session!.view.received === 8 ? gate : undefined)

        const [id] = manager.add([file("cours.mp4", 14)], { kind: "video" })
        await until(() => task(id).bytesSent === 8)
        manager.pause(id)
        expect(task(id)).toMatchObject({ status: "paused", pauseReason: "user" })
        const progressAtPause = task(id).progress

        release()
        server.intercept = () => undefined
        await vi.advanceTimersByTimeAsync(5000)
        expect(task(id).status).toBe("paused")
        expect(server.sessions.get("s1")!.view.received).toBe(8)

        manager.resume(id)
        await settled(id)
        expect(task(id).status).toBe("done")
        expect(task(id).progress).toBeGreaterThanOrEqual(progressAtPause)
        // Chaque morceau n'a été écrit qu'une fois : la reprise est réelle, pas un nouvel envoi complet.
        expect(server.chunkOffsets.s1).toEqual([0, 4, 8, 12])
        expect(server.calls.filter((c) => c === "create")).toHaveLength(1)
    })

    it("rejoue une erreur réseau passagère avec temporisation, puis aboutit", async () => {
        const { manager, server, task, until, settled } = setup()
        let failures = 2
        server.intercept = (call, session) => {
            if (call === "put" && session!.view.received === 4 && failures-- > 0) throw new TransportError(0, "Réseau")
        }
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await until(() => task(id).retryAt !== null, "tentative programmée")
        expect(task(id)).toMatchObject({ status: "running", attempt: 1 })

        await settled(id)
        expect(task(id)).toMatchObject({ status: "done", attempt: 0, retryAt: null })
        expect(server.chunkOffsets.s1).toEqual([0, 4, 8])
    })

    it("abandonne après six essais, puis reprend à la demande là où il en était", async () => {
        const { manager, server, task, settled } = setup()
        let broken = true
        server.intercept = (call, session) => {
            if (broken && call === "put" && session!.view.received === 4) throw new TransportError(503, "Indisponible")
        }
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id).status).toBe("failed")
        expect(task(id).error).toMatchObject({ retryable: true })
        expect(server.calls.filter((c) => c === "put")).toHaveLength(1 + 6)

        broken = false
        manager.retry(id)
        await settled(id)
        expect(task(id).status).toBe("done")
        expect(server.chunkOffsets.s1).toEqual([0, 4, 8])
        expect(server.calls.filter((c) => c === "create")).toHaveLength(1)
    })

    it("se suspend hors ligne et reprend seul au retour du réseau", async () => {
        const { manager, server, task, settled, setOnline } = setup()
        let down = false
        server.intercept = (call, session) => {
            if (call === "put" && session!.view.received === 4 && !down) {
                down = true
                setOnline(false)
            }
            if (down && call !== "config") throw new TransportError(0, "Réseau")
        }
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id)).toMatchObject({ status: "paused", pauseReason: "offline" })

        server.intercept = () => undefined
        setOnline(true)
        await settled(id)
        expect(task(id).status).toBe("done")
        expect(server.chunkOffsets.s1).toEqual([0, 4, 8])
    })

    it("se suspend quand la session administrateur a expiré", async () => {
        const { manager, server, task, settled } = setup()
        let expired = true
        server.intercept = (call) => {
            if (expired && call === "put") throw new TransportError(401, "Connexion requise")
        }
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id)).toMatchObject({ status: "paused", pauseReason: "auth" })

        expired = false
        manager.resume(id)
        await settled(id)
        expect(task(id).status).toBe("done")
    })

    it("se réaligne sur le serveur quand un morceau était déjà arrivé", async () => {
        const { manager, server, task, settled } = setup()
        let once = true
        server.intercept = (call, session) => {
            // Le morceau est écrit mais la réponse se perd : le serveur est en avance sur le navigateur.
            if (call === "put" && session!.view.received === 4 && once) {
                once = false
                session!.data.push(4, 5, 6, 7)
                session!.view = { ...session!.view, received: 8 }
            }
        }
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id).status).toBe("done")
        expect([...server.sessions.get("s1")!.data]).toEqual(Array.from({ length: 10 }, (_, i) => i))
    })

    it("repart d'une session neuve, en le disant, quand la sienne a expiré", async () => {
        const { manager, server, task, settled } = setup()
        let once = true
        server.intercept = (call, session) => {
            if (call === "put" && session?.view.received === 4 && once) {
                once = false
                server.sessions.delete(session.view.id)
                throw new TransportError(410, "Session expirée")
            }
        }
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id)).toMatchObject({ status: "done", sessionId: "s2" })
        expect(task(id).phases.upload.note).toContain("repris depuis le début")
        expect(server.chunkOffsets.s2).toEqual([0, 4, 8])
    })

    it("signale l'échec du traitement serveur et repart de zéro à la relance", async () => {
        const { manager, server, task, settled } = setup()
        server.failProcessing = "Vidéo illisible ou endommagée."
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id)).toMatchObject({ status: "failed", sessionId: null, url: null })
        expect(task(id).error!.message).toBe("Vidéo illisible ou endommagée.")

        server.failProcessing = null
        manager.retry(id)
        await settled(id)
        expect(task(id)).toMatchObject({ status: "done", sessionId: "s2" })
    })

    it("n'autorise ni pause ni annulation pendant le traitement final du serveur", async () => {
        const { manager, server, task, until, settled } = setup()
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await until(() => task(id).phases.verification.status === "active")
        manager.pause(id)
        manager.cancel(id)
        expect(task(id).status).toBe("running")
        await settled(id)
        expect(task(id).status).toBe("done")
        expect(server.aborted).toEqual([])
    })
})

describe("rattachement au contenu", () => {
    const target = { entity: "section" as const, id: "sec1", field: "video", expected: "/uploads/video/ancien.mp4", label: "Section « Intro » — Vidéo" }

    it("enregistre lui-même le média sur un contenu existant, formulaire fermé", async () => {
        const { manager, server, task, settled, events } = setup()
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video", slotKey: "section:sec1:video", target })
        await settled(id)
        expect(server.attached).toEqual([{ entity: "section", id: "sec1", field: "video", url: "/uploads/video/cours.mp4", expected: "/uploads/video/ancien.mp4" }])
        expect(task(id).attach.state).toBe("attached")
        expect(events.map((e) => e.type)).toEqual(["done", "attached"])
    })

    it("n'écrase rien si le champ a changé entre-temps", async () => {
        const { manager, server, task, settled, events } = setup()
        server.attachError = new TransportError(409, "Le champ a été modifié entre-temps.")
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video", slotKey: "section:sec1:video", target })
        await settled(id)
        expect(task(id)).toMatchObject({ status: "done", attach: { state: "conflict", message: "Le champ a été modifié entre-temps." } })
        expect(events.map((e) => e.type)).toEqual(["conflict"])
    })

    it("remet le média au formulaire ouvert, sans rien enregistrer pour un contenu en création", async () => {
        const { manager, server, task, settled } = setup()
        const received: string[] = []
        manager.bindSlot("section:new:c1:video", (url) => received.push(url))
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video", slotKey: "section:new:c1:video", target: { ...target, id: undefined } })
        await settled(id)
        expect(received).toEqual(["/uploads/video/cours.mp4"])
        expect(task(id).attach.state).toBe("delivered")
        expect(server.attached).toEqual([])
    })

    it("garde le média en attente formulaire fermé, puis le remet à sa réouverture", async () => {
        const { manager, task, settled } = setup()
        const unbind = manager.bindSlot("course:new:heroImage", () => undefined)
        const [id] = manager.add([file("affiche.png", 10, "image/png")], { kind: "hero", slotKey: "course:new:heroImage" })
        unbind()
        await settled(id)
        expect(task(id)).toMatchObject({ status: "done", attach: { state: "waiting" } })

        const received: string[] = []
        manager.bindSlot("course:new:heroImage", (url) => received.push(url))
        await vi.advanceTimersByTimeAsync(0)
        expect(received).toEqual(["/uploads/video/affiche.png"])
        expect(task(id).attach.state).toBe("delivered")
    })

    it("repropose le média à chaque réouverture d'un formulaire de création, jusqu'à son enregistrement", async () => {
        const { manager, task, settled } = setup()
        const slot = "section:new:c1:video"
        const first: string[] = []
        const unbind = manager.bindSlot(slot, (url) => first.push(url))
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video", slotKey: slot })
        await settled(id)
        expect(first).toHaveLength(1)
        unbind()

        // L'administrateur quitte la page sans enregistrer, puis rouvre le formulaire.
        const second: string[] = []
        const unbindSecond = manager.bindSlot(slot, (url) => second.push(url))
        await vi.advanceTimersByTimeAsync(0)
        expect(second).toEqual(first)
        unbindSecond()

        // Formulaire enregistré : le média n'est plus proposé au prochain formulaire vierge.
        manager.forgetSlots("section:new:c1:")
        const third: string[] = []
        manager.bindSlot(slot, (url) => third.push(url))
        await vi.advanceTimersByTimeAsync(0)
        expect(third).toEqual([])
        expect(task(id)).toMatchObject({ status: "done", slotKey: null })
    })

    it("ne repropose pas un média déjà enregistré sur un contenu existant", async () => {
        const { manager, settled } = setup()
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video", slotKey: "section:sec1:video", target })
        await settled(id)
        const received: string[] = []
        manager.bindSlot("section:sec1:video", (url) => received.push(url))
        await vi.advanceTimersByTimeAsync(0)
        expect(received).toEqual([])
    })

    it("prévient qui attend la fin d'une tâche, succès comme échec", async () => {
        const { manager, settled } = setup()
        const [ok, ko] = manager.add([file("a.png", 10, "image/png"), file("b.exe", 10, "")], { kind: "misc" })
        const results = Promise.all([manager.whenSettled(ok), manager.whenSettled(ko)])
        await settled(ok, ko)
        expect((await results).map((t) => t.status)).toEqual(["done", "failed"])
    })
})

describe("rechargement de la page", () => {
    it("restaure la file et reprend le transfert à l'octet atteint", async () => {
        const server = new FakeServer()
        const store = new FakeStore()
        const first = setup({ server, store })
        await first.manager.init()

        const gate = new Promise<void>(() => undefined)
        server.intercept = (call, session) => (call === "put" && session!.view.received === 8 ? gate : undefined)
        const [id] = first.manager.add([file("cours.mp4", 14)], { kind: "video" })
        await first.until(() => first.task(id).bytesSent === 8 && store.saved.length === 1 && first.task(id).reloadSafe)

        // Rechargement : un gestionnaire neuf, le même navigateur, le même serveur.
        server.intercept = () => undefined
        const second = setup({ server, store })
        await second.manager.init()
        expect(second.task(id)).toMatchObject({ status: expect.stringMatching(/queued|running/), sessionId: "s1" })

        await second.settled(id)
        expect(second.task(id).status).toBe("done")
        expect(server.chunkOffsets.s1).toEqual([0, 4, 8, 12])
        expect(server.calls.filter((c) => c === "create")).toHaveLength(1)
        expect(store.blobs.size).toBe(0)
    })

    it("signale clairement un fichier que le navigateur n'a pas pu conserver", async () => {
        const store = new FakeStore()
        const first = setup({ store })
        await first.manager.init()
        const [id] = first.manager.add([file("cours.mp4", 14)], { kind: "video" })
        await first.until(() => store.saved.length === 1)
        store.saved[0] = { ...store.saved[0], status: "running" }
        store.blobs.clear()

        const second = setup({ store })
        await second.manager.init()
        expect(second.task(id).status).toBe("failed")
        expect(second.task(id).error).toMatchObject({ retryable: false })
        expect(second.task(id).error!.hint).toContain("Sélectionnez-le à nouveau")
    })

    it("ne conserve rien quand un autre onglet tient déjà la file", async () => {
        const store = new FakeStore()
        store.owner = false
        const { manager, task, settled } = setup({ store })
        await manager.init()
        const [id] = manager.add([file("cours.mp4", 10)], { kind: "video" })
        await settled(id)
        expect(task(id)).toMatchObject({ status: "done", reloadSafe: false })
        expect(manager.getSnapshot().persistent).toBe(false)
        expect(store.saved).toEqual([])
    })
})
