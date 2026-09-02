"use client"

import { createContext, useContext } from "react"
import { HOME_CURRENCY, type Currency } from "@/lib/pricing"

/**
 * Devise du visiteur, mise à disposition de tout l'arbre client.
 *
 * La valeur est résolue UNE FOIS côté serveur, dans le layout racine, à partir du
 * pays déterminé par le middleware. Elle ne change pas au cours d'une navigation :
 * il n'y a donc ni état, ni effet, ni requête — juste une constante descendue dans
 * un contexte, pour que les composants client cessent d'écrire « Ar » en dur.
 *
 * Elle ne fait AUCUNE autorité sur les montants facturés : chaque route de paiement
 * relit la devise depuis la requête (`lib/request-currency.ts`).
 */
const CurrencyContext = createContext<Currency>(HOME_CURRENCY)

export function CurrencyProvider({ currency, children }: { currency: Currency; children: React.ReactNode }) {
    return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): Currency {
    return useContext(CurrencyContext)
}
