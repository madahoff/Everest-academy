"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

export default function VerifyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = React.useState<"verifying" | "success" | "error">("verifying")

    const token = searchParams.get("token")
    const callbackUrl = searchParams.get("callbackUrl") || "/"

    React.useEffect(() => {
        if (!token) {
            setStatus("error")
            return
        }

        let cancelled = false

        signIn("magic-link", { token, redirect: false })
            .then((result) => {
                if (cancelled) return
                if (result?.error) {
                    setStatus("error")
                } else {
                    setStatus("success")
                    router.push(callbackUrl)
                    router.refresh()
                }
            })
            .catch(() => {
                if (!cancelled) setStatus("error")
            })

        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white border border-gray-100 p-8 shadow-xl relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2563EB] to-black"></div>

                <Image
                    src="/logo-white.png"
                    alt="Everest Academy"
                    width={140}
                    height={45}
                    className="h-11 w-auto object-contain mx-auto mb-6"
                />

                {status === "verifying" && (
                    <div className="space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB] mx-auto" />
                        <h1 className="text-xl font-black uppercase tracking-tighter text-[#050505]">
                            Vérification en cours
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Merci de patienter quelques instants...
                        </p>
                    </div>
                )}

                {status === "success" && (
                    <div className="space-y-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                        <h1 className="text-xl font-black uppercase tracking-tighter text-[#050505]">
                            Vérifié avec succès
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Redirection en cours...
                        </p>
                    </div>
                )}

                {status === "error" && (
                    <div className="space-y-6">
                        <XCircle className="w-8 h-8 text-red-500 mx-auto" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter text-[#050505]">
                                Lien invalide
                            </h1>
                            <p className="text-sm text-gray-500 mt-2">
                                Ce lien n&apos;est plus valide. Il a peut-être expiré ou déjà été utilisé.
                            </p>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-gray-50">
                            <Link
                                href="/auth/login"
                                className="w-full h-12 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center"
                            >
                                Demander un nouveau lien
                            </Link>
                            <Link
                                href="/auth/signup"
                                className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 block"
                            >
                                Créer un compte
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
