"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff, User, Mail, Lock, ArrowRight } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const [isSignup, setIsSignup] = useState(false)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setSuccess("")

        try {
            if (isSignup) {
                // Register logic
                const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password }),
                })

                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.error || "Erreur lors de l'inscription")
                }

                setSuccess("Compte créé avec succès ! Vous pouvez maintenant vous connecter.")
                setIsSignup(false)
                setPassword("") // Clear password
            } else {
                // Login logic
                const res = await signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                })

                if (res?.error) {
                    setError("Email ou mot de passe incorrect")
                } else {
                    router.push("/")
                    router.refresh()
                }
            }
        } catch (error: any) {
            setError(error.message || "Une erreur est survenue")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-gray-100 p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2563EB] to-black"></div>

                <div className="text-center mb-8">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#2563EB] mb-2">Everest</div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[#050505]">
                        Admin <span className="text-gray-300">{isSignup ? "Signup" : "Login"}</span>
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                        {isSignup ? "Créer un compte administrateur" : "Accédez à votre tableau de bord"}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest p-3 mb-6 border border-red-100 text-center animate-in fade-in slide-in-from-top-1">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 text-green-600 text-[10px] font-bold uppercase tracking-widest p-3 mb-6 border border-green-100 text-center animate-in fade-in slide-in-from-top-1">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignup && (
                        <div className="animate-in fade-in slide-in-from-left-1 duration-300">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Nom complet</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-gray-50 border-none outline-none focus:ring-1 focus:ring-[#2563EB] text-sm font-bold placeholder-gray-300 transition-all"
                                    placeholder="John Doe"
                                    required={isSignup}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 bg-gray-50 border-none outline-none focus:ring-1 focus:ring-[#2563EB] text-sm font-bold placeholder-gray-300 transition-all"
                                placeholder="admin@everest.pro"
                                required
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Mot de passe</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 pl-12 pr-12 bg-gray-50 border-none outline-none focus:ring-1 focus:ring-[#2563EB] text-sm font-bold placeholder-gray-300 transition-all"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2563EB] transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2 mt-6 active:scale-[0.98]"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? (isSignup ? "Création..." : "Connexion...") : (isSignup ? "Créer mon compte" : "Se connecter")}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>

                
            </div>
        </div>
    )
}
