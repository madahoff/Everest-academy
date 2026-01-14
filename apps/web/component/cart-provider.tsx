"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useSession } from "next-auth/react"

type CartItem = {
    id: string
    title: string
    price: number
    image?: string
    type: 'course' | 'product'
}

type CartContextType = {
    cart: CartItem[]
    addToCart: (item: CartItem) => void
    removeFromCart: (id: string) => void
    clearCart: () => void
    isLoading: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession()
    const [cart, setCart] = useState<CartItem[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Load cart from DB or LocalStorage
    useEffect(() => {
        if (session?.user) {
            // Fetch from DB
            setIsLoading(true)
            fetch('/api/cart')
                .then(res => res.json())
                .then(data => setCart(data))
                .catch(err => console.error(err))
                .finally(() => setIsLoading(false))
        } else {
            // Load from LocalStorage
            const localCart = localStorage.getItem('everest_cart')
            if (localCart) setCart(JSON.parse(localCart))
        }
    }, [session])

    const addToCart = async (item: CartItem) => {
        // Optimistic update
        const newCart = [...cart, item]
        setCart(newCart)

        if (session?.user) {
            // Sync with DB
            await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, type: item.type })
            })
        } else {
            localStorage.setItem('everest_cart', JSON.stringify(newCart))
        }
    }

    const removeFromCart = async (id: string) => {
        const newCart = cart.filter(item => item.id !== id)
        setCart(newCart)

        if (session?.user) {
            await fetch(`/api/cart?id=${id}`, { method: 'DELETE' })
        } else {
            localStorage.setItem('everest_cart', JSON.stringify(newCart))
        }
    }

    const clearCart = () => {
        setCart([])
        if (!session?.user) {
            localStorage.removeItem('everest_cart')
        }
        // If session, we'd need a clear API or loop delete. For now assumes checkout clears it.
    }

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isLoading }}>
            {children}
        </CartContext.Provider>
    )
}

export const useCart = () => {
    const context = useContext(CartContext)
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider")
    }
    return context
}
