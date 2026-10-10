import {
    ALLOWED_EXTENSIONS,
    extensionOf,
    familyOfExtension,
    formatMb,
    mimeMatchesFamily,
    type MediaFamily,
    type SessionView,
    type UploadConfig,
    type UploadKind,
} from "../shared"
import { computeGlobalProgress, computeTaskProgress, etaFromFraction, MAX_ATTEMPTS, retryDelayMs, SpeedMeter } from "./progress"
import {
    PHASES,
    type AddOptions,
    type AttachState,
    type ManagerEvent,
    type PauseReason,
    type PhaseId,
    type PhaseState,
    type Snapshot,
    type TaskError,
    type UploadTask,
} from "./types"

/**
 * Gestionnaire central des envois de médias.
 *
 * Il vit en dehors de React : aucun composant ne possède un envoi, donc fermer un
 * dialogue ou changer de page n'interrompt rien. Les composants ne font que lire son
 * instantané et lui passer des ordres.
 *
 * Chaque fichier traverse deux temps, chacun avec sa propre limite de simultanéité :
 *  1. la PRÉPARATION, locale (validation, analyse, compression) ;
 *  2. le TRANSFERT (session, morceaux, vérification, traitement serveur, rattachement).
 *
 * Tout ce qui touche au réseau, au disque du navigateur ou aux codecs est injecté, ce
 * qui rend la file testable sans navigateur.
 */

/** Erreur de l'API d'envoi. `status` vaut 0 pour une panne réseau ou un délai dépassé. */
export class TransportError extends Error {
    constructor(
        public status: number,
        message: string,
        public session?: SessionView,
    ) {
        super(message)
    }
}

export interface Transport {
    getConfig(signal: AbortSignal): Promise<UploadConfig>
    createSession(input: { name: string; size: number; mime: string; kind: UploadKind }, signal: AbortSignal): Promise<SessionView>
    getSession(id: string, signal: AbortSignal): Promise<SessionView>
    putChunk(id: string, offset: number, bytes: ArrayBuffer, hash: string, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<SessionView>
    complete(id: string, manifest: string[], signal: AbortSignal): Promise<SessionView>
    abort(id: string): Promise<void>
    attach(input: { entity: string; id: string; field: string; url: string; expected: string }, signal: AbortSignal): Promise<void>
}

export interface MediaInput {
    blob: Blob
    name: string
    kind: UploadKind
    family: MediaFamily
}

export interface Analysis {
    compress: boolean
    /** Pourquoi le fichier est compressé — ou pourquoi il ne l'est pas. Affiché tel quel. */
    reason: string
}

export interface PreparedMedia {
    blob: Blob
    name: string
}

export interface MediaProcessor {
    analyze(input: MediaInput): Promise<Analysis>
    /** Renvoie `null` quand la compression n'apporte rien : l'original est alors envoyé. */
    compress(input: MediaInput, onProgress: (fraction: number | null) => void, signal: AbortSignal): Promise<PreparedMedia | null>
}

export interface TaskStore {
    /** Vrai si cet onglet devient le gardien de la file conservée. */
    acquire(): Promise<boolean>
    loadTasks(): UploadTask[]
    saveTasks(tasks: UploadTask[]): void
    putBlob(id: string, media: PreparedMedia): Promise<boolean>
    getBlob(id: string): Promise<PreparedMedia | null>
    deleteBlob(id: string): Promise<void>
}

export interface Env {
    now(): number
    isOnline(): boolean
    onOnline(callback: () => void): void
    hash(bytes: ArrayBuffer): Promise<string>
    uuid(): string
}

export interface ManagerDeps {
    transport: Transport
    processor: MediaProcessor
    store: TaskStore
    env: Env
}

interface Runtime {
    source: PreparedMedia | null
    prepared: PreparedMedia | null
    controller: AbortController | null
    manifest: string[]
    /** Écritures en cours dans le stockage du navigateur, menées l'une après l'autre. */
    keeping: Promise<void>
}

class TaskFailure extends Error {
    constructor(
        message: string,
        public options: { hint?: string; retryable: boolean; restart?: boolean },
    ) {
        super(message)
    }
}

class PauseSignal extends Error {
    constructor(public reason: PauseReason) {
        super(reason)
    }
}

const HISTORY_LIMIT = 30
const POLL_MS = 1000

const isLive = (task: UploadTask) => task.status === "queued" || task.status === "running" || task.status === "paused"
const isLost = (error: unknown) => error instanceof TransportError && (error.status === 404 || error.status === 410)

function freshPhases(): Record<PhaseId, PhaseState> {
    return Object.fromEntries(PHASES.map((phase) => [phase, { status: "pending", progress: null }])) as Record<PhaseId, PhaseState>
}

function aborted(): Error {
    return new DOMException("Aborted", "AbortError")
}

export class UploadManager {
    private tasks: UploadTask[] = []
    private runtime = new Map<string, Runtime>()
    private listeners = new Set<() => void>()
    private eventListeners = new Set<(event: ManagerEvent) => void>()
    private slots = new Map<string, (url: string) => void>()
    private waiters = new Map<string, ((task: UploadTask) => void)[]>()

    private config: UploadConfig | null = null
    private persistent = false
    private initialized: Promise<void> | null = null

    private snapshot: Snapshot = { tasks: [], global: computeGlobalProgress([]), persistent: false }
    private dirty = false
    private emitTimer: ReturnType<typeof setTimeout> | null = null
    private saveTimer: ReturnType<typeof setTimeout> | null = null

    constructor(private deps: ManagerDeps) {
        deps.env.onOnline(() => {
            for (const task of this.tasks) {
                if (task.status === "paused" && task.pauseReason === "offline") this.resume(task.id)
            }
        })
    }

    // ───────────────────────────── Lecture ─────────────────────────────

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    getSnapshot = (): Snapshot => {
        if (this.dirty) {
            this.snapshot = { tasks: this.tasks, global: computeGlobalProgress(this.tasks), persistent: this.persistent }
            this.dirty = false
        }
        return this.snapshot
    }

    onEvent(listener: (event: ManagerEvent) => void): () => void {
        this.eventListeners.add(listener)
        return () => this.eventListeners.delete(listener)
    }

    /** Résolue quand la tâche atteint un état final (disponible, en échec ou annulée). */
    whenSettled(id: string): Promise<UploadTask> {
        const task = this.find(id)
        if (!task || !isLive(task)) return Promise.resolve(task ?? ({ status: "canceled" } as UploadTask))
        return new Promise((resolve) => {
            this.waiters.set(id, [...(this.waiters.get(id) ?? []), resolve])
        })
    }

    // ───────────────────────────── Démarrage ─────────────────────────────

    /**
     * Restaure la file conservée par le navigateur. Sans effet si un autre onglet la
     * tient déjà : deux onglets ne doivent pas pousser le même fichier.
     */
    init(): Promise<void> {
        this.initialized ??= this.restore()
        return this.initialized
    }

    private async restore(): Promise<void> {
        this.persistent = await this.deps.store.acquire().catch(() => false)
        if (!this.persistent) return this.touch()

        const restored: UploadTask[] = []
        for (const saved of this.deps.store.loadTasks()) {
            if (this.find(saved.id)) continue
            const task: UploadTask = { ...saved, speed: null, etaSeconds: null, retryAt: null, attempt: 0 }

            if (isLive(task)) {
                const media = task.reloadSafe ? await this.deps.store.getBlob(task.id).catch(() => null) : null
                if (!media) {
                    task.status = "failed"
                    task.error = {
                        message: "Le fichier n'a pas pu être conservé par le navigateur avant le rechargement.",
                        hint: "Sélectionnez-le à nouveau pour relancer l'envoi.",
                        retryable: false,
                    }
                    task.finishedAt = this.deps.env.now()
                } else {
                    this.runtime.set(task.id, {
                        source: task.stage === "prepare" ? media : null,
                        prepared: task.stage === "transfer" ? media : null,
                        controller: null,
                        manifest: [],
                        keeping: Promise.resolve(),
                    })
                    // Une compression interrompue repart du début ; un transfert reprend où le serveur en est.
                    for (const phase of PHASES) {
                        if (task.phases[phase].status === "active") task.phases[phase] = { status: "pending", progress: null }
                    }
                    if (task.status === "running") task.status = "queued"
                }
            }
            restored.push(task)
        }

        this.tasks = [...restored, ...this.tasks]
        this.touch()
        this.pump()
    }

    // ───────────────────────────── Ordres ─────────────────────────────

    add(files: File[], options: AddOptions): string[] {
        const { env } = this.deps
        const batchId = this.tasks.find(isLive)?.batchId ?? env.uuid()

        if (options.slotKey) {
            // Un seul envoi par emplacement : le nouveau fichier remplace celui qui était en route.
            for (const task of this.tasks.filter((t) => t.slotKey === options.slotKey)) {
                if (isLive(task)) this.cancel(task.id)
                else if (task.attach.state === "waiting") this.dismiss(task.id)
            }
        }

        const created = files.map((file): UploadTask => {
            const id = env.uuid()
            this.runtime.set(id, { source: { blob: file, name: file.name }, prepared: null, controller: null, manifest: [], keeping: Promise.resolve() })
            return {
                id,
                name: file.name,
                family: familyOfExtension(extensionOf(file.name)) ?? (file.type.startsWith("video/") ? "video" : "image"),
                kind: options.kind,
                originalSize: file.size,
                preparedSize: null,
                finalSize: null,
                status: "queued",
                stage: "prepare",
                phases: freshPhases(),
                progress: 0,
                bytesSent: 0,
                bytesTotal: null,
                speed: null,
                etaSeconds: null,
                compressionMs: null,
                attempt: 0,
                retryAt: null,
                pauseReason: null,
                error: null,
                sessionId: null,
                url: null,
                slotKey: options.slotKey ?? null,
                target: options.target ?? null,
                attach: { state: "none" },
                reloadSafe: false,
                batchId,
                createdAt: env.now(),
                finishedAt: null,
            }
        })

        this.tasks = [...this.tasks, ...created]
        this.touch()

        for (const task of created) void this.keepBlob(task.id, this.runtime.get(task.id)!.source!)
        this.pump()
        return created.map((task) => task.id)
    }

    pause(id: string): void {
        const task = this.find(id)
        if (!task || !canPause(task)) return
        this.runtime.get(id)?.controller?.abort()
        this.update(id, (t) => ({ ...this.rewindStage(t), status: "paused", pauseReason: "user", retryAt: null, speed: null, etaSeconds: null }))
        this.pump()
    }

    resume(id: string): void {
        const task = this.find(id)
        if (!task || task.status !== "paused") return
        this.update(id, { status: "queued", pauseReason: null, error: null, attempt: 0 })
        this.pump()
    }

    retry(id: string): void {
        const task = this.find(id)
        if (!task || task.status !== "failed" || !task.error?.retryable) return
        this.update(id, { status: "queued", error: null, attempt: 0, finishedAt: null })
        this.pump()
    }

    cancel(id: string): void {
        const task = this.find(id)
        if (!task || !canCancel(task)) return
        this.runtime.get(id)?.controller?.abort()
        if (task.sessionId) void this.deps.transport.abort(task.sessionId).catch(() => null)
        this.update(id, { status: "canceled", retryAt: null, speed: null, etaSeconds: null, finishedAt: this.deps.env.now() })
        this.release(id)
        this.pump()
    }

    /** Retire de la liste une tâche terminée. Le média déjà publié n'est jamais supprimé. */
    dismiss(id: string): void {
        const task = this.find(id)
        if (!task || isLive(task)) return
        // Un transfert en échec laisse une session sur le serveur : autant libérer sa place tout de suite.
        if (task.status === "failed" && task.sessionId) void this.deps.transport.abort(task.sessionId).catch(() => null)
        this.tasks = this.tasks.filter((t) => t.id !== id)
        this.release(id)
        this.touch()
    }

    clearFinished(): void {
        for (const task of this.tasks.filter((t) => !isLive(t))) this.dismiss(task.id)
    }

    /**
     * Branche un formulaire sur son emplacement. Le média qui l'attendait lui est remis
     * aussitôt ; les suivants le seront à leur arrivée.
     *
     * Pour un contenu en cours de création, le dernier média disponible est remis à
     * CHAQUE ouverture du formulaire, tant que celui-ci n'a pas été enregistré : quitter
     * la page ne fait pas perdre un média déjà envoyé.
     */
    bindSlot(slotKey: string, onUrl: (url: string) => void): () => void {
        this.slots.set(slotKey, onUrl)
        // Remise différée d'un cran : le formulaire a ainsi fini de s'initialiser, et sa
        // remise à zéro d'ouverture ne peut pas effacer le média qu'on lui apporte.
        queueMicrotask(() => {
            if (this.slots.get(slotKey) !== onUrl) return
            const pending = [...this.tasks]
                .reverse()
                .find((t) => t.slotKey === slotKey && t.status === "done" && !t.target?.id && (t.attach.state === "waiting" || t.attach.state === "delivered"))
            if (!pending?.url) return
            onUrl(pending.url)
            if (pending.attach.state === "waiting") this.update(pending.id, { attach: { state: "delivered" } })
        })
        return () => {
            if (this.slots.get(slotKey) === onUrl) this.slots.delete(slotKey)
        }
    }

    /**
     * Détache les médias disponibles de leurs emplacements : le formulaire a été
     * enregistré, ou l'utilisateur a retiré le média. Ils ne seront plus proposés.
     * Les fichiers publiés ne sont pas supprimés.
     */
    forgetSlots(prefix: string): void {
        for (const task of this.tasks) {
            if (task.status !== "done" || !task.slotKey?.startsWith(prefix)) continue
            this.update(task.id, { slotKey: null, attach: task.attach.state === "waiting" ? { state: "none" } : task.attach })
        }
    }

    // ───────────────────────────── File d'attente ─────────────────────────────

    private pump(): void {
        const running = this.tasks.filter((t) => t.status === "running")
        let heavy = running.filter((t) => t.stage === "prepare" && t.family === "video").length
        let light = running.filter((t) => t.stage === "prepare" && t.family !== "video").length
        let transfers = running.filter((t) => t.stage === "transfer").length
        // La limite de transferts vient du serveur ; 2 tant qu'il ne l'a pas encore publiée.
        const maxTransfers = this.config?.maxConcurrentTransfers ?? 2

        for (const task of this.tasks) {
            if (task.status !== "queued") continue
            if (task.stage === "transfer") {
                if (transfers >= maxTransfers) continue
                transfers++
            } else if (task.family === "video") {
                // Une seule vidéo compressée à la fois : l'encodage occupe déjà processeur et mémoire.
                if (heavy >= 1) continue
                heavy++
            } else {
                if (light >= 2) continue
                light++
            }
            this.start(task.id)
        }
    }

    private start(id: string): void {
        const runtime = this.runtime.get(id)
        const task = this.find(id)
        if (!runtime || !task) return

        const controller = new AbortController()
        runtime.controller = controller
        this.update(id, { status: "running", error: null, retryAt: null, pauseReason: null })

        const run = task.stage === "prepare" ? this.runPrepare(id, controller.signal) : this.runTransfer(id, controller.signal)
        void run
            .catch((error: unknown) => this.settleFailure(id, controller, error))
            .finally(() => {
                if (runtime.controller === controller) runtime.controller = null
                this.pump()
            })
    }

    private settleFailure(id: string, controller: AbortController, error: unknown): void {
        // Pause ou annulation : l'état a déjà été posé par l'ordre correspondant.
        if (controller.signal.aborted) return

        if (error instanceof PauseSignal) {
            this.update(id, (t) => ({ ...this.rewindStage(t), status: "paused", pauseReason: error.reason, retryAt: null, speed: null, etaSeconds: null }))
            return
        }

        let failure: TaskError
        let restart = false
        if (error instanceof TaskFailure) {
            failure = { message: error.message, hint: error.options.hint, retryable: error.options.retryable }
            restart = !!error.options.restart
        } else if (error instanceof TransportError) {
            failure = describeTransportError(error)
            restart = isLost(error)
        } else {
            console.error("[upload]", error)
            failure = { message: "Erreur inattendue pendant l'envoi.", hint: "Relancez la tâche.", retryable: true }
        }

        this.update(id, (t) => ({
            ...this.rewindStage(t),
            ...(restart ? { sessionId: null, bytesSent: 0 } : {}),
            status: "failed",
            error: failure,
            retryAt: null,
            speed: null,
            etaSeconds: null,
            finishedAt: this.deps.env.now(),
        }))
        this.emitEvent("failed", id)
        this.settleWaiters(id)
    }

    /** Remet en attente les étapes interrompues du temps en cours : elles seront rejouées à la reprise. */
    private rewindStage(task: UploadTask): Partial<UploadTask> {
        const phases = { ...task.phases }
        for (const phase of PHASES) {
            if (phases[phase].status === "active") phases[phase] = { status: "pending", progress: null }
        }
        return { phases }
    }

    // ───────────────────────────── Temps 1 : préparation ─────────────────────────────

    private async runPrepare(id: string, signal: AbortSignal): Promise<void> {
        const { processor, env } = this.deps
        const runtime = this.runtime.get(id)!
        const task = this.find(id)!
        const source = runtime.source
        if (!source) throw new TaskFailure("Fichier source indisponible.", { hint: "Sélectionnez-le à nouveau.", retryable: false })

        const config = await this.retrying(id, signal, () => this.ensureConfig(signal))

        this.setPhase(id, "validation", { status: "active", progress: null })
        const extension = extensionOf(task.name)
        const allowed = ALLOWED_EXTENSIONS[task.kind]
        const family = familyOfExtension(extension)
        if (!family || !allowed.includes(extension)) {
            throw new TaskFailure(`Format non accepté (.${extension || "?"}).`, { hint: `Formats admis ici : ${allowed.join(", ")}.`, retryable: false })
        }
        if (!mimeMatchesFamily(source.blob.type, family)) {
            throw new TaskFailure(`Le type du fichier (${source.blob.type}) ne correspond pas à son extension .${extension}.`, { retryable: false })
        }
        if (source.blob.size === 0) throw new TaskFailure("Le fichier est vide.", { retryable: false })

        const input: MediaInput = { blob: source.blob, name: source.name, kind: task.kind, family }
        const analysis = await processor
            .analyze(input)
            .catch((): Analysis => ({ compress: false, reason: "Analyse impossible dans ce navigateur — fichier envoyé tel quel." }))
        if (signal.aborted) throw aborted()
        this.setPhase(id, "validation", { status: "done", progress: 1 })

        let prepared = source
        if (!analysis.compress) {
            this.setPhase(id, "compression", { status: "skipped", progress: null, note: analysis.reason })
        } else {
            const startedAt = env.now()
            this.setPhase(id, "compression", { status: "active", progress: 0, note: analysis.reason })
            let result: PreparedMedia | null = null
            let failed = false
            try {
                result = await processor.compress(
                    input,
                    (fraction) => {
                        if (signal.aborted) return
                        this.setPhase(id, "compression", { status: "active", progress: fraction, note: analysis.reason })
                        this.update(id, { etaSeconds: etaFromFraction(fraction, env.now() - startedAt) })
                    },
                    signal,
                )
            } catch (error) {
                if (signal.aborted) throw aborted()
                console.warn("[upload] compression impossible:", error)
                failed = true
            }
            if (signal.aborted) throw aborted()

            const compressionMs = env.now() - startedAt
            if (result && result.blob.size < source.blob.size) {
                prepared = result
                const gain = Math.round((1 - result.blob.size / source.blob.size) * 100)
                this.setPhase(id, "compression", { status: "done", progress: 1, note: `Taille réduite de ${gain} %` })
            } else {
                this.setPhase(id, "compression", {
                    status: "done",
                    progress: 1,
                    note: failed ? "Compression impossible dans ce navigateur — fichier envoyé tel quel." : "Aucun gain : l'original est conservé.",
                })
            }
            this.update(id, { compressionMs, etaSeconds: null })
        }

        const limit = config.maxBytes[task.kind]
        if (prepared.blob.size > limit) {
            throw new TaskFailure(`Fichier trop volumineux (${formatMb(prepared.blob.size)}). La limite est de ${formatMb(limit)}.`, {
                hint: family === "video" ? "Hébergez la vidéo sur YouTube et collez son lien, ou réduisez-la avant l'envoi." : "Réduisez l'image avant l'envoi.",
                retryable: false,
            })
        }

        runtime.prepared = prepared
        if (prepared !== source) await this.keepBlob(id, prepared)
        if (signal.aborted) throw aborted()
        runtime.source = null

        this.update(id, { preparedSize: prepared.blob.size, bytesTotal: prepared.blob.size, stage: "transfer", status: "queued" })
    }

    // ───────────────────────────── Temps 2 : transfert ─────────────────────────────

    private async runTransfer(id: string, signal: AbortSignal): Promise<void> {
        const { transport, env } = this.deps
        const runtime = this.runtime.get(id)!
        const media = runtime.prepared
        if (!media) throw new TaskFailure("Fichier préparé indisponible.", { hint: "Sélectionnez-le à nouveau.", retryable: false })
        const size = media.blob.size

        await this.retrying(id, signal, () => this.ensureConfig(signal))

        let view: SessionView | null = null
        for (let restarts = 0; ; restarts++) {
            try {
                view = await this.openSession(id, media, signal)
                view = await this.sendChunks(id, view, media.blob, signal)
                break
            } catch (error) {
                // Session expirée ou purgée : on repart d'une session neuve, une seule fois, en le disant.
                if (!isLost(error) || restarts >= 1) throw error
                runtime.manifest = []
                this.update(id, { sessionId: null, bytesSent: 0 })
                this.setPhase(id, "upload", { status: "pending", progress: null, note: "Session de transfert expirée : l'envoi a repris depuis le début." })
                this.resetProgress(id)
            }
        }

        this.setPhase(id, "upload", { status: "done", progress: 1, note: this.find(id)!.phases.upload.note })
        this.update(id, { bytesSent: size, speed: null, etaSeconds: null })

        if (view.state === "uploading") {
            this.setPhase(id, "verification", { status: "active", progress: 0 })
            const manifest = await this.fullManifest(runtime, media.blob, view.chunkBytes, signal)
            view = await this.retrying(id, signal, () => transport.complete(view!.id, manifest, signal))
        }

        while (view.state === "processing") {
            if (view.processingStep === "verifying" || view.processingStep === null) {
                this.setPhase(id, "verification", { status: "active", progress: view.processingProgress })
            } else {
                this.setPhase(id, "verification", { status: "done", progress: 1 })
                this.setPhase(id, "processing", {
                    status: "active",
                    progress: view.processingProgress,
                    note: view.processingStep === "transcoding" ? "Conversion au format web sur le serveur" : "Optimisation pour la lecture en ligne",
                })
            }
            await sleep(POLL_MS, signal)
            view = await this.retrying(id, signal, () => transport.getSession(view!.id, signal))
        }

        if (view.state === "failed" || !view.url) {
            throw new TaskFailure(view.error ?? "Le traitement final du fichier a échoué sur le serveur.", {
                hint: "Relancez l'envoi : il repartira du début.",
                retryable: true,
                restart: true,
            })
        }

        const url = view.url
        this.setPhase(id, "verification", { status: "done", progress: 1 })
        const processing = this.find(id)!.phases.processing
        this.setPhase(id, "processing", processing.status === "active" ? { ...processing, status: "done", progress: 1 } : { status: "skipped", progress: null })
        this.update(id, { url, finalSize: view.finalSize })

        this.setPhase(id, "available", { status: "active", progress: null })
        const attach = await this.attach(id, url, signal)
        this.setPhase(id, "available", { status: "done", progress: 1 })

        this.update(id, { status: "done", attach, finishedAt: env.now() })
        this.release(id)
        this.emitEvent(attach.state === "conflict" ? "conflict" : "done", id)
        if (attach.state === "attached") this.emitEvent("attached", id)
    }

    /** Retrouve la session existante — c'est elle qui dit où reprendre — ou en ouvre une. */
    private async openSession(id: string, media: PreparedMedia, signal: AbortSignal): Promise<SessionView> {
        const { transport } = this.deps
        const task = this.find(id)!
        this.setPhase(id, "preparation", { status: "active", progress: null })

        let view: SessionView | null = null
        if (task.sessionId) {
            view = await this.retrying(id, signal, () => transport.getSession(task.sessionId!, signal))
            if (view.size !== media.blob.size) throw new TransportError(410, "La session ne correspond plus au fichier.")
        } else {
            view = await this.retrying(id, signal, () =>
                transport.createSession({ name: media.name, size: media.blob.size, mime: media.blob.type, kind: task.kind }, signal),
            )
            this.update(id, { sessionId: view.id })
        }

        this.setPhase(id, "preparation", { status: "done", progress: 1 })
        return view
    }

    private async sendChunks(id: string, initial: SessionView, blob: Blob, signal: AbortSignal): Promise<SessionView> {
        const { transport, env } = this.deps
        const runtime = this.runtime.get(id)!
        const size = blob.size
        const meter = new SpeedMeter()
        let view = initial
        let realignments = 0

        const report = (sent: number) => {
            if (signal.aborted) return
            const now = env.now()
            meter.sample(sent, now)
            const previous = this.find(id)!.phases.upload
            this.setPhase(id, "upload", { status: "active", progress: sent / size, note: previous.note })
            this.update(id, { bytesSent: sent, speed: meter.speed, etaSeconds: meter.eta(size - sent, now) })
        }

        if (view.state === "uploading") report(view.received)

        while (view.state === "uploading" && view.received < size) {
            const offset = view.received
            const bytes = await blob.slice(offset, offset + view.chunkBytes).arrayBuffer()
            const hash = await env.hash(bytes)
            if (signal.aborted) throw aborted()
            runtime.manifest[offset / view.chunkBytes] = hash

            try {
                view = await this.retrying(id, signal, () =>
                    transport.putChunk(view.id, offset, bytes, hash, (loaded) => report(offset + loaded), signal),
                )
            } catch (error) {
                // Le serveur est plus avancé (ou moins) que nous : on se réaligne sur lui.
                if (error instanceof TransportError && error.status === 409 && error.session && realignments++ < 5) {
                    view = error.session
                } else {
                    throw error
                }
            }
            if (view.state === "uploading") report(view.received)
        }
        return view
    }

    /** Empreintes de tous les morceaux. Après une reprise, celles des morceaux déjà envoyés sont recalculées depuis le fichier. */
    private async fullManifest(runtime: Runtime, blob: Blob, chunkBytes: number, signal: AbortSignal): Promise<string[]> {
        const count = Math.ceil(blob.size / chunkBytes)
        for (let index = 0; index < count; index++) {
            if (runtime.manifest[index]) continue
            const bytes = await blob.slice(index * chunkBytes, (index + 1) * chunkBytes).arrayBuffer()
            runtime.manifest[index] = await this.deps.env.hash(bytes)
            if (signal.aborted) throw aborted()
        }
        return runtime.manifest.slice(0, count)
    }

    /**
     * Le média est publié ; reste à le relier à son contenu.
     *  - contenu existant : le gestionnaire l'enregistre lui-même, sauf si le champ a changé ;
     *  - contenu en cours de création : le média est remis au formulaire, ou l'attend.
     */
    private async attach(id: string, url: string, signal: AbortSignal): Promise<AttachState> {
        const task = this.find(id)!
        const deliver = task.slotKey ? this.slots.get(task.slotKey) : undefined

        if (task.target?.id) {
            const { entity, id: entityId, field, expected, label } = task.target
            try {
                await this.retrying(id, signal, () => this.deps.transport.attach({ entity, id: entityId, field, url, expected }, signal))
            } catch (error) {
                if (error instanceof TransportError && (error.status === 409 || error.status === 404)) {
                    return { state: "conflict", message: error.message }
                }
                throw error
            }
            deliver?.(url)
            return { state: "attached", message: `Enregistré automatiquement : ${label}` }
        }

        if (!task.slotKey) return { state: "none" }
        if (deliver) {
            deliver(url)
            return { state: "delivered" }
        }
        return { state: "waiting", message: task.target ? `À rattacher : ${task.target.label}. Rouvrez le formulaire.` : undefined }
    }

    // ───────────────────────────── Outils ─────────────────────────────

    private async ensureConfig(signal: AbortSignal): Promise<UploadConfig> {
        this.config ??= await this.deps.transport.getConfig(signal)
        return this.config
    }

    /**
     * Exécute un appel réseau en rejouant les erreurs passagères avec une temporisation
     * progressive. Hors ligne, la tâche est suspendue plutôt que d'épuiser ses essais :
     * elle reprendra d'elle-même au retour du réseau.
     */
    private async retrying<T>(id: string, signal: AbortSignal, call: () => Promise<T>): Promise<T> {
        for (let attempt = 1; ; attempt++) {
            try {
                const result = await call()
                if (signal.aborted) throw aborted()
                if (attempt > 1) this.update(id, { attempt: 0, retryAt: null })
                return result
            } catch (error) {
                if (signal.aborted) throw aborted()
                if (!(error instanceof TransportError)) throw error
                if (error.status === 401 || error.status === 403) throw new PauseSignal("auth")

                const transient = error.status === 0 || error.status === 408 || error.status === 422 || error.status === 429 || error.status >= 500
                if (!transient || error.status === 507) throw error
                if (error.status === 0 && !this.deps.env.isOnline()) throw new PauseSignal("offline")
                if (attempt >= MAX_ATTEMPTS) throw error

                const delay = retryDelayMs(attempt)
                this.update(id, { attempt, retryAt: this.deps.env.now() + delay, speed: null, etaSeconds: null })
                await sleep(delay, signal)
            }
        }
    }

    /** Confie le fichier au stockage du navigateur, pour que la tâche survive à un rechargement. */
    private keepBlob(id: string, media: PreparedMedia): Promise<void> {
        const runtime = this.runtime.get(id)
        if (!this.persistent || !runtime) return Promise.resolve()
        // En série : la version compressée ne doit jamais être recouverte par l'original, plus lent à écrire.
        runtime.keeping = runtime.keeping.then(async () => {
            const kept = await this.deps.store.putBlob(id, media).catch(() => false)
            if (this.runtime.has(id)) this.update(id, { reloadSafe: kept })
            else void this.deps.store.deleteBlob(id).catch(() => null)
        })
        return runtime.keeping
    }

    /** Libère le fichier tenu en mémoire et sa copie conservée par le navigateur. */
    private release(id: string): void {
        this.runtime.delete(id)
        void this.deps.store.deleteBlob(id).catch(() => null)
        this.settleWaiters(id)
    }

    private settleWaiters(id: string): void {
        const waiters = this.waiters.get(id)
        if (!waiters) return
        this.waiters.delete(id)
        const task = this.find(id) ?? ({ status: "canceled" } as UploadTask)
        for (const resolve of waiters) resolve(task)
    }

    private find(id: string): UploadTask | undefined {
        return this.tasks.find((task) => task.id === id)
    }

    private setPhase(id: string, phase: PhaseId, state: PhaseState): void {
        this.update(id, (task) => ({ phases: { ...task.phases, [phase]: state } }))
    }

    /** Autorise la barre à redescendre — uniquement quand un transfert repart réellement de zéro. */
    private resetProgress(id: string): void {
        this.tasks = this.tasks.map((task) => (task.id === id ? { ...task, progress: computeTaskProgress(task) } : task))
        this.touch()
    }

    private update(id: string, patch: Partial<UploadTask> | ((task: UploadTask) => Partial<UploadTask>)): void {
        let changed = false
        this.tasks = this.tasks.map((task) => {
            if (task.id !== id) return task
            changed = true
            const next = { ...task, ...(typeof patch === "function" ? patch(task) : patch) }
            // La barre ne recule jamais d'elle-même : une étape rejouée ne fait pas perdre l'acquis affiché.
            next.progress = Math.max(task.progress, computeTaskProgress(next))
            return next
        })
        if (changed) this.touch()
    }

    private touch(): void {
        this.dirty = true
        this.emitTimer ??= setTimeout(() => {
            this.emitTimer = null
            for (const listener of this.listeners) listener()
        }, 80)
        this.saveTimer ??= setTimeout(() => {
            this.saveTimer = null
            if (!this.persistent) return
            const live = this.tasks.filter(isLive)
            const finished = this.tasks.filter((t) => !isLive(t)).slice(-HISTORY_LIMIT)
            this.deps.store.saveTasks([...finished, ...live])
        }, 400)
    }

    private emitEvent(type: ManagerEvent["type"], id: string): void {
        const task = this.find(id)
        if (!task) return
        for (const listener of this.eventListeners) listener({ type, task })
    }
}

/** Une tâche peut être suspendue tant que le serveur n'a pas entamé son traitement final. */
export function canPause(task: UploadTask): boolean {
    return (task.status === "queued" || task.status === "running") && !inServerPhases(task)
}

export function canCancel(task: UploadTask): boolean {
    return (task.status === "queued" || task.status === "running" || task.status === "paused") && !inServerPhases(task)
}

function inServerPhases(task: UploadTask): boolean {
    return (["verification", "processing", "available"] as const).some((phase) => task.phases[phase].status === "active")
}

function describeTransportError(error: TransportError): TaskError {
    switch (error.status) {
        case 0:
            return { message: "Connexion au serveur impossible.", hint: "Vérifiez votre connexion puis relancez : le transfert reprendra où il s'est arrêté.", retryable: true }
        case 404:
        case 410:
            return { message: "La session de transfert a expiré.", hint: "Relancez l'envoi : il repartira du début.", retryable: true }
        case 413:
        case 415:
            return { message: error.message, retryable: false }
        case 507:
            return { message: error.message, hint: "Libérez de l'espace sur le serveur puis relancez.", retryable: true }
        default:
            return error.status >= 500
                ? { message: "Le serveur ne répond pas correctement.", hint: "Réessayez dans quelques minutes : le transfert reprendra où il s'est arrêté.", retryable: true }
                : { message: error.message || "L'envoi a été refusé par le serveur.", retryable: false }
    }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(aborted())
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort)
            resolve()
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            reject(aborted())
        }
        signal.addEventListener("abort", onAbort, { once: true })
    })
}
