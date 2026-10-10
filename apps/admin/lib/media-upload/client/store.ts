import type { PreparedMedia, TaskStore } from "./manager"
import type { UploadTask } from "./types"

const TASKS_KEY = "everest.uploads.tasks.v1"
const LOCK_NAME = "everest.uploads.owner"
const DB_NAME = "everest-uploads"
const BLOBS = "blobs"

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(BLOBS)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb()
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(BLOBS, mode)
            const request = action(transaction.objectStore(BLOBS))
            transaction.oncomplete = () => resolve(request.result)
            transaction.onerror = transaction.onabort = () => reject(transaction.error ?? request.error)
        })
    } finally {
        db.close()
    }
}

/**
 * Mémoire de la file dans le navigateur : l'état des tâches en localStorage, les
 * fichiers en IndexedDB. C'est ce qui permet de reprendre après un rechargement ou une
 * fermeture de l'onglet — sur ce même navigateur uniquement.
 *
 * Si le navigateur refuse de conserver un fichier (quota, navigation privée), la tâche
 * continue normalement ; elle ne survivra simplement pas à un rechargement.
 */
export const browserStore: TaskStore = {
    /**
     * Un seul onglet tient la file conservée. Le verrou est gardé tant que l'onglet vit,
     * puis libéré tout seul à sa fermeture : le suivant qui s'ouvre prend le relais.
     */
    acquire() {
        if (typeof navigator === "undefined" || !navigator.locks) return Promise.resolve(true)
        return new Promise<boolean>((resolve) => {
            void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
                resolve(lock !== null)
                return lock ? new Promise<void>(() => undefined) : undefined
            })
        })
    },

    loadTasks() {
        try {
            const parsed: unknown = JSON.parse(localStorage.getItem(TASKS_KEY) ?? "[]")
            return Array.isArray(parsed) ? (parsed as UploadTask[]) : []
        } catch {
            return []
        }
    },

    saveTasks(tasks) {
        try {
            localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
        } catch {
            // Stockage plein ou interdit : la file reste en mémoire, sans plus.
        }
    },

    async putBlob(id, media) {
        try {
            await withStore("readwrite", (store) => store.put({ blob: media.blob, name: media.name }, id))
            return true
        } catch {
            return false
        }
    },

    async getBlob(id) {
        const found = (await withStore("readonly", (store) => store.get(id))) as PreparedMedia | undefined
        return found?.blob ? { blob: found.blob, name: found.name } : null
    },

    async deleteBlob(id) {
        await withStore("readwrite", (store) => store.delete(id))
    },
}
