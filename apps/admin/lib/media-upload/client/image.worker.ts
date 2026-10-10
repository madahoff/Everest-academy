import { reencodeImage, type ImageJob } from "./image-core"

// Worker de compression d'image : le décodage, le redimensionnement et l'encodage se
// font hors du fil principal, l'interface reste fluide.
self.onmessage = async (event: MessageEvent<{ source: Blob; job: ImageJob }>) => {
    try {
        self.postMessage({ ok: true, result: await reencodeImage(event.data.source, event.data.job) })
    } catch (error) {
        self.postMessage({ ok: false, error: String(error) })
    }
}
