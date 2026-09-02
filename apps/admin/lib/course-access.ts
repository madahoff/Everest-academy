/**
 * Octroi et retrait des accès aux cours depuis la console d'administration.
 *
 * L'accès à un cours se lit, côté site, comme la RÉUNION de deux traces (voir
 * `apps/web/lib/premium.ts`) :
 *  - une ligne `Purchase` (userId + courseId) — l'accès à CE cours, qu'il ait été
 *    payé, offert ou débloqué par un code ;
 *  - `users.plan = PREMIUM` — le Pack Premium, qui ouvre tout le catalogue, y compris
 *    les cours publiés APRÈS l'octroi.
 *
 * Ce module écrit les deux, et rien d'autre : c'est le seul endroit de la console qui
 * crée ou supprime des `Purchase`, pour que la règle « un accès offert vaut une ligne
 * à 0 » reste vraie partout — l'audience d'un cours se compte sur `Purchase`.
 *
 * ATTENTION : retirer un accès SUPPRIME la ligne d'achat. Si cet achat avait été payé,
 * sa recette disparaît des statistiques, qui agrègent `Purchase.amount` (voir
 * `lib/course-sales.ts`). L'appelant est prévenu par `paidRevoked`, et l'interface
 * demande confirmation avant de retirer un accès payé.
 */

import { prisma } from "@/lib/prisma"

/** Garde-fous : au-delà, c'est une erreur d'appel, pas une opération d'administration. */
const MAX_USERS = 1000
const MAX_COURSES = 500

export type AccessMode = "set" | "grant" | "revoke"

export interface AccessRequest {
    userIds: string[]
    /**
     * `set`    : la liste fournie devient EXACTEMENT la liste des accès (le reste est retiré) ;
     * `grant`  : ajoute les cours fournis, sans toucher aux autres ;
     * `revoke` : retire les cours fournis, sans toucher aux autres.
     */
    mode: AccessMode
    courseIds: string[]
    /** Pack Premium, facultatif et indépendant de la liste de cours. */
    plan?: "FREE" | "PREMIUM"
}

export interface AccessResult {
    granted: number
    revoked: number
    /** Accès retirés qui avaient été PAYÉS : autant de recette effacée des statistiques. */
    paidRevoked: number
    planChanged: number
}

const MODES: AccessMode[] = ["set", "grant", "revoke"]

/** Liste d'identifiants propre : chaînes non vides, sans doublon, bornée. */
function parseIds(value: unknown, max: number): string[] | null {
    if (!Array.isArray(value)) return null
    if (value.length > max) return null
    const ids = new Set<string>()
    for (const item of value) {
        if (typeof item !== "string" || item.trim().length === 0) return null
        ids.add(item.trim())
    }
    return [...ids]
}

/**
 * Valide un corps de requête reçu du navigateur. Retourne `null` — et donc un 400
 * franc — plutôt qu'une opération silencieusement amputée.
 */
export function parseAccessRequest(body: unknown): AccessRequest | null {
    if (typeof body !== "object" || body === null) return null
    const source = body as Record<string, unknown>

    const userIds = parseIds(source.userIds, MAX_USERS)
    if (!userIds || userIds.length === 0) return null

    const courseIds = parseIds(source.courseIds, MAX_COURSES)
    if (!courseIds) return null

    const mode = source.mode
    if (typeof mode !== "string" || !MODES.includes(mode as AccessMode)) return null

    let plan: "FREE" | "PREMIUM" | undefined
    if (source.plan !== undefined) {
        if (source.plan !== "FREE" && source.plan !== "PREMIUM") return null
        plan = source.plan
    }

    // `grant` et `revoke` sans aucun cours ne veulent rien dire ; `set` avec une liste
    // vide en veut un, lui : « retirer tous les accès ».
    if (mode !== "set" && courseIds.length === 0 && plan === undefined) return null

    return { userIds, mode: mode as AccessMode, courseIds, plan }
}

/**
 * Applique la demande. Les cours inconnus sont ignorés à l'octroi — une liste périmée
 * dans un onglet resté ouvert ne doit pas faire échouer toute l'opération — mais font
 * bien l'objet d'un retrait, qui n'a besoin d'aucune existence.
 */
export async function applyCourseAccess(request: AccessRequest): Promise<AccessResult> {
    const { userIds, mode, courseIds, plan } = request

    const known = courseIds.length
        ? (await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true } })).map((c) => c.id)
        : []
    const knownSet = new Set(known)

    // Un seul aller-retour pour l'état courant de tous les utilisateurs visés.
    const existing = await prisma.purchase.findMany({
        where: { userId: { in: userIds }, courseId: { not: null } },
        select: { userId: true, courseId: true, amount: true },
    })

    const ownedByUser = new Map<string, Map<string, boolean>>()
    for (const row of existing) {
        const courseId = row.courseId as string
        const owned = ownedByUser.get(row.userId) ?? new Map<string, boolean>()
        // Une même paire peut porter plusieurs lignes (rachat, code) : il suffit qu'une
        // seule soit payante pour que le retrait efface de la recette.
        owned.set(courseId, (owned.get(courseId) ?? false) || Number(row.amount) > 0)
        ownedByUser.set(row.userId, owned)
    }

    const toCreate: { userId: string; courseId: string }[] = []
    const toRevoke: { userId: string; courseId: string }[] = []
    let paidRevoked = 0

    const revoke = (userId: string, courseId: string, paid: boolean) => {
        toRevoke.push({ userId, courseId })
        if (paid) paidRevoked++
    }

    for (const userId of userIds) {
        const owned = ownedByUser.get(userId) ?? new Map<string, boolean>()

        if (mode === "grant" || mode === "set") {
            for (const courseId of known) {
                if (!owned.has(courseId)) toCreate.push({ userId, courseId })
            }
        }

        if (mode === "revoke") {
            for (const courseId of courseIds) {
                if (owned.has(courseId)) revoke(userId, courseId, owned.get(courseId)!)
            }
        }

        if (mode === "set") {
            for (const [courseId, paid] of owned) {
                if (!knownSet.has(courseId)) revoke(userId, courseId, paid)
            }
        }
    }

    let planChanged = 0

    // Une transaction : un octroi partiel laisserait une liste d'accès à moitié écrite,
    // impossible à distinguer d'un réglage voulu.
    await prisma.$transaction(async (tx) => {
        if (toRevoke.length > 0) {
            // Un `deleteMany` par cours : le SQL généré reste borné au nombre de cours
            // touchés, pas au produit utilisateurs x cours.
            const usersByCourse = new Map<string, string[]>()
            for (const { userId, courseId } of toRevoke) {
                usersByCourse.set(courseId, [...(usersByCourse.get(courseId) ?? []), userId])
            }
            for (const [courseId, users] of usersByCourse) {
                await tx.purchase.deleteMany({ where: { courseId, userId: { in: users } } })
            }
        }

        if (toCreate.length > 0) {
            // amount = 0 : un accès accordé depuis la console est offert, il ne crée
            // aucune recette (voir `lib/course-sales.ts`).
            await tx.purchase.createMany({
                data: toCreate.map(({ userId, courseId }) => ({ userId, courseId, amount: 0 })),
            })
        }

        if (plan === "PREMIUM") {
            // `premiumSince` n'est posé que sur une vraie acquisition : réappliquer le
            // pack à un membre qui l'a déjà ne doit pas rajeunir son ancienneté.
            const res = await tx.user.updateMany({
                where: { id: { in: userIds }, plan: "FREE" },
                data: { plan: "PREMIUM", premiumSince: new Date() },
            })
            planChanged = res.count
        } else if (plan === "FREE") {
            const res = await tx.user.updateMany({
                where: { id: { in: userIds }, plan: "PREMIUM" },
                data: { plan: "FREE" },
            })
            planChanged = res.count
        }
    })

    return { granted: toCreate.length, revoked: toRevoke.length, paidRevoked, planChanged }
}
