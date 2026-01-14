"use client"

import { useQuery } from "@tanstack/react-query"
import {
    LayoutDashboard,
    Users,
    BookOpen,
    DollarSign,
    TrendingUp,
    ArrowUpRight,
    MoreHorizontal,
    Loader2,
    Package
} from "lucide-react"

// --- TYPES ---
interface StatsData {
    users: {
        total: number
        premium: number
        conversionRate: string
    }
    courses: {
        total: number
        active: number
        totalSales: number
    }
    products: {
        total: number
        outOfStock: number
    }
}

// --- COMPOSANTS UI INTERNES ---

const StatCard = ({ title, value, description, icon: Icon, loading }: any) => (
    <div className="bg-white border border-gray-100 p-6 rounded-none relative overflow-hidden group hover:border-[#001F3F] transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-gray-50 text-[#001F3F] group-hover:bg-[#2563EB] group-hover:text-white transition-colors duration-300">
                <Icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-50 px-2 py-0.5 tracking-tighter">
                <TrendingUp className="h-3 w-3" /> LIVE
            </span>
        </div>
        <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">{title}</p>
            {loading ? (
                <div className="h-9 flex items-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
            ) : (
                <div className="text-3xl font-black tracking-tighter text-[#050505] mb-1">{value}</div>
            )}
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-widest">{description}</p>
        </div>
        {/* Accent line décoratif */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-50 group-hover:bg-[#2563EB] transition-all"></div>
    </div>
);

// --- COMPOSANT PRINCIPAL ---

export default function DashboardPage() {
    const { data: stats, isLoading, error } = useQuery<StatsData>({
        queryKey: ["stats"],
        queryFn: async () => {
            const res = await fetch("/api/stats")
            if (!res.ok) throw new Error("Failed to fetch stats")
            return res.json()
        },
        refetchInterval: 30000 // Refresh every 30 seconds
    })

    const statCards = [
        {
            title: "Total Utilisateurs",
            value: stats?.users?.total?.toLocaleString() || "0",
            description: `${stats?.users?.conversionRate || "0%"} conversion premium`,
            icon: Users,
        },
        {
            title: "Cours Actifs",
            value: stats?.courses?.active?.toString() || "0",
            description: `${stats?.courses?.total || 0} cours au total`,
            icon: BookOpen,
        },
        {
            title: "Ventes Totales",
            value: stats?.courses?.totalSales?.toLocaleString() || "0",
            description: "Unités vendues",
            icon: DollarSign,
        },
        {
            title: "Produits en Stock",
            value: stats?.products?.total?.toString() || "0",
            description: `${stats?.products?.outOfStock || 0} en rupture`,
            icon: Package,
        },
    ]

    return (
        <div className="flex-1 space-y-8 font-sans">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-8">
                <div>
                    <div className="flex-1 font-sans text-[#050505] font-bold uppercase tracking-[0.3em] text-[#2563EB] mb-2">
                        <div className="w-2 h-2 bg-[#2563EB]"></div> Admin / Analytics
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter uppercase italic leading-none text-[#050505]">
                        Tableau de <span className="text-gray-300">Bord</span>
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button className="px-6 py-3 bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:border-[#050505] transition-all">
                        Exporter PDF
                    </button>
                    <a href="/courses" className="px-6 py-3 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all">
                        Nouveau Cours
                    </a>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 p-4">
                    <p className="text-red-600 text-sm font-bold">Erreur lors du chargement des statistiques</p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <StatCard key={stat.title} {...stat} loading={isLoading} />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-7">

                {/* Graphique Section (7 colonnes -> 4) */}
                <div className="lg:col-span-4 bg-white border border-gray-100 p-8">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#050505]">Performance Globale</h3>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Analyse des revenus annuels</p>
                        </div>
                        <MoreHorizontal className="h-5 w-5 text-gray-300 cursor-pointer" />
                    </div>

                    <div className="aspect-[16/7] w-full bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                        {/* Motif de grille en arrière-plan */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2">Visualisation Engine Ready</p>
                        <div className="h-[2px] w-24 bg-[#2563EB]"></div>
                    </div>
                </div>

                {/* Ventes Récentes (7 colonnes -> 3) */}
                <div className="lg:col-span-3 bg-[#050505] text-white p-8">
                    <div className="mb-10">
                        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#2563EB]">Activité Récente</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                            {isLoading ? 'Chargement...' : `${stats?.users?.total || 0} utilisateurs enregistrés`}
                        </p>
                    </div>

                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
                            </div>
                        ) : (
                            <>
                                <div className="border-b border-white/5 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-[#2563EB] flex items-center justify-center text-[10px] font-bold">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold uppercase tracking-tighter">Utilisateurs</p>
                                            <p className="text-[9px] text-gray-500">Total enregistré</p>
                                        </div>
                                        <p className="text-xl font-black">{stats?.users?.total || 0}</p>
                                    </div>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-white/5 flex items-center justify-center text-[10px] font-bold">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold uppercase tracking-tighter">Cours</p>
                                            <p className="text-[9px] text-gray-500">Dans le catalogue</p>
                                        </div>
                                        <p className="text-xl font-black">{stats?.courses?.total || 0}</p>
                                    </div>
                                </div>

                                <div className="border-b border-white/5 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-white/5 flex items-center justify-center text-[10px] font-bold">
                                            <Package className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold uppercase tracking-tighter">Produits</p>
                                            <p className="text-[9px] text-gray-500">En inventaire</p>
                                        </div>
                                        <p className="text-xl font-black">{stats?.products?.total || 0}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <a href="/users" className="block w-full mt-10 py-4 border border-white/10 text-center text-[9px] font-bold uppercase tracking-[0.4em] hover:bg-white hover:text-[#050505] transition-all">
                        Voir tous les utilisateurs
                    </a>
                </div>

            </div>
        </div>
    )
}