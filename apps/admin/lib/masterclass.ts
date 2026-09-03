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

/** Traduit une collision de clé unique Prisma en message lisible. */
export function uniqueMonthError(error: unknown): string | null {
    const code = (error as { code?: string })?.code
    return code === "P2002" ? "Une Masterclass existe déjà pour ce mois : modifiez-la plutôt que d'en créer une seconde" : null
}
