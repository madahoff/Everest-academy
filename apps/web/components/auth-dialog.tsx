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
    const [step, setStep] = React.useState<"form" | "otp">("form")
    const router = useRouter()

    // Form States
    const { register, handleSubmit, reset, formState: { errors } } = useForm()
    const { register: registerOtp, handleSubmit: handleSubmitOtp } = useForm()
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")
    const [googleLoading, setGoogleLoading] = React.useState(false)
    const [formData, setFormData] = React.useState<{ name?: string; email: string; password: string } | null>(null)

    // Reset when switching or closing
    React.useEffect(() => {
        if (!open) {
            setMode(defaultTab)
            setStep("form")
            reset()
            setError("")
            setFormData(null)
        }
    }, [open, defaultTab, reset])

    // Step 1: Submit form and request OTP
    const onFormSubmit = async (data: any) => {
        setLoading(true)
        setError("")
        try {
            // Request OTP for email verification
            const otpRes = await fetch("/api/auth/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: data.email }),
            })
            if (!otpRes.ok) throw new Error("Erreur lors de l'envoi du code")

            // Store form data and go to OTP step
            setFormData(data)
            setStep("otp")
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Verify OTP and complete auth
    const onVerifyOtp = async (data: any) => {
        if (!formData) return
        setLoading(true)
        setError("")
        try {
            if (mode === "signup") {
                // Signup flow: verify OTP, then create account
                const verifyRes = await fetch("/api/auth/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: formData.email, code: data.code }),
                })
                if (!verifyRes.ok) {
                    const json = await verifyRes.json()
                    throw new Error(json.error || "Code invalide ou expiré")
                }

                // OTP verified, create account
                const signupRes = await fetch("/api/auth/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                })
                const signupJson = await signupRes.json()
                if (!signupRes.ok) throw new Error(signupJson.error || "Erreur inscription")

                // Auto login
                await signIn("credentials", {
                    redirect: false,
                    email: formData.email,
                    password: formData.password,
                })
            } else {
                // Login flow: verify OTP first
                const verifyRes = await fetch("/api/auth/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: formData.email, code: data.code }),
                })
                if (!verifyRes.ok) {
                    const json = await verifyRes.json()
                    throw new Error(json.error || "Code invalide ou expiré")
                }

                // OTP verified, now login with credentials
                const result = await signIn("credentials", {
                    redirect: false,
                    email: formData.email,
                    password: formData.password,
                })
                if (result?.error) throw new Error("Identifiants incorrects")
            }

            setFormData(null)
            onOpenChange(false)
            router.refresh()
        } catch (e: any) {
            setError(e.message || "Erreur de vérification")
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true)
        try {
            await signIn("google", { callbackUrl: "/" })
        } catch (e) {
            setError("Erreur connexion Google")
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
                            {step === "otp" ? "Vérification" : mode === "login" ? "Connexion" : "Rejoindre"}
                        </Dialog.Title>
                        <Dialog.Description className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            {step === "otp" ? "Confirmez votre email" : mode === "login" ? "Accédez à votre espace" : "Commencez votre ascension"}
                        </Dialog.Description>
                    </div>

                    <div className="space-y-4">
                        {error && <div className="p-3 bg-red-50 text-red-500 text-[10px] font-bold uppercase text-center">{error}</div>}

                        {step === "form" ? (
                            <>
                                {/* Google OAuth Button */}
                                <div className="mb-6">
                                    <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading || loading} className={socialBtnStyle}>
                                        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GoogleIcon /><span>Continuer avec Google</span></>}
                                    </button>
                                </div>

                                {/* Separator */}
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                                    <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-4 text-gray-400 font-bold tracking-widest">ou</span></div>
                                </div>

                                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                                    {mode === "signup" && (
                                        <div>
                                            <label className={labelStyle}>Nom complet</label>
                                            <input {...register("name", { required: mode === "signup" })} className={inputStyle} placeholder="John Doe" />
                                        </div>
                                    )}
                                    <div>
                                        <label className={labelStyle}>Email</label>
                                        <input {...register("email", { required: true })} type="email" className={inputStyle} placeholder="votre@email.com" />
                                    </div>
                                    <div>
                                        <label className={labelStyle}>Mot de passe</label>
                                        <input {...register("password", { required: true })} type="password" className={inputStyle} placeholder="••••••••" />
                                    </div>
                                    <button type="submit" disabled={loading} className={btnStyle}>
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuer"}
                                    </button>
                                    <div className="text-center mt-4">
                                        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-[10px] text-gray-400 hover:text-black uppercase tracking-widest font-bold">
                                            {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <form onSubmit={handleSubmitOtp(onVerifyOtp)} className="space-y-4">
                                <div className="text-center mb-4 p-4 bg-gray-50 border border-gray-100">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Code envoyé à</p>
                                    <p className="text-sm font-medium text-black mt-1">{formData?.email}</p>
                                </div>
                                <div>
                                    <label className={labelStyle}>Code à 6 chiffres</label>
                                    <input {...registerOtp("code", { required: true })} className={`${inputStyle} text-center tracking-[0.5em] text-lg`} placeholder="123456" maxLength={6} />
                                </div>
                                <button type="submit" disabled={loading} className={btnStyle}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" ? "Se Connecter" : "Créer mon Compte"}
                                </button>
                                <button type="button" onClick={() => { setStep("form"); setError(""); }} className="w-full text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-black transition-colors">
                                    Modifier les informations
                                </button>
                            </form>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
