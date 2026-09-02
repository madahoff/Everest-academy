/**
 * Ce que la console a le droit de LIRE et d'ÉCRIRE sur un compte.
 *
 * Deux listes explicites plutôt qu'un objet Prisma nu : `findMany()` sans `select`
 * renvoie la ligne entière, hachage de mot de passe compris, et `update({ data: body })`
 * écrit n'importe quel champ que l'appelant a bien voulu mettre dans son corps de requête.
 */

/** Champs renvoyés par l'API. `password` et `passwordChangedAt` en sont exclus. */
export const USER_SELECT = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    role: true,
    plan: true,
    status: true,
    walletBalance: true,
    walletId: true,
    createdAt: true,
    updatedAt: true,
} as const

const ROLES = ["ADMIN", "INSTRUCTOR", "STUDENT"] as const
const PLANS = ["FREE", "PREMIUM"] as const
const STATUSES = ["ACTIVE", "INACTIVE"] as const

/**
 * Champs modifiables par un administrateur, et valeurs admises.
 *
 * Sont délibérément ABSENTS :
 *  - `email` — c'est l'identité du portefeuille dans la caisse partagée avec Viktoo
 *    (`ext:<email>`). Le réécrire donnerait accès au solde d'un tiers. C'est la faille
 *    qui rendait cette route critique.
 *  - `password` / `passwordChangedAt` — un administrateur n'usurpe pas une session.
 *  - `walletBalance` / `walletId` — le solde n'a aucune autorité ici, il est recopié
 *    depuis le Wallet API ; l'écrire ne créerait qu'un affichage mensonger.
 *  - `id`, `createdAt`, `updatedAt`, `emailVerified` — non modifiables par principe.
 */
export const EDITABLE_USER_FIELDS = {
    name: (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined),
    role: (v: unknown) => (ROLES.includes(v as never) ? (v as string) : undefined),
    plan: (v: unknown) => (PLANS.includes(v as never) ? (v as string) : undefined),
    status: (v: unknown) => (STATUSES.includes(v as never) ? (v as string) : undefined),
} as const

/**
 * Extrait du corps reçu les seuls champs autorisés et valides.
 * Retourne `null` si un champ présent porte une valeur refusée — mieux vaut un 400 franc
 * qu'une mise à jour silencieusement amputée.
 */
export function pickUserUpdate(body: unknown): Record<string, string> | null {
    if (typeof body !== "object" || body === null) return null

    const source = body as Record<string, unknown>
    const data: Record<string, string> = {}

    for (const [field, normalize] of Object.entries(EDITABLE_USER_FIELDS)) {
        if (!(field in source)) continue
        const value = normalize(source[field])
        if (value === undefined) return null
        data[field] = value
    }

    return data
}
