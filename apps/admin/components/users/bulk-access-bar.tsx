"use client"

import * as React from "react"
import { Crown, Layers, Loader2, Minus, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { MultiSelect } from "@/components/ui/multi-select"
import { useCourseAccessMutation } from "@/hooks/use-course-access"
import type { DirectoryCourse, DirectoryUser } from "@/lib/user-directory"

interface BulkAccessBarProps {
    /** Membres cochés dans la liste : ce sont eux, et eux seuls, que les actions touchent. */
    selected: DirectoryUser[]
    courses: DirectoryCourse[]
    onClear: () => void
    /** Bouton d'envoi d'email, fourni par la page pour rester au même endroit que la sélection. */
    children?: React.ReactNode
}

/**
 * Actions groupées : donner ou retirer l'accès à plusieurs membres d'un coup.
 *
 * Deux gestes distincts, volontairement : cocher des cours puis « Donner » ajoute
 * sans rien défaire, « Retirer » enlève sans rien ajouter. L'édition en ligne, elle,
 * remplace la liste — ce que l'on ne veut jamais faire à cinquante comptes à la fois.
 */
export function BulkAccessBar({ selected, courses, onClear, children }: BulkAccessBarProps) {
    const [targets, setTargets] = React.useState<string[]>([])
    const mutation = useCourseAccessMutation()

    const count = selected.length
    const userIds = selected.map((u) => u.id)
    const people = `${count} membre${count > 1 ? "s" : ""}`

    const options = courses.map((course) => ({
        value: course.id,
        label: course.title,
        hint: course.status === "DRAFT" ? "Brouillon" : undefined,
    }))

    const run = (input: Parameters<typeof mutation.mutate>[0]) => {
        if (mutation.isPending) return
        mutation.mutate(input)
    }

    const grant = () => {
        if (targets.length === 0) return toast.error("Choisissez au moins un cours")
        run({ userIds, mode: "grant", courseIds: targets })
    }

    const grantAll = () => {
        if (courses.length === 0) return toast.error("Aucun cours au catalogue")
        if (!confirm(`Donner l'accès aux ${courses.length} cours du catalogue à ${people} ?`)) return
        run({ userIds, mode: "grant", courseIds: courses.map((c) => c.id) })
    }

    const revoke = () => {
        if (targets.length === 0) return toast.error("Choisissez au moins un cours")

        // Un retrait d'accès payé efface une recette : on annonce le nombre exact avant d'agir.
        const paid = selected.reduce(
            (total, user) => total + targets.filter((id) => user.paidCourseIds.includes(id)).length,
            0,
        )
        const warning = paid > 0
            ? `\n\nATTENTION : ${paid} de ces accès ${paid > 1 ? "ont" : "a"} été payé${paid > 1 ? "s" : ""}. Les retirer supprime aussi ${paid > 1 ? "ces achats" : "cet achat"} des statistiques de recette.`
            : ""

        if (!confirm(`Retirer l'accès à ${targets.length} cours pour ${people} ?${warning}`)) return
        run({ userIds, mode: "revoke", courseIds: targets })
    }

    const setPlan = (plan: "FREE" | "PREMIUM") => {
        const question = plan === "PREMIUM"
            ? `Donner le Pack Premium à ${people} ? Tout le catalogue leur sera ouvert, y compris les cours à venir.`
            : `Retirer le Pack Premium à ${people} ? Leurs accès accordés cours par cours sont conservés.`
        if (!confirm(question)) return
        run({ userIds, mode: "grant", courseIds: [], plan })
    }

    return (
        <div className="sticky top-4 z-30 mb-6 flex flex-col gap-4 border border-[#050505] bg-white p-5 shadow-[6px_6px_0_0_#2563EB] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
                <span className="bg-[#050505] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    {people} sélectionné{count > 1 ? "s" : ""}
                </span>
                <button
                    onClick={onClear}
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-[#050505]"
                >
                    <X className="h-3 w-3" /> Effacer
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <MultiSelect
                    options={options}
                    selected={targets}
                    onChange={setTargets}
                    placeholder="Cours visés"
                    title="Cours visés par l'action"
                    searchPlaceholder="Rechercher un cours..."
                    triggerClassName="min-w-[190px] py-2.5"
                    align="end"
                />

                <button
                    onClick={grant}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-[#2563EB] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                    {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Donner l&apos;accès
                </button>

                <button
                    onClick={revoke}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:border-red-500 hover:text-red-500 disabled:opacity-50"
                >
                    <Minus className="h-3 w-3" /> Retirer l&apos;accès
                </button>

                <button
                    onClick={grantAll}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:border-[#050505] disabled:opacity-50"
                    title="Ouvre les cours publiés aujourd'hui, sans le Pack Premium"
                >
                    <Layers className="h-3 w-3" /> Tout le catalogue
                </button>

                <button
                    onClick={() => setPlan("PREMIUM")}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 border border-[#2563EB] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#2563EB] transition-all hover:bg-[#2563EB] hover:text-white disabled:opacity-50"
                    title="Ouvre tout le catalogue, y compris les cours publiés plus tard"
                >
                    <Crown className="h-3 w-3" /> Premium
                </button>

                <button
                    onClick={() => setPlan("FREE")}
                    disabled={mutation.isPending}
                    className="border border-gray-200 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 transition-all hover:border-red-500 hover:text-red-500 disabled:opacity-50"
                >
                    Retirer Premium
                </button>

                {children}
            </div>
        </div>
    )
}
