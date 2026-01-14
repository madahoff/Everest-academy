"use client"

import { SessionProvider } from "next-auth/react"
import { CartProvider } from "@/component/cart-provider"
import { AuthModalProvider } from "@/component/auth-modal-provider"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthModalProvider>
                <CartProvider>
                    {children}
                </CartProvider>
            </AuthModalProvider>
        </SessionProvider>
    )
}
