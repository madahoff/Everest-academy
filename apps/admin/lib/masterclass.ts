/**
 * Masterclass, côté console d'administration.
 *
 * Deux notions à ne jamais confondre, et c'est tout l'objet de ce module :
 *
 *  - la MASTERCLASS EN COURS (« la prochaine ») — la première séance publiée dont la
 *    date n'est pas passée. Elle se calcule, elle ne se coche pas : le 1er du mois,
 *    la vitrine bascule d'elle-même sur la séance suivante ;
 *  - les ANCIENNES MASTERCLASS et leurs inscriptions, qui restent intégralement
 *    consultables. Une bascule mensuelle ne supprime jamais rien.
 */

import { prisma } from "@/lib/prisma"
import { isMonthKey, monthKeyOf } from "@/lib/masterclass-month"
import { parsePriceEur } from "@/lib/pricing"
import type { RegistrationStatus } from "@prisma/client"

/** Statuts qui occupent réellement une place. */
export const OCCUPYING_STATUSES: RegistrationStatus[] = ["CONFIRMED", "ATTENDED"]

export const REGISTRATION_STATUSES: RegistrationStatus[] = [
    "PENDING",
    "CONFIRMED",
    "CANCELLED",
    "ATTENDED",
    "NO_SHOW",
]

/** Plafond de saisie du tarif en ariary, aligné sur celui du Pack Premium. */
const MAX_PRICE = 100_000_000

/** Une salle, même virtuelle, ne reçoit pas dix mille personnes : au-delà, c'est une faute de frappe. */
const MAX_CAPACITY = 10_000

/** Identifiant de la séance à venir — celle que la vitrine annonce. */
export async function nextMasterclassId(now: Date = new Date()): Promise<string | null> {
    const next = await prisma.masterclass.findFirst({
        where: { status: "PUBLISHED", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
        select: { id: true },
    })
    return next?.id ?? null
}

export interface MasterclassInput {
    monthKey: string
    title: string
    description: string
    instructor: string
    scheduledAt: Date
    duration: string | null
    location: string | null
    coverImage: string | null
    presentationVideo: string | null
    price: number
    priceEur: number | null
    capacity: number | null
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
}

/**
 * Valide le corps d'une création ou d'une modification de séance.
 *
 * Le mois de rattachement est DÉDUIT de la date quand il n'est pas fourni : c'est la
 * règle du produit — une séance appartient au mois où elle a lieu — et cela évite
 * qu'une saisie incohérente (séance de septembre rattachée à octobre) fasse
 * disparaître la session de la vitrine.
 */
export function parseMasterclassInput(body: unknown): { value: MasterclassInput } | { error: string } {
    if (typeof body !== "object" || body === null) return { error: "Corps de requête invalide" }
    const source = body as Record<string, unknown>

    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

    const title = text(source.title)
    if (!title) return { error: "Le titre est obligatoire" }

    const description = text(source.description)
    if (!description) return { error: "La description est obligatoire" }

    const instructor = text(source.instructor)
    if (!instructor) return { error: "Le nom du formateur est obligatoire" }

    const scheduledAt = new Date(text(source.scheduledAt))
    if (Number.isNaN(scheduledAt.getTime())) return { error: "La date de la séance est invalide" }

    const price = Number(source.price)
    if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
        return {
            error: `Le tarif doit être un nombre entier d'ariary, entre 0 et ${MAX_PRICE.toLocaleString("fr-FR")}`,
        }
    }

    const eur = parsePriceEur(source.priceEur)
    if ("error" in eur) return { error: eur.error }

    // Jauge facultative : vide, la séance n'annonce aucune limite de places.
    let capacity: number | null = null
    const rawCapacity = source.capacity
    if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== "") {
        const parsed = Number(rawCapacity)
        if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_CAPACITY) {
            return { error: `Le nombre de places doit être un entier compris entre 1 et ${MAX_CAPACITY}` }
        }
        capacity = parsed
    }

    const status = text(source.status) || "DRAFT"
    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return { error: "Statut inconnu" }

    // Le mois fourni doit correspondre à la date : sinon, la séance serait rattachée à
    // un mois où elle n'a pas lieu, et la « Masterclass du mois » deviendrait fausse.
    const derived = monthKeyOf(scheduledAt)
    const provided = text(source.monthKey)
    if (provided && !isMonthKey(provided)) return { error: "Le mois de rattachement est invalide (format AAAA-MM)" }
    if (provided && provided !== derived) {
        return { error: `La séance a lieu en ${derived} : c'est ce mois qui la porte` }
    }

    return {
        value: {
            monthKey: derived,
            title,
            description,
            instructor,
            scheduledAt,
            duration: text(source.duration) || null,
            location: text(source.location) || null,
            coverImage: text(source.coverImage) || null,
            // Facultative : vidée, la vitrine cesse simplement d'afficher un lecteur.
            presentationVideo: text(source.presentationVideo) || null,
            price,
            priceEur: eur.value,
            capacity,
            status: status as MasterclassInput["status"],
        },
    }
}

// ─── Pack Premium et Masterclass ──────────────────────────────────────────────
//
// Le Pack Premium ouvre TOUTES les Masterclass. La promesse ne tient que si elle est
// posée des DEUX côtés, car les deux événements arrivent dans n'importe quel ordre :
//
//  - une séance est publiée APRÈS l'octroi du pack → `enrollPremiumMembers`, appelée
//    à chaque enregistrement d'une séance ;
//  - le pack est accordé APRÈS la publication d'une séance → `enrollPremiumInUpcoming`,
//    appelée par tous les chemins qui font passer un compte en PREMIUM : l'achat sur
//    la vitrine, le basculement d'une ligne de l'annuaire, l'action groupée, la
//    création d'un compte déjà Premium.
//
// `enrollAllPremiumMembers` est le RATTRAPAGE : il repasse sur toute la population et
// n'a rien à voir avec un cas particulier — il répare les comptes passés en Premium
// avant que ces automatismes n'existent, et sert de filet si l'un d'eux a échoué.
//
// Les trois sont idempotents : la contrainte d'unicité (séance, membre) et
// `skipDuplicates` font que les rejouer ne crée aucun doublon.

/**
 * Devise d'une inscription offerte. Aucun montant n'est facturé : elle ne sert qu'à ce
 * que la colonne ne reste pas vide — l'ariary est la devise de référence.
 */
const FREE_REGISTRATION_CURRENCY = "MGA"

/** Au-delà, l'insertion est découpée : un `createMany` de 50 000 lignes n'a pas de sens. */
const INSERT_CHUNK = 1_000

/** Identifiants des séances PUBLIÉES à venir — celles que le pack ouvre. */
async function upcomingPublishedIds(now: Date): Promise<string[]> {
    const sessions = await prisma.masterclass.findMany({
        where: { status: "PUBLISHED", scheduledAt: { gte: now } },
        select: { id: true },
    })
    return sessions.map((session) => session.id)
}

/**
 * Pose les inscriptions qui manquent dans le produit (séances x membres), et elles
 * seules : une inscription existante n'est JAMAIS réécrite. Une place annulée par le
 * membre, ou marquée absente après la séance, reste donc telle quelle.
 */
async function createMissingRegistrations(
    masterclassIds: string[],
    userIds: string[],
    now: Date,
): Promise<number> {
    if (masterclassIds.length === 0 || userIds.length === 0) return 0

    const existing = await prisma.masterclassRegistration.findMany({
        where: { masterclassId: { in: masterclassIds }, userId: { in: userIds } },
        select: { masterclassId: true, userId: true },
    })
    const known = new Set(existing.map((row) => `${row.masterclassId}:${row.userId}`))

    const rows = []
    for (const masterclassId of masterclassIds) {
        for (const userId of userIds) {
            if (known.has(`${masterclassId}:${userId}`)) continue
            rows.push({
                masterclassId,
                userId,
                amount: 0,
                currency: FREE_REGISTRATION_CURRENCY,
                status: "CONFIRMED" as const,
                confirmedAt: now,
            })
        }
    }
    if (rows.length === 0) return 0

    let created = 0
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const result = await prisma.masterclassRegistration.createMany({
            data: rows.slice(i, i + INSERT_CHUNK),
            skipDuplicates: true,
        })
        created += result.count
    }
    return created
}

/**
 * Inscrit d'office tous les membres du Pack Premium à une séance PUBLIÉE.
 *
 * Sans effet sur une séance en brouillon, archivée ou déjà tenue. La jauge n'est pas
 * opposée : la place d'un membre Premium lui a été vendue avec le pack — le nombre de
 * places annoncé doit donc être dimensionné en conséquence.
 *
 * AUCUN E-MAIL n'est envoyé : une publication déclencherait sinon un envoi en masse au
 * milieu d'une requête HTTP. La console permet de le faire ligne par ligne.
 */
export async function enrollPremiumMembers(masterclassId: string): Promise<number> {
    const masterclass = await prisma.masterclass.findUnique({
        where: { id: masterclassId },
        select: { status: true, scheduledAt: true },
    })

    if (!masterclass || masterclass.status !== "PUBLISHED") return 0
    // Une séance déjà tenue n'inscrit plus personne, fût-il Premium.
    if (masterclass.scheduledAt.getTime() < Date.now()) return 0

    const members = await prisma.user.findMany({ where: { plan: "PREMIUM" }, select: { id: true } })
    return createMissingRegistrations([masterclassId], members.map((member) => member.id), new Date())
}

/**
 * Inscrit des membres à TOUTES les séances publiées à venir — le sens inverse du
 * précédent : le pack vient de leur être accordé, les séances existaient déjà.
 *
 * La liste reçue est RELUE en base et réduite aux comptes réellement PREMIUM : les
 * appelants travaillent sur une sélection de l'annuaire, qui mélange les deux plans.
 * Un compte repassé en FREE entre-temps n'est donc pas inscrit.
 */
export async function enrollPremiumInUpcoming(userIds: string[], now: Date = new Date()): Promise<number> {
    if (userIds.length === 0) return 0

    const [sessions, members] = await Promise.all([
        upcomingPublishedIds(now),
        prisma.user.findMany({ where: { id: { in: userIds }, plan: "PREMIUM" }, select: { id: true } }),
    ])

    return createMissingRegistrations(sessions, members.map((member) => member.id), now)
}

/**
 * Même chose, mais qui ne remonte JAMAIS d'erreur.
 *
 * Pour les chemins dont l'objet premier est d'accorder le pack : le plan est déjà
 * écrit quand on arrive ici, et échouer donnerait à l'administrateur un message
 * d'erreur sur une opération qui a bien eu lieu. L'inscription manquée se rattrape
 * — c'est exactement ce à quoi sert `enrollAllPremiumMembers`.
 */
export async function enrollPremiumInUpcomingSafely(userIds: string[]): Promise<number> {
    try {
        return await enrollPremiumInUpcoming(userIds)
    } catch (error) {
        console.error("Inscription Masterclass des membres Premium échouée", error)
        return 0
    }
}

export interface PremiumEnrollmentReport {
    /** Membres du Pack Premium au moment du passage. */
    members: number
    /** Séances publiées à venir considérées. */
    sessions: number
    /** Inscriptions réellement créées — 0 si tout le monde était déjà inscrit. */
    created: number
}

/**
 * RATTRAPAGE GLOBAL : inscrit tous les membres du Pack Premium à toutes les séances
 * publiées à venir.
 *
 * Utile une fois, pour les comptes passés en Premium avant que l'inscription d'office
 * n'existe. Le rejouer ensuite ne crée rien : c'est une quittance, pas une opération
 * dangereuse. Aucun e-mail n'est envoyé, et aucune inscription existante n'est touchée.
 */
export async function enrollAllPremiumMembers(now: Date = new Date()): Promise<PremiumEnrollmentReport> {
    const [sessions, members] = await Promise.all([
        upcomingPublishedIds(now),
        prisma.user.findMany({ where: { plan: "PREMIUM" }, select: { id: true } }),
    ])

    const created = await createMissingRegistrations(sessions, members.map((member) => member.id), now)
    return { members: members.length, sessions: sessions.length, created }
}

/** Traduit une collision de clé unique Prisma en message lisible. */
export function uniqueMonthError(error: unknown): string | null {
    const code = (error as { code?: string })?.code
    return code === "P2002" ? "Une Masterclass existe déjà pour ce mois : modifiez-la plutôt que d'en créer une seconde" : null
}
