"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ArrowRight, MailCheck } from "lucide-react"

const RESEND_COOLDOWN_SECONDS = 60

export default function ForgotPasswordPage() {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")
    const [step, setStep] = React.useState<"form" | "sent">("form")
    const [email, setEmail] = React.useState("")
    const [cooldown, setCooldown] = React.useState(0)

    const { register, handleSubmit } = useForm()

    React.useEffect(() => {
        if (cooldown <= 0) return
        const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
        return () => clearInterval(timer)
    }, [cooldown])

    const requestReset = async (targetEmail: string) => {
        const res = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail }),
        })

        if (!res.ok) {
            const json = await res.json()
            throw new Error(json.error || "Erreur lors de l'envoi du lien")
        }
    }

    const onSubmitForm = async (data: any) => {
        setLoading(true)
        setError("")

        try {
            await requestReset(data.email)
            setEmail(data.email)
            setStep("sent")
            setCooldown(RESEND_COOLDOWN_SECONDS)
        } catch (error) {
            setError(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    const onResend = async () => {
        if (!email || cooldown > 0) return
        setLoading(true)
        setError("")

        try {
            await requestReset(email)
            setCooldown(RESEND_COOLDOWN_SECONDS)
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
                        {step === "form" ? "Mot de passe oublié" : "Vérifiez vos e-mails"}
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                        {step === "form" ? "Saisissez votre adresse e-mail" : "Lien de réinitialisation envoyé"}
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
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Email</label>
                            <input
                                {...register("email", { required: true })}
                                type="email"
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="votre@email.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Envoyer le lien <ArrowRight className="w-3 h-3" /></>}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 text-center">
                        <MailCheck className="w-10 h-10 text-[#2563EB] mx-auto" />
                        <p className="text-sm text-gray-500">
                            Si un compte existe avec cette adresse, un e-mail contenant un lien de réinitialisation vient d&apos;être envoyé.
                        </p>

                        <button
                            type="button"
                            onClick={onResend}
                            disabled={loading || cooldown > 0}
                            className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : cooldown > 0 ? `Renvoyer le lien (${cooldown}s)` : "Renvoyer le lien"}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStep("form"); setError(""); }}
                            className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                        >
                            Modifier l&apos;adresse e-mail
                        </button>
                    </div>
                )}

                <div className="mt-8 text-center pt-6 border-t border-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        <Link href="/auth/login" className="text-[#2563EB] hover:text-[#050505] transition-colors">
                            Retour à la connexion
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
