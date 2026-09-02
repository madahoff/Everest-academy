/**
 * Tarification internationale, côté console d'administration.
 *
 * Chaque article vendable porte deux tarifs indépendants : `price` en ariary, pour
 * Madagascar, et `priceEur` en euros, pour tout le reste. Aucun taux de change
 * n'intervient — c'est une décision commerciale saisie à la main, pas une conversion.
 * Une colonne `priceEur` laissée vide signifie « pas vendu hors de Madagascar », et
 * la vitrine le dit alors explicitement au visiteur étranger.
 */

/**
 * Plafond de saisie. Aussi arbitraire que celui de l'ariary, et pour la même raison :
 * une valeur manifestement hors de propos est une faute de frappe, pas un tarif.
 */
export const MAX_PRICE_EUR = 100_000

/**
 * Valide un tarif en euros saisi depuis la console.
 *
 * ENTIERS SEULEMENT. Le Wallet API transmet le montant tel quel à Vanilla Pay avec
 * `devise: EUR`, et applique son taux EUR→MGA sur ce même nombre : un tarif en
 * centimes y serait lu comme des euros. Un « 39,90 € » accepté ici échouerait donc
 * au moment du paiement, ou pire, encaisserait un montant faux — on refuse en amont.
 *
 * Une valeur absente, vide ou nulle vaut « pas de tarif international » et remet la
 * colonne à NULL : retirer un cours de la vente à l'étranger doit rester possible.
 */
export function parsePriceEur(raw: unknown): { value: number | null } | { error: string } {
    if (raw === undefined || raw === null || raw === "") return { value: null }

    const value = Number(raw)

    if (!Number.isFinite(value)) {
        return { error: "Le prix en euros doit être un nombre" }
    }
    // Zéro n'est pas la gratuité : la gratuité se décide sur le tarif en ariary, qui
    // fait référence. Ici, zéro ne peut être qu'une saisie à effacer.
    if (value === 0) return { value: null }
    if (value < 0) {
        return { error: "Le prix en euros ne peut pas être négatif" }
    }
    if (!Number.isInteger(value)) {
        return {
            error: "Le prix en euros doit être un nombre entier : le service de paiement ne transporte pas les centimes",
        }
    }
    if (value > MAX_PRICE_EUR) {
        return { error: `Le prix en euros ne peut pas dépasser ${MAX_PRICE_EUR.toLocaleString("fr-FR")} €` }
    }

    return { value }
}

/** Montant en ariary, tel qu'affiché dans la console. */
export function formatAr(value: number | string | null | undefined): string {
    const amount = Number(value ?? 0)
    return `${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-FR")} Ar`
}

/**
 * Montant en euros. `null` est rendu explicitement : un tarif international absent
 * doit se voir dans les listes, c'est ce qui pousse à le renseigner.
 */
export function formatEur(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "€ —"
    const amount = Number(value)
    if (!Number.isFinite(amount)) return "€ —"
    return `${Math.round(amount).toLocaleString("fr-FR")} €`
}

/** Le tarif international est-il renseigné ? */
export function hasPriceEur(value: number | string | null | undefined): boolean {
    if (value === null || value === undefined || value === "") return false
    const amount = Number(value)
    return Number.isFinite(amount) && amount > 0
}
