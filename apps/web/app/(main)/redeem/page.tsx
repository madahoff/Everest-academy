"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Ticket, ArrowRight, CheckCircle, XCircle, Loader2, ArrowLeft, Sparkles } from "lucide-react"

export default function RedeemCodePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<{ courseTitle: string; courseId: string } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (!code.trim()) {
            setError("Veuillez entrer un code d'accès")
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: code.trim() })
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Une erreur est survenue")
            } else {
                setSuccess({ courseTitle: data.courseTitle, courseId: data.courseId })
            }
        } catch (err) {
            setError("Erreur de connexion au serveur")
        } finally {
            setLoading(false)
        }
    }

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
            </div>
        )
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-6">
                <div className="max-w-md w-full text-center">
                    <Ticket className="w-16 h-16 mx-auto mb-6 text-gray-200" />
                    <h1 className="text-2xl font-bold uppercase tracking-tight mb-4">Connexion requise</h1>
                    <p className="text-gray-500 mb-8">Connectez-vous pour utiliser votre code d'accès</p>
                    <Link
                        href="/auth/login"
                        className="inline-block px-8 py-4 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all"
                    >
                        Se connecter
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] font-sans text-[#050505] selection:bg-[#001F3F] selection:text-white">

            {/* Header */}
            <nav className="border-b border-gray-100 px-8 py-4 bg-white">
                <Link
                    href="/courses"
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#001F3F] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour aux formations
                </Link>
            </nav>

            <main className="max-w-xl mx-auto px-6 py-20">

                {success ? (
                    // Success State
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-8 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                        <h1 className="text-3xl font-bold uppercase tracking-tighter mb-4">Accès activé !</h1>
                        <p className="text-gray-500 mb-8">
                            Vous avez maintenant accès au cours <span className="font-bold text-[#050505]">"{success.courseTitle}"</span>
                        </p>
                        <button
                            onClick={() => router.push(`/courses/${success.courseId}`)}
                            className="inline-flex items-center gap-3 px-10 py-5 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all"
                        >
                            Commencer la formation <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    // Form State
                    <>
                        <div className="text-center mb-12">
                            <div className="w-20 h-20 mx-auto mb-6 bg-[#050505] flex items-center justify-center">
                                <Ticket className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="text-4xl font-bold uppercase tracking-tighter mb-4">Utiliser un code</h1>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                Entrez votre code d'accès pour débloquer instantanément une formation
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                    Code d'accès
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="EVEREST-XXXX-XXXX"
                                    className="w-full h-16 px-6 text-center text-xl font-mono font-bold tracking-widest border-2 border-gray-200 focus:border-[#2563EB] focus:outline-none transition-colors bg-white"
                                    autoComplete="off"
                                    maxLength={17}
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100">
                                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !code.trim()}
                                className="w-full h-14 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Validation...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" /> Activer mon accès
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Vous n'avez pas de code ?</p>
                            <Link
                                href="/courses"
                                className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest hover:underline"
                            >
                                Découvrir nos formations
                            </Link>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
