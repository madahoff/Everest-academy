"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"

// --- STYLES ---
const inputStyle = "w-full h-12 bg-gray-50 border-none px-4 text-sm font-medium focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none placeholder:text-gray-300"
const labelStyle = "text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block"
const btnStyle = "w-full h-12 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#001F3F] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
const socialBtnStyle = "w-full h-12 border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"

// Google Icon SVG
const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
)

export function AuthDialog({
    open,
    onOpenChange,
    defaultTab = "login"
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    defaultTab?: "login" | "signup"
}) {
    const [mode, setMode] = React.useState<"login" | "signup">(defaultTab)
    const router = useRouter()

    // Login Form State
    const { register: registerLogin, handleSubmit: handleSubmitLogin, reset: resetLogin, formState: { errors: errorsLogin } } = useForm()
    const [loginLoading, setLoginLoading] = React.useState(false)
    const [loginError, setLoginError] = React.useState("")

    // Signup Form State
    const { register: registerSignup, handleSubmit: handleSubmitSignup, reset: resetSignup, formState: { errors: errorsSignup } } = useForm()
    const [signupLoading, setSignupLoading] = React.useState(false)
    const [signupError, setSignupError] = React.useState("")

    // Google OAuth State
    const [googleLoading, setGoogleLoading] = React.useState(false)

    // Reset forms when switching modes or closing
    React.useEffect(() => {
        if (!open) {
            setMode(defaultTab)
            resetLogin()
            resetSignup()
            setLoginError("")
            setSignupError("")
        }
    }, [open, defaultTab, resetLogin, resetSignup])

    const onLogin = async (data: any) => {
        setLoginLoading(true)
        setLoginError("")
        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: data.email,
                password: data.password,
            })
            if (result?.error) {
                setLoginError("Identifiants incorrects")
            } else {
                onOpenChange(false)
                router.refresh()
            }
        } catch (e) {
            setLoginError("Erreur de connexion")
        } finally {
            setLoginLoading(false)
        }
    }

    const onSignup = async (data: any) => {
        setSignupLoading(true)
        setSignupError("")
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Erreur inscription")

            // Auto-login
            const result = await signIn("credentials", {
                redirect: false,
                email: data.email,
                password: data.password,
            })
            if (result?.error) {
                setSignupError("Compte créé, veuillez vous connecter.")
                setMode("login")
            } else {
                onOpenChange(false)
                router.refresh()
            }
        } catch (e: any) {
            setSignupError(e.message || "Erreur lors de l'inscription")
        } finally {
            setSignupLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true)
        try {
            await signIn("google", { callbackUrl: "/" })
        } catch (e) {
            setLoginError("Erreur lors de la connexion avec Google")
            setGoogleLoading(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] animate-in fade-in" />
                <Dialog.Content className="fixed left-[50%] top-[50%] z-[201] w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200 focus:outline-none">

                    <div className="absolute right-4 top-4">
                        <Dialog.Close asChild>
                            <button className="text-gray-400 hover:text-black">
                                <X className="h-4 w-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="text-center mb-6">
                        <Dialog.Title className="text-2xl font-black uppercase tracking-tighter text-[#050505] mb-2">
                            {mode === "login" ? "Connexion" : "Rejoindre"}
                        </Dialog.Title>
                        <Dialog.Description className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            {mode === "login" ? "Accédez à votre espace" : "Commencez votre ascension"}
                        </Dialog.Description>
                    </div>

                    {/* Google OAuth Button */}
                    <div className="mb-6">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={googleLoading}
                            className={socialBtnStyle}
                        >
                            {googleLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <GoogleIcon />
                                    <span>Continuer avec Google</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Separator */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                            <span className="bg-white px-4 text-gray-400 font-bold tracking-widest">ou</span>
                        </div>
                    </div>

                    {mode === "login" ? (
                        <form onSubmit={handleSubmitLogin(onLogin)} className="space-y-4">
                            {loginError && <div className="p-3 bg-red-50 text-red-500 text-[10px] font-bold uppercase text-center">{loginError}</div>}
                            <div>
                                <label className={labelStyle}>Email</label>
                                <input {...registerLogin("email", { required: true })} type="email" className={inputStyle} placeholder="votre@email.com" />
                            </div>
                            <div>
                                <label className={labelStyle}>Mot de passe</label>
                                <input {...registerLogin("password", { required: true })} type="password" className={inputStyle} placeholder="••••••••" />
                            </div>
                            <button type="submit" disabled={loginLoading} className={btnStyle}>
                                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se Connecter"}
                            </button>
                            <div className="text-center mt-4">
                                <button type="button" onClick={() => setMode("signup")} className="text-[10px] text-gray-400 hover:text-[#2563EB] uppercase tracking-widest font-bold">
                                    Créer un compte
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmitSignup(onSignup)} className="space-y-4">
                            {signupError && <div className="p-3 bg-red-50 text-red-500 text-[10px] font-bold uppercase text-center">{signupError}</div>}
                            <div>
                                <label className={labelStyle}>Nom complet</label>
                                <input {...registerSignup("name", { required: true })} className={inputStyle} placeholder="John Doe" />
                            </div>
                            <div>
                                <label className={labelStyle}>Email</label>
                                <input {...registerSignup("email", { required: true })} type="email" className={inputStyle} placeholder="votre@email.com" />
                            </div>
                            <div>
                                <label className={labelStyle}>Mot de passe</label>
                                <input {...registerSignup("password", { required: true })} type="password" className={inputStyle} placeholder="••••••••" />
                            </div>
                            <button type="submit" disabled={signupLoading} className={btnStyle}>
                                {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon Compte"}
                            </button>
                            <div className="text-center mt-4">
                                <button type="button" onClick={() => setMode("login")} className="text-[10px] text-gray-400 hover:text-[#2563EB] uppercase tracking-widest font-bold">
                                    J'ai déjà un compte
                                </button>
                            </div>
                        </form>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

