"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ArrowRight } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")

    const { register, handleSubmit } = useForm()
    const callbackUrl = searchParams.get("callbackUrl") || "/"

    const onSubmit = async (data: any) => {
        setLoading(true)
        setError("")

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: data.email,
                password: data.password,
            })

            if (result?.error) {
                setError("Email ou mot de passe incorrect")
            } else {
                router.push(callbackUrl)
                router.refresh()
            }
        } catch (error) {
            setError("Une erreur est survenue")
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
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[#050505]">Connexion</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                        Accédez à votre espace membre
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest p-3 border border-red-100 text-center">
                            {error}
                        </div>
                    )}

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
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Se connecter <ArrowRight className="w-3 h-3" /></>}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Pas encore de compte ?{" "}
                        <Link href="/auth/signup" className="text-[#2563EB] hover:text-[#050505] ml-1 transition-colors">
                            Créer un compte
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
