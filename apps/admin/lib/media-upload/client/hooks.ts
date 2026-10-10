"use client"

import * as React from "react"
import { getUploadManager } from "./index"
import { computeGlobalProgress } from "./progress"
import type { Snapshot, UploadTask } from "./types"

const EMPTY: Snapshot = { tasks: [], global: computeGlobalProgress([]), persistent: false }
const getServerSnapshot = () => EMPTY

/** Instantané de la file d'envois, tenu à jour en temps réel. */
export function useUploads(): Snapshot {
    const manager = getUploadManager()
    return React.useSyncExternalStore(manager.subscribe, manager.getSnapshot, getServerSnapshot)
}

const isOpen = (task: UploadTask) => task.status === "queued" || task.status === "running" || task.status === "paused" || task.status === "failed"

/** L'envoi en cours — ou en échec — sur un emplacement de formulaire, s'il y en a un. */
export function useSlotTask(slotKey: string): UploadTask | null {
    const { tasks } = useUploads()
    return React.useMemo(() => [...tasks].reverse().find((task) => task.slotKey === slotKey && isOpen(task)) ?? null, [tasks, slotKey])
}

/** Vrai tant qu'un envoi est en route sur un emplacement commençant par `prefix`. */
export function useSlotsBusy(prefix: string): boolean {
    const { tasks } = useUploads()
    return tasks.some((task) => task.slotKey?.startsWith(prefix) && (task.status === "queued" || task.status === "running" || task.status === "paused"))
}

// ───────────── Ouverture du panneau de suivi, depuis n'importe quel composant ─────────────

let panelOpen = false
const panelListeners = new Set<() => void>()

export function setUploadPanelOpen(open: boolean): void {
    panelOpen = open
    for (const listener of panelListeners) listener()
}

export function useUploadPanelOpen(): boolean {
    return React.useSyncExternalStore(
        (listener) => {
            panelListeners.add(listener)
            return () => panelListeners.delete(listener)
        },
        () => panelOpen,
        () => false,
    )
}
