"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ArrowRight, MailCheck } from "lucide-react"
import { PasswordInput } from "@/components/ui/password-input"
import { validatePassword } from "@/lib/password"

const RESEND_COOLDOWN_SECONDS = 60

export default function SignupPage() {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")
    const [step, setStep] = React.useState<"form" | "sent">("form")
    const [formData, setFormData] = React.useState<{ name: string; email: string; password: string } | null>(null)
    const [cooldown, setCooldown] = React.useState(0)

    const { register, handleSubmit, formState: { errors } } = useForm()

    React.useEffect(() => {
        if (cooldown <= 0) return
        const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
        return () => clearInterval(timer)
    }, [cooldown])

    const requestLink = async (data: { name: string; email: string; password: string }) => {
        const res = await fetch("/api/auth/request-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purpose: "SIGNUP", ...data }),
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
            await requestLink({ name: data.name, email: data.email, password: data.password })
            setFormData({ name: data.name, email: data.email, password: data.password })
            setStep("sent")
            setCooldown(RESEND_COOLDOWN_SECONDS)
        } catch (error) {
            setError(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    const onResend = async () => {
        if (!formData || cooldown > 0) return
        setLoading(true)
        setError("")

        try {
            await requestLink(formData)
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
                        {step === "form" ? "Inscription" : "Vérifiez vos e-mails"}
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
                            <PasswordInput
                                {...register("password", { required: true, validate: (v) => validatePassword(v) || true })}
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="••••••••"
                            />
                            {errors.password && (
                                <p className="text-[10px] font-bold text-red-500">{String(errors.password.message)}</p>
                            )}
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
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 text-center">
                        <MailCheck className="w-10 h-10 text-[#2563EB] mx-auto" />
                        <div className="p-4 bg-gray-50 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Lien envoyé à</p>
                            <p className="text-sm font-medium text-black mt-1">{formData?.email}</p>
                        </div>
                        <p className="text-sm text-gray-500">
                            Cliquez sur le bouton dans cet e-mail pour activer votre compte et vous connecter automatiquement.
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

