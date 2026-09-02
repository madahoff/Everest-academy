"use client"

import { SessionProvider } from "next-auth/react"
import { CartProvider } from "@/component/cart-provider"
import { AuthModalProvider } from "@/component/auth-modal-provider"
import { CurrencyProvider } from "@/component/currency-provider"
import type { Currency } from "@/lib/pricing"

export function Providers({ currency, children }: { currency: Currency; children: React.ReactNode }) {
    return (
        <SessionProvider>
            <CurrencyProvider currency={currency}>
                <AuthModalProvider>
                    <CartProvider>
                        {children}
                    </CartProvider>
                </AuthModalProvider>
            </CurrencyProvider>
        </SessionProvider>
    )
}
