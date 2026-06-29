"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ArrowRight, XCircle } from "lucide-react"
import { PasswordInput } from "@/components/ui/password-input"
import { validatePassword } from "@/lib/password"

export default function ResetPasswordPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [status, setStatus] = React.useState<"checking" | "invalid" | "form">("checking")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")

    const { register, handleSubmit, watch, formState: { errors } } = useForm()
    const password = watch("password")

    React.useEffect(() => {
        if (!token) {
            setStatus("invalid")
            return
        }

        fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
            .then((res) => res.json())
            .then((data) => setStatus(data.valid ? "form" : "invalid"))
            .catch(() => setStatus("invalid"))
    }, [token])

    const onSubmit = async (data: any) => {
        setLoading(true)
        setError("")

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password: data.password, confirmPassword: data.confirmPassword }),
            })
            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || "Lien invalide ou expiré")
            }

            router.push("/auth/login?reset=success")
        } catch (error) {
            setError(error instanceof Error ? error.message : "Une erreur est survenue")
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
                        Nouveau mot de passe
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                        Choisissez un mot de passe sécurisé
                    </p>
                </div>

                {status === "checking" && (
                    <div className="py-10 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB] mx-auto" />
                    </div>
                )}

                {status === "invalid" && (
                    <div className="space-y-6 text-center">
                        <XCircle className="w-8 h-8 text-red-500 mx-auto" />
                        <p className="text-sm text-gray-500">
                            Ce lien n&apos;est plus valide. Il a peut-être expiré ou déjà été utilisé.
                        </p>
                        <Link
                            href="/auth/forgot-password"
                            className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center"
                        >
                            Demander un nouveau lien
                        </Link>
                    </div>
                )}

                {status === "form" && (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest p-3 border border-red-100 text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nouveau mot de passe</label>
                            <PasswordInput
                                {...register("password", { required: true, validate: (v) => validatePassword(v) || true })}
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="••••••••"
                            />
                            {errors.password && (
                                <p className="text-[10px] font-bold text-red-500">{String(errors.password.message)}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Confirmer le mot de passe</label>
                            <PasswordInput
                                {...register("confirmPassword", {
                                    required: true,
                                    validate: (v) => v === password || "Les mots de passe ne correspondent pas",
                                })}
                                className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-bold focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                                placeholder="••••••••"
                            />
                            {errors.confirmPassword && (
                                <p className="text-[10px] font-bold text-red-500">{String(errors.confirmPassword.message)}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Réinitialiser le mot de passe <ArrowRight className="w-3 h-3" /></>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
