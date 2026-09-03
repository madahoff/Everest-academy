import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import {
    OCCUPYING_STATUSES,
    nextMasterclassId,
    parseMasterclassInput,
    uniqueMonthError,
} from "@/lib/masterclass"

export const dynamic = "force-dynamic"

/**
 * Sérialise une séance avec ses compteurs d'inscription.
 *
 * `isNext` désigne la séance que la vitrine annonce en ce moment. Il n'est PAS
 * stocké : il se recalcule à chaque lecture, et bascule donc tout seul le 1er du mois.
 */
function serialize(masterclass: any, nextId: string | null) {
    const registrations = masterclass.registrations ?? []
    const occupied = registrations.filter((r: any) => OCCUPYING_STATUSES.includes(r.status)).length

    return {
        id: masterclass.id,
        monthKey: masterclass.monthKey,
        title: masterclass.title,
        description: masterclass.description,
        instructor: masterclass.instructor,
        scheduledAt: masterclass.scheduledAt.toISOString(),
        duration: masterclass.duration,
        location: masterclass.location,
        coverImage: masterclass.coverImage,
        price: Number(masterclass.price),
        priceEur: masterclass.priceEur === null ? null : Number(masterclass.priceEur),
        capacity: masterclass.capacity,
        status: masterclass.status,
        createdAt: masterclass.createdAt.toISOString(),
        updatedAt: masterclass.updatedAt.toISOString(),
        isNext: masterclass.id === nextId,
        registrationCount: registrations.length,
        confirmedCount: occupied,
        pendingCount: registrations.filter((r: any) => r.status === "PENDING").length,
        seatsLeft: masterclass.capacity === null ? null : Math.max(0, masterclass.capacity - occupied),
        // Recette encaissée : seules les inscriptions dont la commande est PAYÉE.
        revenue: registrations
            .filter((r: any) => r.order?.status === "PAID")
            .reduce((sum: number, r: any) => sum + Number(r.amount), 0),
    }
}

/**
 * GET /api/masterclass — toutes les séances, de la plus proche à la plus ancienne.
 *
 * L'historique n'est jamais filtré ici : c'est précisément ce que la console doit
 * pouvoir consulter après une bascule mensuelle.
 */
export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const [masterclasses, nextId] = await Promise.all([
            prisma.masterclass.findMany({
                orderBy: { scheduledAt: "desc" },
                include: {
                    registrations: {
                        select: { status: true, amount: true, order: { select: { status: true } } },
                    },
                },
            }),
            nextMasterclassId(),
        ])

        return NextResponse.json(masterclasses.map((m) => serialize(m, nextId)))
    } catch (error) {
        console.error("Failed to fetch masterclasses:", error)
        return NextResponse.json({ error: "Failed to fetch masterclasses" }, { status: 500 })
    }
}

/** POST /api/masterclass — programme la séance d'un mois. */
export async function POST(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const parsed = parseMasterclassInput(await request.json())
        if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

        const created = await prisma.masterclass.create({ data: parsed.value })
        return NextResponse.json(serialize({ ...created, registrations: [] }, await nextMasterclassId()), {
            status: 201,
        })
    } catch (error) {
        const conflict = uniqueMonthError(error)
        if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })

        console.error("Failed to create masterclass:", error)
        return NextResponse.json({ error: "Failed to create masterclass" }, { status: 500 })
    }
}
