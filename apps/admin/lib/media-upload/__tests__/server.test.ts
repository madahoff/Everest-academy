import { execFileSync } from "child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Le protocole d'envoi côté serveur, sur un vrai disque (dossier temporaire) et à travers
 * les vraies routes. Seuls le contrôle d'accès et la base de données sont doublés.
 */

const access = vi.hoisted(() => ({ denied: null as Response | null }))
const db = vi.hoisted(() => ({ rows: new Map<string, Record<string, string | null>>() }))

vi.mock("@/lib/require-admin", () => ({ requireAdmin: async () => access.denied }))
vi.mock("@/lib/prisma", () => {
    const delegate = {
        async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, string> }) {
            const row = db.rows.get(where.id as string)
            if (!row) return { count: 0 }
            const { id: _id, OR, ...fields } = where as { id: string; OR?: Record<string, unknown>[] } & Record<string, unknown>
            const matches = (condition: Record<string, unknown>) => Object.entries(condition).every(([key, value]) => (row[key] ?? null) === value)
            if (!matches(fields) || (OR && !OR.some(matches))) return { count: 0 }
            Object.assign(row, data)
            return { count: 1 }
        },
        count: async ({ where }: { where: { id: string } }) => (db.rows.has(where.id) ? 1 : 0),
    }
    return { prisma: { section: delegate, course: delegate, masterclass: delegate } }
})

import { POST as attachRoute } from "@/app/api/upload/attach/route"
import { GET as configRoute } from "@/app/api/upload/config/route"
import { POST as completeRoute } from "@/app/api/upload/sessions/[id]/complete/route"
import { DELETE as deleteRoute, GET as getRoute, PUT as putRoute } from "@/app/api/upload/sessions/[id]/route"
import { POST as createRoute } from "@/app/api/upload/sessions/route"
import { GET as serveRoute } from "@/app/uploads/[...path]/route"
import { sha256, sweepExpiredSessions } from "../server/sessions"
import { contentMatchesExtension, sniffFormat } from "../server/sniff"
import { planVideo } from "../server/video"
import type { SessionView } from "../shared"

const root = mkdtempSync(join(tmpdir(), "everest-uploads-"))
const hasFfmpeg = (() => {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
        return true
    } catch {
        return false
    }
})()

beforeAll(() => {
    process.env.UPLOADS_DIR = root
    process.env.UPLOAD_CHUNK_MB = "1"
    process.env.MAX_VIDEO_UPLOAD_MB = "50"
    process.env.MAX_IMAGE_UPLOAD_MB = "5"
})
afterAll(() => rmSync(root, { recursive: true, force: true }))
beforeEach(() => {
    access.denied = null
    db.rows.clear()
})

const CHUNK = 1024 * 1024
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const jsonRequest = (body: unknown) => new Request("http://admin.test/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })

async function create(name: string, size: number, kind = "video", mime = ""): Promise<{ status: number; body: SessionView & { error?: string } }> {
    const response = await createRoute(jsonRequest({ name, size, kind, mime }))
    return { status: response.status, body: await response.json() }
}

async function put(id: string, offset: number, bytes: Uint8Array, hash = sha256(bytes)) {
    const request = new Request(`http://admin.test/api/upload/sessions/${id}?offset=${offset}`, {
        method: "PUT",
        body: bytes as BodyInit,
        headers: { "x-chunk-sha256": hash, "content-length": String(bytes.length) },
    })
    const response = await putRoute(request, ctx(id))
    return { status: response.status, body: (await response.json()) as SessionView & { error?: string; session?: SessionView } }
}

const chunksOf = (bytes: Uint8Array) => Array.from({ length: Math.ceil(bytes.length / CHUNK) }, (_, i) => bytes.subarray(i * CHUNK, (i + 1) * CHUNK))

async function complete(id: string, manifest: string[]) {
    const response = await completeRoute(jsonRequest({ manifest }), ctx(id))
    return { status: response.status, body: (await response.json()) as SessionView & { error?: string } }
}

async function waitUntilSettled(id: string): Promise<SessionView> {
    for (let attempt = 0; attempt < 600; attempt++) {
        const view = (await (await getRoute(new Request("http://admin.test"), ctx(id))).json()) as SessionView
        if (view.state !== "processing") return view
        await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error("Traitement jamais terminé")
}

async function uploadAll(name: string, bytes: Uint8Array, kind = "video"): Promise<SessionView> {
    const { body: session } = await create(name, bytes.length, kind)
    const parts = chunksOf(bytes)
    for (const [index, part] of parts.entries()) expect((await put(session.id, index * CHUNK, part)).status).toBe(200)
    expect((await complete(session.id, parts.map(sha256))).status).toBeLessThan(300)
    return waitUntilSettled(session.id)
}

/** Un PNG plausible : la signature, puis du remplissage. */
function png(size: number): Uint8Array {
    const bytes = new Uint8Array(size).map((_, index) => (index * 31) % 256)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
    return bytes
}

const published = (url: string) => join(root, url.slice("/uploads/".length))

describe("signature des fichiers", () => {
    it("reconnaît les formats acceptés et refuse les imposteurs", () => {
        expect(sniffFormat(png(32))).toBe("png")
        expect(sniffFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg")
        expect(sniffFormat(new TextEncoder().encode("RIFFxxxxWEBPVP8 "))).toBe("webp")
        expect(sniffFormat(new TextEncoder().encode("\0\0\0\x18ftypmp42isom"))).toBe("isobmff")
        expect(sniffFormat(new TextEncoder().encode("\0\0\0\x1cftypavifmif1"))).toBe("avif")
        expect(sniffFormat(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("webm")
        expect(sniffFormat(new TextEncoder().encode("MZ\x90\0 exécutable déguisé"))).toBeNull()
        expect(contentMatchesExtension(png(32), "png")).toBe(true)
        expect(contentMatchesExtension(png(32), "jpg")).toBe(false)
        expect(contentMatchesExtension(png(32), "mp4")).toBe(false)
    })
})

describe("contrôle d'accès", () => {
    it("ferme toutes les routes d'envoi à qui n'est pas administrateur", async () => {
        access.denied = Response.json({ error: "unauthorized", message: "Connexion requise" }, { status: 401 })
        const id = "00000000-0000-4000-8000-000000000000"
        const responses = await Promise.all([
            configRoute(),
            createRoute(jsonRequest({ name: "a.png", size: 10, kind: "hero" })),
            getRoute(new Request("http://admin.test"), ctx(id)),
            putRoute(new Request("http://admin.test?offset=0", { method: "PUT", body: "x" }), ctx(id)),
            completeRoute(jsonRequest({ manifest: [] }), ctx(id)),
            deleteRoute(new Request("http://admin.test", { method: "DELETE" }), ctx(id)),
            attachRoute(jsonRequest({})),
        ])
        expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401])
        expect(existsSync(join(root, ".tmp"))).toBe(false)
    })
})

describe("ouverture d'une session", () => {
    it("publie les limites que le navigateur doit respecter", async () => {
        const config = await (await configRoute()).json()
        expect(config).toMatchObject({ chunkBytes: CHUNK, maxConcurrentTransfers: 2, maxBytes: { video: 50 * CHUNK, hero: 5 * CHUNK } })
        expect(config.serverCanTranscode).toBe(hasFfmpeg)
    })

    it.each([
        ["extension interdite pour la nature", "clip.mp4", 100, "hero", "", 415, "Format non accepté"],
        ["extension inconnue", "script.exe", 100, "misc", "", 415, "Format non accepté"],
        ["type MIME incohérent", "photo.png", 100, "hero", "video/mp4", 415, "ne correspond pas"],
        ["image trop lourde", "photo.png", 6 * CHUNK, "hero", "image/png", 413, "limite est de 5 Mo"],
        ["vidéo trop lourde", "film.mp4", 51 * CHUNK, "video", "video/mp4", 413, "YouTube"],
        ["fichier vide", "photo.png", 0, "hero", "image/png", 400, "vide"],
        ["nature inconnue", "photo.png", 100, "secret", "image/png", 400, "Nature"],
    ])("refuse : %s", async (_label, name, size, kind, mime, status, message) => {
        const result = await create(name, size, kind, mime)
        expect(result.status).toBe(status)
        expect(result.body.error).toContain(message)
    })

    it("ignore un nom de fichier hostile : il ne décide d'aucun chemin", async () => {
        const view = await uploadAll("../../etc/passwd évil.png", png(2048), "hero")
        expect(view.state).toBe("ready")
        expect(view.url).toMatch(/^\/uploads\/hero\/\d+_[A-Za-z0-9_]+\.png$/)
        expect(existsSync(published(view.url!))).toBe(true)
    })
})

describe("transfert par morceaux", () => {
    it("assemble le fichier à l'identique et ne le publie qu'après vérification", async () => {
        const bytes = png(2 * CHUNK + 4321)
        const { status, body: session } = await create("Schéma du cours.png", bytes.length, "misc", "image/png")
        expect(status).toBe(201)
        expect(session).toMatchObject({ state: "uploading", received: 0, chunkBytes: CHUNK })

        const parts = chunksOf(bytes)
        for (const [index, part] of parts.entries()) {
            const result = await put(session.id, index * CHUNK, part)
            expect(result.body.received).toBe(Math.min(bytes.length, (index + 1) * CHUNK))
        }
        // Tout est reçu, mais rien n'est encore visible dans les médias publiés.
        expect(existsSync(join(root, "misc"))).toBe(false)

        expect((await complete(session.id, parts.map(sha256))).status).toBeLessThan(300)
        const view = await waitUntilSettled(session.id)
        expect(view).toMatchObject({ state: "ready", finalSize: bytes.length })
        expect(Buffer.compare(readFileSync(published(view.url!)), Buffer.from(bytes))).toBe(0)

        // Terminer une seconde fois ne publie pas un second fichier.
        const again = await complete(session.id, parts.map(sha256))
        expect(again.body.url).toBe(view.url)
        expect(readdirSync(join(root, "misc"))).toHaveLength(1)
    })

    it("indique le point de reprise et ignore un morceau renvoyé deux fois", async () => {
        const bytes = png(2 * CHUNK + 10)
        const { body: session } = await create("reprise.png", bytes.length, "misc")
        const parts = chunksOf(bytes)
        await put(session.id, 0, parts[0])

        // Coupure : le navigateur redemande où en est la session.
        const resumed = (await (await getRoute(new Request("http://admin.test"), ctx(session.id))).json()) as SessionView
        expect(resumed).toMatchObject({ state: "uploading", received: CHUNK })

        // Réponse perdue, morceau renvoyé : accepté sans être réécrit.
        expect((await put(session.id, 0, parts[0])).body.received).toBe(CHUNK)

        // Morceau en avance : refusé, avec l'état qui permet de se réaligner.
        const ahead = await put(session.id, 2 * CHUNK, parts[2])
        expect(ahead.status).toBe(409)
        expect(ahead.body.session?.received).toBe(CHUNK)

        await put(session.id, CHUNK, parts[1])
        await put(session.id, 2 * CHUNK, parts[2])
        await complete(session.id, parts.map(sha256))
        const view = await waitUntilSettled(session.id)
        expect(Buffer.compare(readFileSync(published(view.url!)), Buffer.from(bytes))).toBe(0)
    })

    it("refuse un morceau altéré, sans rien écrire", async () => {
        const bytes = png(CHUNK + 10)
        const { body: session } = await create("altere.png", bytes.length, "misc")
        const result = await put(session.id, 0, bytes.subarray(0, CHUNK), sha256(new Uint8Array(3)))
        expect(result.status).toBe(422)
        expect(result.body.session?.received).toBe(0)
    })

    it("refuse un contenu qui ne correspond pas à son extension et détruit la session", async () => {
        const fake = new TextEncoder().encode("MZ exécutable renommé en image".padEnd(4096, "."))
        const { body: session } = await create("photo.png", fake.length, "hero", "image/png")
        const result = await put(session.id, 0, fake)
        expect(result.status).toBe(415)
        expect(result.body.error).toContain("ne correspond pas")
        expect((await getRoute(new Request("http://admin.test"), ctx(session.id))).status).toBe(404)
    })

    it("refuse un morceau plus gros que prévu ou sans empreinte", async () => {
        const { body: session } = await create("gros.png", 3 * CHUNK, "misc")
        expect((await put(session.id, 0, png(CHUNK + 1))).status).toBe(413)
        const bare = await putRoute(new Request("http://admin.test?offset=0", { method: "PUT", body: png(CHUNK) as BodyInit }), ctx(session.id))
        expect(bare.status).toBe(400)
    })

    it("refuse de terminer un transfert incomplet", async () => {
        const bytes = png(2 * CHUNK)
        const { body: session } = await create("incomplet.png", bytes.length, "misc")
        await put(session.id, 0, bytes.subarray(0, CHUNK))
        const result = await complete(session.id, chunksOf(bytes).map(sha256))
        expect(result.status).toBe(409)
    })

    it("détecte un fichier différent de l'original et ne le publie pas", async () => {
        const bytes = png(CHUNK + 500)
        const { body: session } = await create("integrite.png", bytes.length, "card")
        const parts = chunksOf(bytes)
        for (const [index, part] of parts.entries()) await put(session.id, index * CHUNK, part)

        // Le navigateur annonce l'empreinte du fichier d'origine : elle ne correspond pas à ce qui est sur le disque.
        const manifest = parts.map(sha256)
        manifest[1] = sha256(new TextEncoder().encode("autre contenu"))
        await complete(session.id, manifest)

        const view = await waitUntilSettled(session.id)
        expect(view.state).toBe("failed")
        expect(view.error).toContain("contrôle d'intégrité")
        expect(existsSync(join(root, "card"))).toBe(false)
    })

    it("annule une session et libère sa place", async () => {
        const { body: session } = await create("annule.png", 2 * CHUNK, "misc")
        await put(session.id, 0, png(CHUNK))
        expect(existsSync(join(root, ".tmp", session.id))).toBe(true)
        expect((await deleteRoute(new Request("http://admin.test", { method: "DELETE" }), ctx(session.id))).status).toBe(200)
        expect(existsSync(join(root, ".tmp", session.id))).toBe(false)
    })

    it("fait expirer une session abandonnée et la nettoie", async () => {
        const { body: session } = await create("abandon.png", 2 * CHUNK, "misc")
        await put(session.id, 0, png(CHUNK))

        const metaPath = join(root, ".tmp", session.id, "meta.json")
        const meta = JSON.parse(readFileSync(metaPath, "utf8"))
        writeFileSync(metaPath, JSON.stringify({ ...meta, expiresAt: new Date(Date.now() - 1000).toISOString() }))

        expect((await put(session.id, CHUNK, png(CHUNK))).status).toBe(410)
        expect(await sweepExpiredSessions(true)).toBeGreaterThanOrEqual(1)
        expect(existsSync(join(root, ".tmp", session.id))).toBe(false)
    })
})

describe("service des médias", () => {
    const serve = (path: string, headers: Record<string, string> = {}) =>
        serveRoute(new Request(`http://admin.test/uploads/${path}`, { headers }) as never, { params: Promise.resolve({ path: path.split("/") }) })

    it("ne sert jamais un transfert en cours", async () => {
        const { body: session } = await create("secret.png", 2 * CHUNK, "misc")
        await put(session.id, 0, png(CHUNK))
        expect((await serve(`.tmp/${session.id}/data`)).status).toBe(404)
    })

    it("sert un média publié, en entier ou par plage", async () => {
        const bytes = png(5000)
        const view = await uploadAll("plage.png", bytes, "hero")
        const path = view.url!.slice("/uploads/".length)

        const whole = await serve(path)
        expect(whole.status).toBe(200)
        expect(whole.headers.get("content-type")).toBe("image/png")
        expect((await whole.arrayBuffer()).byteLength).toBe(5000)

        const range = await serve(path, { range: "bytes=100-199" })
        expect(range.status).toBe(206)
        expect(range.headers.get("content-range")).toBe("bytes 100-199/5000")
        expect(Buffer.compare(Buffer.from(await range.arrayBuffer()), Buffer.from(bytes.subarray(100, 200)))).toBe(0)

        expect((await serve(path, { range: "bytes=9000-" })).status).toBe(416)
    })
})

describe("rattachement à un contenu", () => {
    const attach = async (body: unknown) => {
        const response = await attachRoute(jsonRequest(body))
        return { status: response.status, body: (await response.json()) as { error?: string } }
    }

    it("enregistre le média si le champ n'a pas changé, et refuse sinon", async () => {
        const first = await uploadAll("un.png", png(3000), "hero")
        const second = await uploadAll("deux.png", png(3000), "hero")
        db.rows.set("sec1", { heroImage: "/uploads/hero/ancien.png" })

        const ok = await attach({ entity: "section", id: "sec1", field: "heroImage", url: first.url, expected: "/uploads/hero/ancien.png" })
        expect(ok.status).toBe(200)
        expect(db.rows.get("sec1")!.heroImage).toBe(first.url)

        // Le champ ne vaut plus ce qu'il valait au lancement du second envoi : on n'écrase pas.
        const conflict = await attach({ entity: "section", id: "sec1", field: "heroImage", url: second.url, expected: "/uploads/hero/ancien.png" })
        expect(conflict.status).toBe(409)
        expect(db.rows.get("sec1")!.heroImage).toBe(first.url)
    })

    it("remplit un champ facultatif encore vide", async () => {
        const view = await uploadAll("couverture.png", png(3000), "hero")
        db.rows.set("mc1", { coverImage: null })
        expect((await attach({ entity: "masterclass", id: "mc1", field: "coverImage", url: view.url, expected: "" })).status).toBe(200)
        expect(db.rows.get("mc1")!.coverImage).toBe(view.url)
    })

    it("refuse les champs hors liste, les adresses invalides et les médias inexistants", async () => {
        db.rows.set("c1", { heroImage: "" })
        const view = await uploadAll("ok.png", png(3000), "hero")
        expect((await attach({ entity: "user", id: "c1", field: "password", url: view.url })).status).toBe(400)
        expect((await attach({ entity: "course", id: "c1", field: "price", url: view.url })).status).toBe(400)
        expect((await attach({ entity: "course", id: "c1", field: "heroImage", url: "https://evil.test/x.png" })).status).toBe(400)
        expect((await attach({ entity: "course", id: "c1", field: "heroImage", url: "/uploads/hero/../../etc/passwd" })).status).toBe(400)
        expect((await attach({ entity: "course", id: "c1", field: "heroImage", url: "/uploads/hero/absent.png" })).status).toBe(404)
        expect((await attach({ entity: "course", id: "inconnu", field: "heroImage", url: view.url })).status).toBe(404)
        expect(db.rows.get("c1")!.heroImage).toBe("")
    })
})

describe("décision de traitement vidéo", () => {
    const probe = (container: string, videoCodec: string, audioCodec: string | null) => ({ container, videoCodec, audioCodec, duration: 10, width: 1280, height: 720 })
    it("ne réencode que ce qu'un navigateur ne lit pas", () => {
        expect(planVideo(probe("mov,mp4,m4a,3gp,3g2,mj2", "h264", "aac"))).toBe("remux")
        expect(planVideo(probe("mov,mp4,m4a,3gp,3g2,mj2", "h264", null))).toBe("remux")
        expect(planVideo(probe("mov,mp4,m4a,3gp,3g2,mj2", "hevc", "aac"))).toBe("transcode")
        expect(planVideo(probe("mov,mp4,m4a,3gp,3g2,mj2", "h264", "pcm_s16le"))).toBe("transcode")
        expect(planVideo(probe("matroska,webm", "vp9", "opus"))).toBe("keep")
        expect(planVideo(probe("matroska,webm", "h264", "aac"))).toBe("transcode")
    })
})

describe.skipIf(!hasFfmpeg)("vidéos réelles (ffmpeg)", () => {
    const work = mkdtempSync(join(tmpdir(), "everest-videos-"))
    afterAll(() => rmSync(work, { recursive: true, force: true }))

    const make = (name: string, args: string[]) => {
        const path = join(work, name)
        execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", ...args, path])
        return new Uint8Array(readFileSync(path))
    }
    const probe = (path: string) =>
        JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]).toString()) as {
            format: { duration: string }
            streams: { codec_type: string; codec_name: string }[]
        }
    const codecs = (path: string) => Object.fromEntries(probe(path).streams.map((stream) => [stream.codec_type, stream.codec_name]))

    /** L'index (`moov`) précède-t-il les données (`mdat`) ? C'est ce qui permet la lecture immédiate. */
    const isFastStart = (path: string) => {
        const head = readFileSync(path).subarray(0, 4096).toString("latin1")
        return head.includes("moov") && (!head.includes("mdat") || head.indexOf("moov") < head.indexOf("mdat"))
    }

    it("garde un MP4 H.264 sans le réencoder, en plaçant l'index en tête", async () => {
        const bytes = make("cours.mp4", ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "-faststart"])
        const view = await uploadAll("cours.mp4", bytes)
        expect(view.state).toBe("ready")
        expect(view.url).toMatch(/\.mp4$/)
        expect(codecs(published(view.url!))).toEqual({ video: "h264", audio: "aac" })
        expect(isFastStart(published(view.url!))).toBe(true)
        // Simple réécriture du conteneur : la taille ne bouge presque pas.
        expect(Math.abs(view.finalSize! - bytes.length)).toBeLessThan(bytes.length * 0.05)
    })

    it("convertit un .mov HEVC en MP4 H.264 lisible partout", async () => {
        const bytes = make("iphone.mov", ["-c:v", "libx265", "-tag:v", "hvc1", "-pix_fmt", "yuv420p", "-c:a", "aac"])
        const view = await uploadAll("iphone.mov", bytes)
        expect(view.state).toBe("ready")
        expect(view.url).toMatch(/_iphone\.mp4$/)
        expect(codecs(published(view.url!))).toEqual({ video: "h264", audio: "aac" })
        expect(Number(probe(published(view.url!)).format.duration)).toBeCloseTo(3, 0)
        expect(isFastStart(published(view.url!))).toBe(true)
    })

    it("laisse intact un WebM déjà lisible", async () => {
        const bytes = make("ecran.webm", ["-c:v", "libvpx-vp9", "-b:v", "300k", "-c:a", "libopus"])
        const view = await uploadAll("ecran.webm", bytes)
        expect(view).toMatchObject({ state: "ready", finalSize: bytes.length })
        expect(Buffer.compare(readFileSync(published(view.url!)), Buffer.from(bytes))).toBe(0)
    })

    it("rejette une vidéo tronquée dont plus rien n'est lisible", async () => {
        const bytes = make("casse.mp4", ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "-faststart"])
        // Sans son index final, le fichier garde une signature MP4 mais n'a plus de piste.
        const view = await uploadAll("casse.mp4", bytes.subarray(0, Math.floor(bytes.length / 2)))
        expect(view.state).toBe("failed")
        expect(view.error).toContain("illisible")
        expect(readdirSync(join(root, "video")).some((name) => name.includes("casse"))).toBe(false)
    })
})
