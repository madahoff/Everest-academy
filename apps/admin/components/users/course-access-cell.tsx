"use client"

import { Crown, Loader2, BookOpen } from "lucide-react"

import { MultiSelect } from "@/components/ui/multi-select"
import { useCourseAccessMutation } from "@/hooks/use-course-access"
import { accessCount, type DirectoryCourse, type DirectoryUser } from "@/lib/user-directory"

interface CourseAccessCellProps {
    user: DirectoryUser
    courses: DirectoryCourse[]
}

/**
 * Édition des accès d'un membre, directement dans la liste : une liste à cocher des
 * cours, et au-dessus le Pack Premium — qui ouvre tout le catalogue, présent ET à
 * venir, là où cocher tous les cours n'ouvre que ceux d'aujourd'hui.
 *
 * Chaque clic écrit : il n'y a pas de brouillon à valider, l'annuaire montre toujours
 * l'état réel des accès.
 */
export function CourseAccessCell({ user, courses }: CourseAccessCellProps) {
    const mutation = useCourseAccessMutation()
    const isPremium = user.plan === "PREMIUM"
    const count = accessCount(user, courses)

    const options = courses.map((course) => ({
        value: course.id,
        label: course.title,
        hint: course.status === "DRAFT" ? "Brouillon" : undefined,
    }))

    /** Retirer un accès payé efface une recette : on ne le fait jamais sans un accord explicite. */
    const confirmRemoval = (courseId: string) => {
        if (!user.paidCourseIds.includes(courseId)) return true
        const title = courses.find((c) => c.id === courseId)?.title ?? "ce cours"
        return confirm(
            `${user.name} a PAYÉ l'accès à « ${title} ».\n\n` +
            `Le retirer supprime aussi cet achat : la recette correspondante disparaîtra des statistiques.\n\nContinuer ?`,
        )
    }

    const handleChange = (courseIds: string[]) => {
        mutation.mutate({ userIds: [user.id], mode: "set", courseIds })
    }

    const togglePremium = () => {
        const next = isPremium ? "FREE" : "PREMIUM"
        if (
            next === "FREE" &&
            !confirm(`Retirer le Pack Premium à ${user.name} ?\n\nSes accès accordés cours par cours sont conservés.`)
        ) {
            return
        }
        mutation.mutate({
            userIds: [user.id],
            mode: "grant",
            courseIds: [],
            plan: next,
            successMessage: next === "PREMIUM" ? `${user.name} passe en Premium` : `Premium retiré à ${user.name}`,
        })
    }

    return (
        <MultiSelect
            options={options}
            selected={user.courseIds}
            onChange={handleChange}
            onBeforeDeselect={confirmRemoval}
            placeholder="Accès"
            title={`Accès de ${user.name}`}
            searchPlaceholder="Rechercher un cours..."
            disabled={mutation.isPending}
            triggerClassName="w-full min-w-[190px] px-3 py-2"
            header={
                <button
                    type="button"
                    onClick={togglePremium}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isPremium ? "bg-[#2563EB]/5 hover:bg-[#2563EB]/10" : "hover:bg-gray-50"
                        }`}
                >
                    <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${isPremium ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-gray-300"
                            }`}
                    >
                        {isPremium && <Crown className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#050505]">
                            Pack Premium
                        </span>
                        <span className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">
                            Tout le catalogue, y compris à venir
                        </span>
                    </span>
                </button>
            }
            footer={
                isPremium ? (
                    <p className="px-4 py-3 text-[9px] font-bold uppercase leading-relaxed tracking-widest text-gray-400">
                        Le Pack Premium ouvre déjà tous les cours. Les cases ci-dessus ne servent qu&apos;aux accès
                        conservés s&apos;il est retiré.
                    </p>
                ) : undefined
            }
            renderTrigger={() => (
                <span className="flex items-center gap-2 truncate">
                    {mutation.isPending ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#2563EB]" />
                    ) : isPremium ? (
                        <Crown className="h-3 w-3 shrink-0 text-[#2563EB]" />
                    ) : (
                        <BookOpen className="h-3 w-3 shrink-0 text-gray-300" />
                    )}
                    {isPremium ? (
                        <span className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-[#2563EB]">
                            Tout le catalogue
                        </span>
                    ) : count === 0 ? (
                        <span className="truncate text-[9px] font-bold uppercase tracking-[0.15em] text-gray-300">
                            Aucun accès
                        </span>
                    ) : (
                        <span className="truncate text-[9px] font-black uppercase tracking-[0.15em]">
                            {count} / {courses.length} cours
                        </span>
                    )}
                </span>
            )}
        />
    )
}
