"use client"

import { UploadManager, type Env } from "./manager"
import { browserProcessor } from "./processor"
import { browserStore } from "./store"
import { browserTransport } from "./transport"

const browserEnv: Env = {
    now: () => Date.now(),
    isOnline: () => navigator.onLine,
    onOnline: (callback) => window.addEventListener("online", callback),
    uuid: () => crypto.randomUUID(),
    async hash(bytes) {
        const digest = await crypto.subtle.digest("SHA-256", bytes)
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
    },
}

let manager: UploadManager | null = null

/**
 * Le gestionnaire d'envois de l'onglet. Instance unique, créée au premier besoin et
 * jamais détruite : elle survit à toutes les navigations internes de la console.
 */
export function getUploadManager(): UploadManager {
    manager ??= new UploadManager({ transport: browserTransport, processor: browserProcessor, store: browserStore, env: browserEnv })
    return manager
}
