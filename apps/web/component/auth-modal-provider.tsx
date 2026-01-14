"use client"

import React, { createContext, useContext, useState } from "react"
import { AuthDialog } from "@/components/auth-dialog"

type AuthModalContextType = {
    openAuth: (tab?: "login" | "signup") => void
    closeAuth: () => void
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined)

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [tab, setTab] = useState<"login" | "signup">("login")

    const openAuth = (defaultTab: "login" | "signup" = "login") => {
        setTab(defaultTab)
        setIsOpen(true)
    }

    const closeAuth = () => setIsOpen(false)

    return (
        <AuthModalContext.Provider value={{ openAuth, closeAuth }}>
            <AuthDialog open={isOpen} onOpenChange={setIsOpen} defaultTab={tab} />
            {children}
        </AuthModalContext.Provider>
    )
}

export const useAuthModal = () => {
    const context = useContext(AuthModalContext)
    if (context === undefined) {
        throw new Error("useAuthModal must be used within a AuthModalProvider")
    }
    return context
}
