import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"

/** Ligne unique de réglage : le tarif du pack n'est pas un catalogue. */
const PREMIUM_PLAN_ID = "default"

/** Tarif de repli, si la ligne n'a jamais été écrite. */
const DEFAULT_PRICE = 199_000

/**
 * Le Wallet API n'accepte que des montants entiers d'ariary : un tarif à virgule
 * ferait échouer le paiement au moment du débit, pas ici. On refuse donc en amont.
 */
const MAX_PRICE = 100_000_000

async function readPlan() {
    const plan = await prisma.premiumPlan.findUnique({ where: { id: PREMIUM_PLAN_ID } })
    return {
        price: plan ? Number(plan.price) : DEFAULT_PRICE,
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
        prisma.course.findMany({ where: { status: "ACTIVE" }, select: { price: true } }),
        prisma.user.count({ where: { plan: "PREMIUM" } }),
        prisma.orderItem.findMany({
            where: { isPremiumPack: true, order: { status: "PAID" } },
            select: { amount: true },
        }),
    ])

    const prices = courses.map((c) => Number(c.price))

    return {
        courseCount: courses.length,
        premiumCourseCount: prices.filter((p) => p > 0).length,
        catalogueValue: prices.reduce((sum, price) => sum + price, 0),
        memberCount: members,
        soldCount: orders.length,
        revenue: orders.reduce((sum, item) => sum + Number(item.amount), 0),
    }
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

        const plan = await prisma.premiumPlan.upsert({
            where: { id: PREMIUM_PLAN_ID },
            update: { price, active },
            create: { id: PREMIUM_PLAN_ID, price, active },
        })

        return NextResponse.json({
            price: Number(plan.price),
            active: plan.active,
            updatedAt: plan.updatedAt,
        })
    } catch {
        return NextResponse.json({ error: "Failed to update premium plan" }, { status: 500 })
    }
}
