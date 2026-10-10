import type { PhaseId, UploadTask } from "@/lib/media-upload/client/types"

export const PHASE_LABELS: Record<PhaseId, string> = {
    validation: "Validation",
    compression: "Compression",
    preparation: "Préparation du transfert",
    upload: "Transfert",
    verification: "Vérification d'intégrité",
    processing: "Traitement serveur",
    available: "Disponibilité",
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
    const mb = bytes / 1024 / 1024
    if (mb < 1024) return `${mb < 10 ? mb.toFixed(1).replace(".", ",") : Math.round(mb)} Mo`
    return `${(mb / 1024).toFixed(2).replace(".", ",")} Go`
}

export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
}

export const percent = (fraction: number) => `${Math.floor(fraction * 100)} %`

export function activePhase(task: UploadTask): PhaseId | null {
    return (Object.keys(task.phases) as PhaseId[]).find((phase) => task.phases[phase].status === "active") ?? null
}

export type Tone = "neutral" | "active" | "success" | "warning" | "danger"

/** L'état d'une tâche en une ligne, tel qu'un administrateur le lit. */
export function describeStatus(task: UploadTask): { label: string; tone: Tone } {
    switch (task.status) {
        case "queued":
            return { label: task.stage === "transfer" ? "Prêt — en attente de transfert" : "En attente", tone: "neutral" }
        case "running": {
            if (task.retryAt) return { label: `Nouvelle tentative automatique (essai ${task.attempt + 1})`, tone: "warning" }
            const phase = activePhase(task)
            if (!phase) return { label: "En cours", tone: "active" }
            const progress = task.phases[phase].progress
            return { label: progress === null ? `${PHASE_LABELS[phase]}…` : `${PHASE_LABELS[phase]} : ${percent(progress)}`, tone: "active" }
        }
        case "paused":
            if (task.pauseReason === "offline") return { label: "Hors ligne — reprise automatique au retour du réseau", tone: "warning" }
            if (task.pauseReason === "auth") return { label: "Session expirée — reconnectez-vous, puis reprenez", tone: "warning" }
            return { label: "Suspendu", tone: "warning" }
        case "failed":
            return { label: "Échec", tone: "danger" }
        case "canceled":
            return { label: "Annulé", tone: "neutral" }
        case "done":
            return task.attach.state === "conflict" || task.attach.state === "waiting"
                ? { label: "Disponible — non rattaché", tone: "warning" }
                : { label: "Disponible", tone: "success" }
    }
}

export const TONE_TEXT: Record<Tone, string> = {
    neutral: "text-gray-400",
    active: "text-[#2563EB]",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
}

export const TONE_BAR: Record<Tone, string> = {
    neutral: "bg-gray-300",
    active: "bg-[#2563EB]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
}
