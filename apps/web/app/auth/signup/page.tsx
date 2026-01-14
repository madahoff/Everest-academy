"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowRight } from "lucide-react"

export default function SignupPage() {
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")

    const { register, handleSubmit } = useForm()

    const onSubmit = async (data: any) => {
        setLoading(true)
        setError("")

        try {
            // 1. Register User
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || "Erreur lors de l'inscription")
            }

            // 2. Auto Login
            const result = await signIn("credentials", {
                redirect: false,
                email: data.email,
                password: data.password,
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
        <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 font-sans">
            <div className="w-full max-w-md bg-white p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-[#050505] mb-2">Inscription</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Rejoignez l'élite académique
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nom complet</label>
                        <input
                            {...register("name", { required: true })}
                            type="text"
                            className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-medium focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email</label>
                        <input
                            {...register("email", { required: true })}
                            type="email"
                            className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-medium focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                            placeholder="votre@email.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Mot de passe</label>
                        <input
                            {...register("password", { required: true })}
                            type="password"
                            className="w-full h-12 bg-gray-50 border-none px-4 text-sm font-medium focus:ring-1 focus:ring-[#2563EB] outline-none rounded-none"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#001F3F] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Créer mon compte <ArrowRight className="w-3 h-3" /></>}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Déjà membre ?{" "}
                        <Link href="/auth/login" className="text-[#2563EB] hover:text-[#001F3F] ml-1">
                            Se connecter
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
