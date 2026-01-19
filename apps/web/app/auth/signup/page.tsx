"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ArrowRight } from "lucide-react"

export default function SignupPage() {
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")
    const [step, setStep] = React.useState<"form" | "otp">("form")
    const [formData, setFormData] = React.useState<{ name: string; email: string; password: string } | null>(null)

    const { register, handleSubmit } = useForm()
    const { register: registerOtp, handleSubmit: handleSubmitOtp } = useForm()

    const onSubmitForm = async (data: any) => {
        setLoading(true)
        setError("")

        try {
            // 1. Request OTP for email verification
            const otpRes = await fetch("/api/auth/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: data.email }),
            })

            if (!otpRes.ok) {
                throw new Error("Erreur lors de l'envoi du code de vérification")
            }

            // Store form data for later use
            setFormData({ name: data.name, email: data.email, password: data.password })
            setStep("otp")
        } catch (error) {
            setError(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    const onVerifyOtp = async (data: any) => {
        if (!formData) return
        setLoading(true)
        setError("")

        try {
            // 1. Verify OTP first
            const verifyRes = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.email, code: data.code }),
            })

            if (!verifyRes.ok) {
                const json = await verifyRes.json()
                throw new Error(json.error || "Code invalide ou expiré")
            }

            // 2. OTP verified, now create the account
            const signupRes = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const signupJson = await signupRes.json()

            if (!signupRes.ok) {
                throw new Error(signupJson.error || "Erreur lors de l'inscription")
            }

            // 3. Auto Login
            const result = await signIn("credentials", {
                redirect: false,
                email: formData.email,
                password: formData.password,
            })

            if (result?.error) {
                setError("Compte créé mais échec de connexion automatique")
            } else {
                router.push("/")
                router.refresh()
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white border border-gray-100 p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2563EB] to-black"></div>

                <div className="text-center mb-8">
                    <Image
                        src="/logo-white.png"
                        alt="Everest Academy"
                        width={140}
                        height={45}
                        className="h-11 w-auto object-contain mx-auto mb-3"
                    />
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[#050505]">
                        {step === "form" ? "Inscription" : "Vérification"}
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                        {step === "form" ? "Rejoignez l'élite académique" : "Confirmez votre email"}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest p-3 border border-red-100 text-center mb-6">
                        {error}
                    </div>
                )}

                {step === "form" ? (
                    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nom complet</label>
                            <input
                                {...register("name", { required: true })}
                                type="text"
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Email</label>
                            <input
                                {...register("email", { required: true })}
                                type="email"
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="votre@email.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Mot de passe</label>
                            <input
                                {...register("password", { required: true })}
                                type="password"
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuer <ArrowRight className="w-3 h-3" /></>}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmitOtp(onVerifyOtp)} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-center p-4 bg-gray-50 border border-gray-100 mb-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Code envoyé à</p>
                            <p className="text-sm font-medium text-black mt-1">{formData?.email}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Code de vérification</label>
                            <input
                                {...registerOtp("code", { required: true })}
                                type="text"
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none text-center tracking-[0.5em] text-lg"
                                placeholder="123456"
                                maxLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Créer mon compte <ArrowRight className="w-3 h-3" /></>}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStep("form"); setError(""); }}
                            className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                        >
                            Modifier les informations
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center pt-6 border-t border-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Déjà membre ?{" "}
                        <Link href="/auth/login" className="text-[#2563EB] hover:text-[#050505] ml-1 transition-colors">
                            Se connecter
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

