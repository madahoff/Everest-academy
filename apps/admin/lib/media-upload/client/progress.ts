import { PHASES, type GlobalProgress, type PhaseId, type UploadTask } from "./types"

/**
 * Poids de chaque étape dans l'avancement d'un fichier.
 *
 * Ils reflètent la durée habituelle des étapes : le transfert domine, la compression
 * d'une vidéo pèse presque autant, les contrôles sont brefs. Une étape sautée ne pèse
 * rien — sa part est redistribuée dès que la décision est connue, c'est-à-dire pendant
 * la validation, avant que la barre n'ait réellement avancé.
 */
function weight(task: UploadTask, phase: PhaseId): number {
    if (task.phases[phase].status === "skipped") return 0
    switch (phase) {
        case "validation": return 1
        case "compression": return task.family === "video" ? 40 : 6
        case "preparation": return 1
        case "upload": return 50
        case "verification": return 4
        case "processing": return task.family === "video" ? 6 : 0
        case "available": return 1
    }
}

/** Avancement brut d'une tâche d'après ses étapes. Plafonné à 99 % tant qu'elle n'est pas disponible. */
export function computeTaskProgress(task: UploadTask): number {
    if (task.status === "done") return 1

    let total = 0
    let achieved = 0
    for (const phase of PHASES) {
        const w = weight(task, phase)
        const state = task.phases[phase]
        total += w
        if (state.status === "done") achieved += w
        else if (state.status === "active") achieved += w * Math.min(1, Math.max(0, state.progress ?? 0))
    }
    return total === 0 ? 0 : Math.min(0.99, achieved / total)
}

/**
 * Avancement du lot en cours, pondéré par la taille des fichiers : une vidéo de 500 Mo
 * compte davantage qu'une image. Les tâches annulées ou en échec en sont exclues — elles
 * sont comptées à part — pour que la barre ne reste pas figée à cause d'elles.
 */
export function computeGlobalProgress(tasks: UploadTask[]): GlobalProgress {
    const global: GlobalProgress = { active: 0, queued: 0, paused: 0, failed: 0, done: 0, progress: 0 }
    const live = tasks.filter((t) => t.status === "queued" || t.status === "running" || t.status === "paused")
    const batches = new Set(live.map((t) => t.batchId))

    let weightSum = 0
    let achieved = 0
    for (const task of tasks) {
        if (task.status === "failed") global.failed++
        if (task.status === "done") global.done++
        if (task.status === "queued") global.queued++
        if (task.status === "paused") global.paused++
        if (task.status === "queued" || task.status === "running" || task.status === "paused") global.active++

        if (task.status === "failed" || task.status === "canceled" || !batches.has(task.batchId)) continue
        const size = Math.max(1, task.originalSize)
        weightSum += size
        achieved += size * task.progress
    }

    global.progress = weightSum === 0 ? 0 : achieved / weightSum
    // Tant qu'une tâche vit encore, le lot n'est pas terminé, quels que soient les arrondis.
    if (global.active > 0) global.progress = Math.min(0.99, global.progress)
    return global
}

/**
 * Débit lissé d'un transfert. Une estimation de temps restant n'est donnée qu'après
 * quelques secondes de mesure : avant, elle varierait trop pour être honnête.
 */
export class SpeedMeter {
    private startedAt: number | null = null
    private lastAt = 0
    private lastBytes = 0
    private smoothed: number | null = null

    constructor(private warmupMs = 3000) {}

    sample(bytes: number, now: number): void {
        if (this.startedAt === null) {
            this.startedAt = this.lastAt = now
            this.lastBytes = bytes
            return
        }
        const elapsed = now - this.lastAt
        if (elapsed < 500) return
        const instant = Math.max(0, (bytes - this.lastBytes) / (elapsed / 1000))
        this.smoothed = this.smoothed === null ? instant : this.smoothed * 0.7 + instant * 0.3
        this.lastAt = now
        this.lastBytes = bytes
    }

    get speed(): number | null {
        return this.smoothed
    }

    eta(remainingBytes: number, now: number): number | null {
        if (this.startedAt === null || now - this.startedAt < this.warmupMs) return null
        if (!this.smoothed || this.smoothed <= 0) return null
        return remainingBytes / this.smoothed
    }
}

/** Temps restant d'une étape dont on ne connaît que la fraction accomplie (compression). */
export function etaFromFraction(fraction: number | null, elapsedMs: number): number | null {
    if (fraction === null || fraction < 0.05 || fraction >= 1 || elapsedMs < 3000) return null
    return (elapsedMs / 1000) * ((1 - fraction) / fraction)
}

export const MAX_ATTEMPTS = 6

/** Temporisation progressive : 1 s, 2 s, 4 s… plafonnée à 30 s, avec un aléa pour désynchroniser les tâches. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
    const base = Math.min(30_000, 1000 * 2 ** (attempt - 1))
    return Math.round(base * (1 + random() * 0.25))
}
