import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface AccessMutationInput {
    userIds: string[]
    /**
     * `set` : la liste devient exactement la liste des accès (édition d'une ligne) ;
     * `grant` / `revoke` : ajout ou retrait, sans toucher au reste (actions groupées).
     */
    mode: "set" | "grant" | "revoke"
    courseIds: string[]
    /** Pack Premium — ouvre tout le catalogue, y compris les cours à venir. */
    plan?: "FREE" | "PREMIUM"
    /** Phrase de confirmation affichée en cas de succès, à la place du décompte. */
    successMessage?: string
}

export interface AccessMutationResult {
    granted: number
    revoked: number
    paidRevoked: number
    planChanged: number
}

/**
 * Écrit les accès aux cours d'un ou plusieurs comptes.
 *
 * Une seule route pour l'édition en ligne et pour les actions groupées : l'annuaire
 * n'a ainsi qu'un seul chemin d'écriture à invalider, et le décompte renvoyé sert de
 * quittance — dont `paidRevoked`, qui signale une recette effacée des statistiques.
 */
export function useCourseAccessMutation() {
    const queryClient = useQueryClient()

    return useMutation<AccessMutationResult, Error, AccessMutationInput>({
        mutationFn: async ({ userIds, mode, courseIds, plan }) => {
            const res = await fetch("/api/users/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIds, mode, courseIds, plan }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || data.error || "Échec de la mise à jour des accès")
            return data
        },
        onSuccess: (result, variables) => {
            const parts: string[] = []
            if (result.granted > 0) parts.push(`${result.granted} accès accordé${result.granted > 1 ? "s" : ""}`)
            if (result.revoked > 0) parts.push(`${result.revoked} accès retiré${result.revoked > 1 ? "s" : ""}`)
            if (result.planChanged > 0) {
                parts.push(
                    variables.plan === "PREMIUM"
                        ? `${result.planChanged} passage${result.planChanged > 1 ? "s" : ""} en Premium`
                        : `${result.planChanged} retrait${result.planChanged > 1 ? "s" : ""} du Premium`,
                )
            }

            toast.success(variables.successMessage || (parts.length > 0 ? parts.join(" · ") : "Aucun changement"))

            if (result.paidRevoked > 0) {
                toast.warning(
                    `${result.paidRevoked} accès payé${result.paidRevoked > 1 ? "s ont" : " a"} été retiré${result.paidRevoked > 1 ? "s" : ""} : la recette correspondante disparaît des statistiques.`,
                )
            }

            // Les cours affichent le nombre d'inscrits et leur recette : ces deux vues
            // viennent de bouger.
            queryClient.invalidateQueries({ queryKey: ["users"] })
            queryClient.invalidateQueries({ queryKey: ["courses"] })
            queryClient.invalidateQueries({ queryKey: ["stats"] })
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })
}
