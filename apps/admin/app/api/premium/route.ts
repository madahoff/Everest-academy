import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { parsePriceEur } from "@/lib/pricing"

/** Ligne unique de réglage : le tarif du pack n'est pas un catalogue. */
const PREMIUM_PLAN_ID = "default"

/** Tarif de repli, si la ligne n'a jamais été écrite. */
const DEFAULT_PRICE = 199_000

/**
 * Le Wallet API n'accepte que des montants entiers d'ariary : un tarif à virgule
 * ferait échouer le paiement au moment du débit, pas ici. On refuse donc en amont.
 */
const MAX_PRICE = 100_000_000

/**
 * Plafond du programme annoncé. Une année académique compte quelques dizaines de
 * modules au plus : au-delà, c'est une faute de frappe.
 */
const MAX_ANNOUNCED = 500

async function readPlan() {
    const plan = await prisma.premiumPlan.findUnique({ where: { id: PREMIUM_PLAN_ID } })
    return {
        price: plan ? Number(plan.price) : DEFAULT_PRICE,
        // Pas de tarif de repli en euros : tant qu'il n'est pas saisi, le pack n'est
        // pas proposé hors de Madagascar. Une valeur inventée serait pire qu'aucune.
        priceEur: plan?.priceEur == null ? null : Number(plan.priceEur),
        // NULL : on annonce le nombre de cours réellement publiés.
        announcedCourseCount: plan?.announcedCourseCount ?? null,
        active: plan ? plan.active : true,
        updatedAt: plan?.updatedAt ?? null,
    }
}

/**
 * Chiffres de contexte, pour que le tarif ne soit pas fixé à l'aveugle : ce que
 * vaut le catalogue à l'unité, et ce que le pack a déjà rapporté.
 */
async function readContext() {
    const [courses, members, orders] = await Promise.all([
        prisma.course.findMany({ where: { status: "ACTIVE" }, select: { price: true, priceEur: true } }),
        prisma.user.count({ where: { plan: "PREMIUM" } }),
        prisma.orderItem.findMany({
            where: { isPremiumPack: true, order: { status: "PAID" } },
            select: { amount: true },
        }),
    ])

    const prices = courses.map((c) => Number(c.price))
    const pricesEur = courses.map((c) => (c.priceEur == null ? 0 : Number(c.priceEur)))

    return {
        courseCount: courses.length,
        premiumCourseCount: prices.filter((p) => p > 0).length,
        catalogueValue: prices.reduce((sum, price) => sum + price, 0),
        // Valeur du catalogue à l'unité pour un acheteur étranger : seuls les cours
        // réellement tarifés en euros y figurent, ce sont les seuls qu'il peut acheter.
        catalogueValueEur: pricesEur.reduce((sum, price) => sum + price, 0),
        /** Cours payants dépourvus de tarif international : autant de ventes fermées. */
        missingPriceEurCount: courses.filter((c) => Number(c.price) > 0 && c.priceEur == null).length,
        memberCount: members,
        soldCount: orders.length,
        revenue: orders.reduce((sum, item) => sum + Number(item.amount), 0),
    }
}

/** Nombre de modules annoncés : entier positif, ou rien du tout. */
function parseAnnounced(raw: unknown): { value: number | null } | { error: string } {
    if (raw === undefined || raw === null || raw === "") return { value: null }

    const value = Number(raw)
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return { error: "Le nombre de modules annoncés doit être un entier" }
    }
    // Zéro n'annonce rien : c'est une saisie à effacer, pas un programme vide.
    if (value === 0) return { value: null }
    if (value < 0 || value > MAX_ANNOUNCED) {
        return { error: `Le nombre de modules annoncés doit être compris entre 1 et ${MAX_ANNOUNCED}` }
    }

    return { value }
}

/** GET /api/premium — réglage courant du Pack Premium et chiffres de contexte. */
export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const [plan, context] = await Promise.all([readPlan(), readContext()])
        return NextResponse.json({ ...plan, ...context })
    } catch {
        return NextResponse.json({ error: "Failed to load premium plan" }, { status: 500 })
    }
}

/**
 * PUT /api/premium — fixe le tarif du pack et sa mise en vente.
 *
 * Le nouveau tarif ne vaut que pour les achats à venir : les commandes déjà réglées
 * portent leur propre montant, et les accès accordés ne sont jamais repris.
 */
export async function PUT(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const body = await request.json()
        const price = Number(body.price)
        const active = body.active === undefined ? true : Boolean(body.active)

        if (!Number.isFinite(price) || !Number.isInteger(price) || price <= 0 || price > MAX_PRICE) {
            return NextResponse.json(
                { error: `Le tarif doit être un nombre entier d'ariary, entre 1 et ${MAX_PRICE.toLocaleString("fr-FR")}` },
                { status: 400 },
            )
        }

        // Tarif international : facultatif. Vidé, il retire le pack de la vente hors
        // de Madagascar sans toucher au tarif malgache ni aux accès déjà accordés.
        const eur = parsePriceEur(body.priceEur)
        if ("error" in eur) return NextResponse.json({ error: eur.error }, { status: 400 })

        // Programme annoncé sur l'année. Vidé, le bandeau retombe sur le nombre de
        // cours publiés. Volontairement NON contraint au catalogue : c'est une
        // promesse commerciale qu'on formule avant d'avoir tout publié.
        const announced = parseAnnounced(body.announcedCourseCount)
        if ("error" in announced) return NextResponse.json({ error: announced.error }, { status: 400 })

        const plan = await prisma.premiumPlan.upsert({
            where: { id: PREMIUM_PLAN_ID },
            update: { price, priceEur: eur.value, announcedCourseCount: announced.value, active },
            create: { id: PREMIUM_PLAN_ID, price, priceEur: eur.value, announcedCourseCount: announced.value, active },
        })

        return NextResponse.json({
            price: Number(plan.price),
            priceEur: plan.priceEur == null ? null : Number(plan.priceEur),
            announcedCourseCount: plan.announcedCourseCount,
            active: plan.active,
            updatedAt: plan.updatedAt,
        })
    } catch {
        return NextResponse.json({ error: "Failed to update premium plan" }, { status: 500 })
    }
}
