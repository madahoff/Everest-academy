"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    Crown,
    Loader2,
    Check,
    AlertTriangle,
    TrendingUp,
    Users,
    Layers,
    Wallet,
} from "lucide-react"

// --- TYPES ---
interface PremiumPlanData {
    price: number
    active: boolean
    updatedAt: string | null
    courseCount: number
    premiumCourseCount: number
    catalogueValue: number
    memberCount: number
    soldCount: number
    revenue: number
}

const ar = (value: number) => `${Math.round(value).toLocaleString("fr-FR")} Ar`

// --- COMPOSANTS UI INTERNES ---

const Metric = ({ icon: Icon, label, value, hint }: any) => (
    <div className="border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3">
            <Icon className="w-3 h-3" /> {label}
        </div>
        <p className="text-3xl font-black tracking-tighter italic">{value}</p>
        {hint && <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">{hint}</p>}
    </div>
)

// --- COMPOSANT PRINCIPAL ---

/**
 * Réglage de l'offre « Pack Premium » : le tarif unique qui débloque tout le catalogue
 * côté académie. Un seul enregistrement à piloter, d'où une page-formulaire plutôt
 * qu'une table.
 */
export default function PremiumPage() {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery<PremiumPlanData>({
        queryKey: ["premium-plan"],
        queryFn: async () => {
            const res = await fetch("/api/premium")
            if (!res.ok) throw new Error("Failed to fetch premium plan")
            return res.json()
        },
    })

    const [price, setPrice] = useState("")
    const [active, setActive] = useState(true)
    const [formError, setFormError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    // Le formulaire n'est rempli qu'à l'arrivée des données : sans cela un tarif saisi
    // serait écrasé au moindre rafraîchissement du cache.
    useEffect(() => {
        if (!data) return
        setPrice(String(data.price))
        setActive(data.active)
    }, [data])

    const mutation = useMutation({
        mutationFn: async (payload: { price: number; active: boolean }) => {
            const res = await fetch("/api/premium", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || "Échec de l'enregistrement")
            return body
        },
        onSuccess: () => {
            setFormError(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
            queryClient.invalidateQueries({ queryKey: ["premium-plan"] })
        },
        onError: (err: Error) => setFormError(err.message),
    })

    const parsedPrice = Number(price)
    const priceValid = Number.isInteger(parsedPrice) && parsedPrice > 0
    const dirty = data ? parsedPrice !== data.price || active !== data.active : false

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!priceValid) {
            setFormError("Le tarif doit être un nombre entier d'ariary (ex : 199000)")
            return
        }
        mutation.mutate({ price: parsedPrice, active })
    }

    const savings = data ? data.catalogueValue - (priceValid ? parsedPrice : data.price) : 0

    return (
        <div className="flex-1 font-sans text-[#050505]">

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16 pb-10 border-b-2 border-[#050505]">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300 mb-3">
                        <Crown className="w-3 h-3" /> Monétisation
                    </div>
                    <h2 className="text-6xl font-black tracking-tighter uppercase leading-none">
                        Offre <span className="text-[#2563EB]">Premium</span>
                    </h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-4 max-w-xl">
                        Un paiement unique qui débloque l'intégralité du catalogue, cours à venir compris.
                    </p>
                </div>

                {data && (
                    <div className={`px-4 py-3 border ${data.active ? "border-[#2563EB] text-[#2563EB]" : "border-gray-200 text-gray-400"}`}>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em]">
                            {data.active ? "● En vente" : "○ Retirée de la vente"}
                        </span>
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
                </div>
            )}

            {error && (
                <div className="text-center py-20">
                    <p className="text-red-500 text-sm font-bold">Erreur lors du chargement de l'offre premium</p>
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["premium-plan"] })}
                        className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline"
                    >
                        Réessayer
                    </button>
                </div>
            )}

            {data && !isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Formulaire de tarification */}
                    <form onSubmit={handleSubmit} className="lg:col-span-7 border border-gray-100 p-10">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-300 mb-8">
                            Tarification du pack
                        </p>

                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Prix de vente
                        </label>
                        <div className="flex items-center border-b-2 border-[#050505] focus-within:border-[#2563EB] transition-colors mb-3">
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="flex-1 bg-transparent py-4 text-4xl font-black tracking-tighter italic outline-none"
                                placeholder="199000"
                            />
                            <span className="text-sm font-black uppercase tracking-widest text-gray-300 pl-4">Ar</span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-10">
                            Ariary entiers uniquement — le service de paiement refuse les centimes.
                        </p>

                        {/* Mise en vente */}
                        <div className="flex items-start justify-between gap-8 border-t border-gray-100 pt-8 mb-10">
                            <div>
                                <p className="text-sm font-black uppercase tracking-tighter mb-1">Proposer l'offre</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 max-w-sm leading-relaxed">
                                    Désactivée, la section disparaît du catalogue. Les accès déjà accordés restent acquis.
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={active}
                                onClick={() => setActive(!active)}
                                className={`relative w-14 h-7 shrink-0 border transition-colors ${active ? "bg-[#2563EB] border-[#2563EB]" : "bg-gray-100 border-gray-200"}`}
                            >
                                <span
                                    className={`absolute top-0.5 h-5 w-5 bg-white transition-all ${active ? "left-8" : "left-0.5"}`}
                                />
                            </button>
                        </div>

                        {/* Aperçu de l'argument commercial affiché aux étudiants */}
                        <div className="bg-gray-50 border border-gray-100 p-6 mb-10">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 mb-4">
                                Aperçu côté étudiant
                            </p>
                            <div className="flex items-end gap-4">
                                <span className="text-3xl font-black tracking-tighter italic">
                                    {ar(priceValid ? parsedPrice : data.price)}
                                </span>
                                {savings > 0 && (
                                    <span className="text-sm text-gray-400 line-through mb-1">{ar(data.catalogueValue)}</span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mt-3">
                                {savings > 0 ? (
                                    <span className="text-[#2563EB]">Économie affichée : {ar(savings)}</span>
                                ) : (
                                    <span className="text-amber-600 flex items-center gap-2">
                                        <AlertTriangle className="w-3 h-3" />
                                        Le pack coûte plus cher que le catalogue à l'unité
                                    </span>
                                )}
                            </p>
                        </div>

                        {formError && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-6">{formError}</p>
                        )}

                        <div className="flex items-center gap-6">
                            <button
                                type="submit"
                                disabled={mutation.isPending || !dirty || !priceValid}
                                className="px-10 py-4 bg-[#050505] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#2563EB] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3"
                            >
                                {mutation.isPending ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Enregistrement…</>
                                ) : (
                                    <>Appliquer le tarif</>
                                )}
                            </button>

                            {saved && (
                                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#2563EB]">
                                    <Check className="w-3 h-3" /> Tarif appliqué
                                </span>
                            )}

                            {data.updatedAt && !saved && (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300">
                                    Dernière modification&nbsp;
                                    {new Date(data.updatedAt).toLocaleDateString("fr-FR", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            )}
                        </div>

                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-8 pt-8 border-t border-gray-100 leading-relaxed">
                            Le nouveau tarif ne vaut que pour les achats à venir. Les commandes déjà réglées
                            conservent leur montant, et aucun accès accordé n'est repris.
                        </p>
                    </form>

                    {/* Chiffres de contexte */}
                    <div className="lg:col-span-5 space-y-6">
                        <Metric
                            icon={Layers}
                            label="Catalogue débloqué"
                            value={data.courseCount}
                            hint={`${data.premiumCourseCount} modules payants · ${ar(data.catalogueValue)} à l'unité`}
                        />
                        <Metric
                            icon={Users}
                            label="Membres premium"
                            value={data.memberCount}
                            hint={`${data.soldCount} pack${data.soldCount > 1 ? "s" : ""} vendu${data.soldCount > 1 ? "s" : ""}`}
                        />
                        <Metric
                            icon={Wallet}
                            label="Revenu du pack"
                            value={ar(data.revenue)}
                            hint="Commandes réglées uniquement"
                        />
                        <Metric
                            icon={TrendingUp}
                            label="Panier moyen"
                            value={data.soldCount > 0 ? ar(data.revenue / data.soldCount) : "—"}
                            hint="Reflète les tarifs successifs"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
