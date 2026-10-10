import type { MediaFamily, UploadKind } from "../shared"
import type { AttachTarget } from "../targets"

/**
 * Parcours complet d'un fichier, de sa sélection à sa disponibilité. L'ordre du
 * tableau est l'ordre d'affichage.
 */
export const PHASES = ["validation", "compression", "preparation", "upload", "verification", "processing", "available"] as const
export type PhaseId = (typeof PHASES)[number]

export interface PhaseState {
    status: "pending" | "active" | "done" | "skipped"
    /** Avancement entre 0 et 1 ; `null` quand il n'est pas mesurable (indicateur d'activité). */
    progress: number | null
    /** Précision affichée sous l'étape (« déjà optimisée », « conversion sur le serveur »…). */
    note?: string
}

/**
 *  - `queued` : en attente d'une place (préparation ou transfert, selon `stage`) ;
 *  - `running` : une étape est en cours ;
 *  - `paused` : suspendu par l'utilisateur, une coupure réseau ou une session expirée.
 */
export type TaskStatus = "queued" | "running" | "paused" | "failed" | "done" | "canceled"

export type PauseReason = "user" | "offline" | "auth"

export interface TaskError {
    message: string
    /** Ce que l'utilisateur peut faire pour s'en sortir. */
    hint?: string
    /** Une relance a-t-elle une chance d'aboutir ? */
    retryable: boolean
}

/**
 * Rattachement du média à son contenu :
 *  - `none` : média libre, sans formulaire d'origine ;
 *  - `waiting` : formulaire de création fermé — le média l'attend ;
 *  - `delivered` : remis au formulaire ouvert ;
 *  - `attached` : enregistré sur le contenu par le gestionnaire ;
 *  - `conflict` : le champ a changé entre-temps, rien n'a été écrasé.
 */
export interface AttachState {
    state: "none" | "waiting" | "delivered" | "attached" | "conflict"
    message?: string
}

export interface UploadTask {
    id: string
    name: string
    family: MediaFamily
    kind: UploadKind
    originalSize: number
    /** Taille après compression — égale à l'originale si le fichier part tel quel. */
    preparedSize: number | null
    /** Taille du média publié, après un éventuel traitement serveur. */
    finalSize: number | null

    status: TaskStatus
    /** Prochaine ressource nécessaire : préparation locale ou transfert. */
    stage: "prepare" | "transfer"
    phases: Record<PhaseId, PhaseState>
    /** Avancement de bout en bout, entre 0 et 1. N'atteint 1 qu'à la disponibilité confirmée. */
    progress: number

    bytesSent: number
    bytesTotal: number | null
    /** Débit lissé, en octets par seconde. */
    speed: number | null
    /** Temps restant de l'étape en cours, quand l'estimation est fiable. */
    etaSeconds: number | null
    compressionMs: number | null

    attempt: number
    /** Horodatage de la prochaine tentative automatique. */
    retryAt: number | null
    pauseReason: PauseReason | null
    error: TaskError | null

    sessionId: string | null
    url: string | null
    slotKey: string | null
    target: AttachTarget | null
    attach: AttachState

    /** Le fichier est conservé par le navigateur : la tâche survit à un rechargement. */
    reloadSafe: boolean
    batchId: string
    createdAt: number
    finishedAt: number | null
}

export interface AddOptions {
    kind: UploadKind
    /** Emplacement du formulaire d'origine (« section:abc:video »). Un seul envoi actif par emplacement. */
    slotKey?: string
    target?: AttachTarget
}

export interface GlobalProgress {
    /** Tâches non terminées. */
    active: number
    queued: number
    paused: number
    failed: number
    done: number
    /** Avancement du lot en cours entre 0 et 1, pondéré par la taille des fichiers. */
    progress: number
}

export interface Snapshot {
    tasks: UploadTask[]
    global: GlobalProgress
    /** Faux quand un autre onglet tient déjà la file : celui-ci ne conserve rien après rechargement. */
    persistent: boolean
}

export type ManagerEvent =
    | { type: "done"; task: UploadTask }
    | { type: "failed"; task: UploadTask }
    | { type: "attached"; task: UploadTask }
    | { type: "conflict"; task: UploadTask }
