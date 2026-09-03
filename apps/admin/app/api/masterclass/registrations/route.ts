import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { nextMasterclassId } from "@/lib/masterclass"

export const dynamic = "force-dynamic"

/**
 * GET /api/masterclass/registrations — inscriptions, filtrées par séance.
 *
 * `scope` :
 *  - `next` (défaut) — « Inscrits à la prochaine Masterclass », la séance annoncée
 *    en ce moment sur la vitrine. Recalculée à chaque appel : le 1er du mois, ce
 *    filtre désigne la nouvelle session sans qu'aucune tâche ne soit passée dessus ;
 *  - `all`  — tout l'historique, toutes séances confondues ;
 *  - un identifiant de séance — une session précise, y compris passée.
 *
 * Le filtrage par STATUT est laissé au client : la liste tient en mémoire et
 * l'interface doit pouvoir afficher les compteurs de chaque statut sans rappel.
 */
export async function GET(request: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    const scope = new URL(request.url).searchParams.get("scope") || "next"

    try {
        let masterclassId: string | null = null

        if (scope === "next") {
            masterclassId = await nextMasterclassId()
            // Aucune séance à venir : la liste est vide, et l'interface le dit. Retourner
            // tout l'historique ici ferait passer d'anciens inscrits pour des inscrits
            // à la prochaine séance.
            if (!masterclassId) return NextResponse.json({ scope, masterclassId: null, registrations: [] })
        } else if (scope !== "all") {
            masterclassId = scope
        }

        const registrations = await prisma.masterclassRegistration.findMany({
            where: masterclassId ? { masterclassId } : {},
            orderBy: { registeredAt: "desc" },
            include: {
                user: { select: { id: true, name: true, email: true } },
                masterclass: { select: { id: true, title: true, monthKey: true, scheduledAt: true } },
                order: { select: { id: true, status: true, method: true, amount: true, currency: true, paidAt: true } },
            },
        })

        return NextResponse.json({
            scope,
            masterclassId,
            registrations: registrations.map((registration) => {
                // Le nom complet est stocké en un seul champ (`users.name`). La console
                // affiche « Nom » et « Prénom » séparément : on coupe au premier espace,
                // le premier mot étant le prénom tel que les comptes sont saisis.
                const fullName = registration.user.name || ""
                const [firstName, ...rest] = fullName.split(" ").filter(Boolean)

                return {
                    id: registration.id,
                    status: registration.status,
                    amount: Number(registration.amount),
                    currency: registration.currency,
                    registeredAt: registration.registeredAt.toISOString(),
                    confirmedAt: registration.confirmedAt?.toISOString() ?? null,
                    cancelledAt: registration.cancelledAt?.toISOString() ?? null,
                    confirmationEmailSentAt: registration.confirmationEmailSentAt?.toISOString() ?? null,
                    confirmationEmailError: registration.confirmationEmailError,
                    user: {
                        id: registration.user.id,
                        fullName,
                        firstName: firstName ?? "",
                        lastName: rest.join(" "),
                        email: registration.user.email,
                    },
                    masterclass: {
                        id: registration.masterclass.id,
                        title: registration.masterclass.title,
                        monthKey: registration.masterclass.monthKey,
                        scheduledAt: registration.masterclass.scheduledAt.toISOString(),
                    },
                    // Le statut du PAIEMENT vit sur la commande, jamais sur l'inscription.
                    // Sans commande : séance offerte, ou paiement jamais ouvert.
                    payment: registration.order
                        ? {
                              orderId: registration.order.id,
                              status: registration.order.status,
                              method: registration.order.method,
                              amount: Number(registration.order.amount),
                              currency: registration.order.currency,
                              paidAt: registration.order.paidAt?.toISOString() ?? null,
                          }
                        : null,
                }
            }),
        })
    } catch (error) {
        console.error("Failed to fetch masterclass registrations:", error)
        return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 })
    }
}
