import { describe, expect, it } from "vitest"
import { computeGlobalProgress, computeTaskProgress, etaFromFraction, retryDelayMs, SpeedMeter } from "../client/progress"
import { PHASES, type PhaseId, type PhaseState, type UploadTask } from "../client/types"

function task(overrides: Partial<UploadTask> = {}, phases: Partial<Record<PhaseId, PhaseState>> = {}): UploadTask {
    return {
        id: "t", name: "cours.mp4", family: "video", kind: "video", originalSize: 100, preparedSize: null, finalSize: null,
        status: "running", stage: "prepare",
        phases: { ...(Object.fromEntries(PHASES.map((p) => [p, { status: "pending", progress: null }])) as Record<PhaseId, PhaseState>), ...phases },
        progress: 0, bytesSent: 0, bytesTotal: null, speed: null, etaSeconds: null, compressionMs: null, attempt: 0, retryAt: null,
        pauseReason: null, error: null, sessionId: null, url: null, slotKey: null, target: null, attach: { state: "none" },
        reloadSafe: false, batchId: "b", createdAt: 0, finishedAt: null,
        ...overrides,
    }
}

const done: PhaseState = { status: "done", progress: 1 }

describe("avancement d'une tâche", () => {
    it("part de zéro et couvre la compression autant que le transfert", () => {
        expect(computeTaskProgress(task())).toBe(0)
        const half = computeTaskProgress(task({}, { validation: done, compression: { status: "active", progress: 0.5 } }))
        // validation (1) + moitié de la compression (20) sur 103
        expect(half).toBeCloseTo(21 / 103, 5)
    })

    it("redistribue le poids d'une compression sautée", () => {
        const skipped: PhaseState = { status: "skipped", progress: null }
        const value = computeTaskProgress(task({}, { validation: done, compression: skipped, preparation: done, upload: { status: "active", progress: 0.5 } }))
        expect(value).toBeCloseTo(27 / 63, 5)
    })

    it("n'affiche jamais 100 % avant la confirmation de disponibilité", () => {
        const all = Object.fromEntries(PHASES.map((p) => [p, done])) as Record<PhaseId, PhaseState>
        expect(computeTaskProgress(task({ status: "running" }, all))).toBe(0.99)
        expect(computeTaskProgress(task({ status: "done" }, all))).toBe(1)
    })

    it("compte pour zéro une étape active sans avancement mesurable", () => {
        expect(computeTaskProgress(task({}, { validation: { status: "active", progress: null } }))).toBe(0)
    })
})

describe("avancement global", () => {
    it("pondère par la taille des fichiers", () => {
        const global = computeGlobalProgress([
            task({ id: "a", originalSize: 900, progress: 0.5 }),
            task({ id: "b", originalSize: 100, progress: 1, status: "done" }),
        ])
        expect(global.progress).toBeCloseTo(0.55, 5)
        expect(global).toMatchObject({ active: 1, done: 1, failed: 0 })
    })

    it("exclut les échecs et les annulations, comptés à part", () => {
        const global = computeGlobalProgress([
            task({ id: "a", progress: 0.4 }),
            task({ id: "b", progress: 0.1, status: "failed" }),
            task({ id: "c", progress: 0.1, status: "canceled" }),
        ])
        expect(global.progress).toBeCloseTo(0.4, 5)
        expect(global.failed).toBe(1)
    })

    it("reste sous 100 % tant qu'une tâche vit, et ignore les lots passés", () => {
        const global = computeGlobalProgress([
            task({ id: "old", batchId: "ancien", status: "done", progress: 1, originalSize: 10_000 }),
            task({ id: "a", progress: 0.995 }),
        ])
        expect(global.progress).toBe(0.99)
    })

    it("vaut zéro sans tâche vivante", () => {
        expect(computeGlobalProgress([task({ status: "done", progress: 1 })]).progress).toBe(0)
    })
})

describe("débit et temps restant", () => {
    it("ne donne aucune estimation avant quelques secondes de mesure", () => {
        const meter = new SpeedMeter(3000)
        meter.sample(0, 0)
        meter.sample(1000, 1000)
        expect(meter.speed).toBe(1000)
        expect(meter.eta(5000, 1000)).toBeNull()
        meter.sample(4000, 4000)
        expect(meter.eta(5000, 4000)).toBeCloseTo(5, 1)
    })

    it("estime la compression d'après la fraction accomplie", () => {
        expect(etaFromFraction(0.02, 10_000)).toBeNull()
        expect(etaFromFraction(0.5, 1000)).toBeNull()
        expect(etaFromFraction(0.25, 10_000)).toBeCloseTo(30)
        expect(etaFromFraction(null, 10_000)).toBeNull()
    })
})

describe("temporisation des nouvelles tentatives", () => {
    it("double à chaque essai et plafonne à 30 s", () => {
        const fixed = () => 0
        expect([1, 2, 3, 4, 5, 6, 10].map((attempt) => retryDelayMs(attempt, fixed))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
        expect(retryDelayMs(1, () => 1)).toBe(1250)
    })
})
