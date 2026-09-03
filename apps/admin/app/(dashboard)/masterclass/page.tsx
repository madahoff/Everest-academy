"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
    AlertTriangle,
    CalendarDays,
    Check,
    Loader2,
    Mail,
    Pencil,
    Search,
    Sparkles,
    Trash2,
    Users,
    X,
} from "lucide-react"
import { toast } from "sonner"
import { MasterclassFormDialog, type MasterclassRow } from "@/components/dialogs/masterclass-form-dialog"
import { formatSessionDateShort, monthLabel } from "@/lib/masterclass-month"
import { formatAr, formatEur } from "@/lib/pricing"

// --- TYPES ---

type RegistrationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "ATTENDED" | "NO_SHOW"

interface RegistrationRow {
    id: string
    status: RegistrationStatus
    amount: number
    currency: string
    registeredAt: string
    confirmedAt: string | null
    cancelledAt: string | null
    confirmationEmailSentAt: string | null
    confirmationEmailError: string | null
    user: { id: string; fullName: string; firstName: string; lastName: string; email: string }
    masterclass: { id: string; title: string; monthKey: string; scheduledAt: string }
    payment: {
        orderId: string
        status: "PENDING" | "PAID" | "FAILED" | "CANCELLED"
        method: string
        amount: number
        currency: string
        paidAt: string | null
    } | null
}

interface RegistrationsPayload {
    scope: string
    masterclassId: string | null
    registrations: RegistrationRow[]
}

const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
    PENDING: "En attente",
    CONFIRMED: "Confirmée",
    CANCELLED: "Annulée",
    ATTENDED: "A participé",
    NO_SHOW: "Absent",
}

const REGISTRATION_STYLES: Record<RegistrationStatus, string> = {
    PENDING: "border-amber-300 text-amber-600",
    CONFIRMED: "border-[#2563EB] text-[#2563EB]",
    CANCELLED: "border-gray-200 text-gray-400",
    ATTENDED: "border-green-500 text-green-600",
    NO_SHOW: "border-red-200 text-red-500",
}

const PAYMENT_LABELS: Record<string, string> = {
    PENDING: "En attente",
    PAID: "Payé",
    FAILED: "Échoué",
    CANCELLED: "Annulé",
}

const PAYMENT_STYLES: Record<string, string> = {
    PENDING: "border-amber-300 text-amber-600",
    PAID: "border-green-500 text-green-600",
    FAILED: "border-red-300 text-red-500",
    CANCELLED: "border-gray-200 text-gray-400",
}

const STATUS_ORDER: RegistrationStatus[] = ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"]

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
 * Console des Masterclass : la séance à venir, les anciennes, et les inscrits.
 *
 * Deux listes, jamais confondues — les séances en haut, les inscriptions en bas —
 * reliées par un unique sélecteur de périmètre dont la valeur par défaut est
 * « Inscrits à la prochaine Masterclass ». La « prochaine » n'est pas un drapeau
 * stocké : elle est recalculée à chaque lecture, et bascule donc seule le 1er du mois
 * sans qu'aucune inscription passée ne soit touchée.
 */
export default function MasterclassPage() {
    const queryClient = useQueryClient()

    const [scope, setScope] = useState<string>("next")
    const [search, setSearch] = useState("")
    const [statuses, setStatuses] = useState<RegistrationStatus[]>([])

    const {
        data: masterclasses = [],
        isLoading: loadingSessions,
        error: sessionsError,
    } = useQuery<MasterclassRow[]>({
        queryKey: ["masterclasses"],
        queryFn: async () => {
            const res = await fetch("/api/masterclass")
            if (!res.ok) throw new Error("Failed to fetch masterclasses")
            return res.json()
        },
    })

    const { data: payload, isLoading: loadingRegistrations } = useQuery<RegistrationsPayload>({
        queryKey: ["masterclass-registrations", scope],
        queryFn: async () => {
            const res = await fetch(`/api/masterclass/registrations?scope=${encodeURIComponent(scope)}`)
            if (!res.ok) throw new Error("Failed to fetch registrations")
            return res.json()
        },
    })

    const registrations = payload?.registrations ?? []
    const next = masterclasses.find((m) => m.isNext) ?? null

    const refreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ["masterclasses"] })
        queryClient.invalidateQueries({ queryKey: ["masterclass-registrations"] })
    }

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: RegistrationStatus }) => {
            const res = await fetch(`/api/masterclass/registrations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || "Échec de la mise à jour")
            return body
        },
        onSuccess: () => {
            toast.success("Statut mis à jour")
            refreshAll()
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const resendMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/masterclass/registrations/${id}/resend-email`, { method: "POST" })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || "Échec de l'envoi")
            return body
        },
        onSuccess: () => {
            toast.success("Confirmation renvoyée")
            refreshAll()
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/masterclass/${id}`, { method: "DELETE" })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || "Suppression impossible")
            return body
        },
        onSuccess: () => {
            toast.success("Masterclass supprimée")
            refreshAll()
        },
        onError: (err: Error) => toast.error(err.message),
    })

    // Compteurs calculés sur le périmètre CHOISI, avant filtrage par statut : ils
    // servent justement à décider quel statut filtrer.
    const counts = useMemo(() => {
        const base: Record<RegistrationStatus, number> = {
            PENDING: 0,
            CONFIRMED: 0,
            CANCELLED: 0,
            ATTENDED: 0,
            NO_SHOW: 0,
        }
        for (const registration of registrations) base[registration.status] += 1
        return base
    }, [registrations])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        return registrations.filter((registration) => {
            if (statuses.length > 0 && !statuses.includes(registration.status)) return false
            if (!query) return true
            return (
                registration.user.fullName.toLowerCase().includes(query) ||
                registration.user.email.toLowerCase().includes(query) ||
                registration.masterclass.title.toLowerCase().includes(query)
            )
        })
    }, [registrations, search, statuses])

    const toggleStatus = (status: RegistrationStatus) =>
        setStatuses((current) =>
            current.includes(status) ? current.filter((s) => s !== status) : [...current, status],
        )

    const paidTotal = filtered
        .filter((r) => r.payment?.status === "PAID")
        .reduce((sum, r) => sum + r.amount, 0)

    const filtersActive = search.trim() !== "" || statuses.length > 0

    return (
        <div className="flex-1 bg-white min-h-screen p-8 lg:p-12 font-sans text-[#050505]">

            {/* En-tête */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b-2 border-gray-100">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#2563EB] mb-2">
                        Monthly Session Control
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter uppercase leading-none italic">
                        Master<span className="text-gray-300">class</span>
                    </h2>
                </div>
                <MasterclassFormDialog onSuccess={refreshAll} />
            </div>

            {/* La séance à venir, mise en avant : c'est celle que la vitrine annonce. */}
            {next ? (
                <div className="mb-12 border border-[#2563EB] bg-[#2563EB]/5 p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#2563EB]">
                                    Prochaine Masterclass · {monthLabel(next.monthKey)}
                                </span>
                            </div>
                            <p className="text-2xl font-black tracking-tighter italic mb-2">{next.title}</p>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                {formatSessionDateShort(next.scheduledAt)} · {next.instructor} ·{" "}
                                {next.price === 0 ? "Offerte" : `${formatAr(next.price)} / ${formatEur(next.priceEur)}`}
                            </p>
                        </div>
                        <div className="flex gap-10">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Inscrits</p>
                                <p className="text-3xl font-black italic tracking-tighter text-[#2563EB]">
                                    {next.confirmedCount}
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                    En attente
                                </p>
                                <p className="text-3xl font-black italic tracking-tighter">{next.pendingCount}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Places</p>
                                <p className="text-3xl font-black italic tracking-tighter">
                                    {next.seatsLeft === null ? "∞" : next.seatsLeft}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                !loadingSessions && (
                    <div className="mb-12 flex items-start gap-3 border border-amber-200 bg-amber-50 p-6">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-1">
                                Aucune Masterclass à venir
                            </p>
                            <p className="text-[11px] text-amber-700/80">
                                La vitrine n'annonce plus de séance. Programmez celle du mois et publiez-la pour rouvrir
                                les inscriptions.
                            </p>
                        </div>
                    </div>
                )
            )}

            {/* Sessions : la séance en cours ET l'historique, dans la même liste */}
            <div className="mb-16">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                        Sessions programmées
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                        {masterclasses.length} au total
                    </span>
                </div>

                {loadingSessions ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
                    </div>
                ) : sessionsError ? (
                    <p className="py-10 text-center text-sm font-bold text-red-500">
                        Erreur lors du chargement des sessions
                    </p>
                ) : masterclasses.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-gray-200">
                        <CalendarDays className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 text-sm font-bold mb-4">Aucune Masterclass programmée</p>
                        <MasterclassFormDialog onSuccess={refreshAll} />
                    </div>
                ) : (
                    <div className="border border-gray-100 overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-gray-100">
                                    {["Mois", "Séance", "Date", "Tarif", "Inscrits", "Recette", "Statut", ""].map((head) => (
                                        <th
                                            key={head}
                                            className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left"
                                        >
                                            {head}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {masterclasses.map((session) => (
                                    <tr key={session.id} className="group hover:bg-gray-50/50 transition-all">
                                        <td className="px-6 py-5">
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {monthLabel(session.monthKey)}
                                            </span>
                                            {session.isNext && (
                                                <span className="block mt-1 text-[8px] font-black uppercase tracking-widest text-[#2563EB]">
                                                    ← Prochaine
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-xs font-black uppercase tracking-tight">{session.title}</p>
                                            <p className="text-[10px] text-gray-400">{session.instructor}</p>
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-mono text-gray-500">
                                            {formatSessionDateShort(session.scheduledAt)}
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-bold">
                                            {session.price === 0 ? (
                                                "Offerte"
                                            ) : (
                                                <>
                                                    {formatAr(session.price)}
                                                    <span className="block text-gray-400">{formatEur(session.priceEur)}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-black italic">{session.confirmedCount}</span>
                                            {session.pendingCount > 0 && (
                                                <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-amber-500">
                                                    +{session.pendingCount} en attente
                                                </span>
                                            )}
                                            {session.capacity !== null && (
                                                <span className="block text-[9px] text-gray-400">
                                                    sur {session.capacity} places
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-bold">{formatAr(session.revenue)}</td>
                                        <td className="px-6 py-5">
                                            <span
                                                className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest border ${session.status === "PUBLISHED"
                                                    ? "border-[#2563EB] text-[#2563EB]"
                                                    : session.status === "DRAFT"
                                                        ? "border-amber-300 text-amber-600"
                                                        : "border-gray-200 text-gray-400"
                                                    }`}
                                            >
                                                {session.status === "PUBLISHED"
                                                    ? "Publiée"
                                                    : session.status === "DRAFT"
                                                        ? "Brouillon"
                                                        : "Archivée"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setScope(session.id)
                                                        setStatuses([])
                                                    }}
                                                    title="Voir les inscrits"
                                                    className="p-2 border border-transparent hover:border-gray-200 text-gray-400 hover:text-[#001F3F] transition-all"
                                                >
                                                    <Users className="w-4 h-4" />
                                                </button>
                                                <MasterclassFormDialog
                                                    masterclass={session}
                                                    onSuccess={refreshAll}
                                                    trigger={
                                                        <button
                                                            title="Modifier"
                                                            className="p-2 border border-transparent hover:border-gray-200 text-gray-400 hover:text-[#2563EB] transition-all"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    }
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Supprimer « ${session.title} » ?`)) {
                                                            deleteMutation.mutate(session.id)
                                                        }
                                                    }}
                                                    title="Supprimer"
                                                    className="p-2 border border-transparent hover:border-red-100 text-gray-400 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inscriptions */}
            <div className="border-t-2 border-gray-100 pt-12">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-6">
                    Inscriptions
                </h3>

                {/* Périmètre : la prochaine séance par défaut, l'historique à la demande */}
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setScope("next")}
                            className={`px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${scope === "next"
                                ? "bg-[#2563EB] text-white border-[#2563EB]"
                                : "border-gray-200 text-gray-500 hover:border-[#050505]"
                                }`}
                        >
                            Inscrits à la prochaine Masterclass
                        </button>
                        <button
                            onClick={() => setScope("all")}
                            className={`px-5 py-3 text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${scope === "all"
                                ? "bg-[#050505] text-white border-[#050505]"
                                : "border-gray-200 text-gray-500 hover:border-[#050505]"
                                }`}
                        >
                            Historique complet
                        </button>
                        <select
                            value={masterclasses.some((m) => m.id === scope) ? scope : ""}
                            onChange={(e) => e.target.value && setScope(e.target.value)}
                            className="px-4 py-3 border border-gray-200 bg-white text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 focus:outline-none focus:border-[#2563EB]"
                        >
                            <option value="">Une séance précise…</option>
                            {masterclasses.map((session) => (
                                <option key={session.id} value={session.id}>
                                    {monthLabel(session.monthKey)} — {session.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative w-full max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#2563EB] transition-colors" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="FILTRER PAR NOM OU EMAIL..."
                                className="w-full bg-gray-50 border-none px-12 py-4 text-[10px] font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#2563EB]"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#050505]"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filtre par statut : chaque état porte son compte, pour qu'on sache
                            ce qu'on va trouver avant de cliquer. */}
                        <div className="flex flex-wrap gap-2">
                            {STATUS_ORDER.map((status) => (
                                <button
                                    key={status}
                                    onClick={() => toggleStatus(status)}
                                    className={`flex items-center gap-1.5 px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${statuses.includes(status)
                                        ? "bg-[#050505] text-white border-[#050505]"
                                        : "border-gray-200 text-gray-500 hover:border-[#050505]"
                                        }`}
                                >
                                    {REGISTRATION_LABELS[status]}
                                    <span
                                        className={`px-1.5 py-0.5 text-[8px] ${statuses.includes(status) ? "bg-white/20" : "bg-gray-100 text-gray-400"
                                            }`}
                                    >
                                        {counts[status]}
                                    </span>
                                </button>
                            ))}
                            {filtersActive && (
                                <button
                                    onClick={() => {
                                        setSearch("")
                                        setStatuses([])
                                    }}
                                    className="flex items-center gap-1 px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <X className="w-3 h-3" /> Réinitialiser
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chiffres du périmètre courant */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Metric icon={Users} label="Inscriptions" value={filtered.length} hint={`sur ${registrations.length}`} />
                    <Metric icon={Check} label="Confirmées" value={counts.CONFIRMED + counts.ATTENDED} />
                    <Metric icon={AlertTriangle} label="En attente" value={counts.PENDING} hint="paiement non abouti" />
                    <Metric icon={CalendarDays} label="Encaissé" value={formatAr(paidTotal)} hint="commandes payées" />
                </div>

                {loadingRegistrations ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-gray-200">
                        <Users className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 text-sm font-bold">
                            {registrations.length === 0
                                ? scope === "next"
                                    ? "Aucune inscription à la prochaine Masterclass"
                                    : "Aucune inscription sur ce périmètre"
                                : "Aucune inscription ne correspond à ces filtres"}
                        </p>
                    </div>
                ) : (
                    <div className="border border-gray-100 overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-gray-100">
                                    {[
                                        "Nom",
                                        "Prénom",
                                        "Email",
                                        ...(scope === "all" ? ["Séance"] : []),
                                        "Date d'inscription",
                                        "Paiement",
                                        "Inscription",
                                        "Confirmation",
                                        "",
                                    ].map((head, index) => (
                                        <th
                                            key={`${head}-${index}`}
                                            className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left"
                                        >
                                            {head}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map((registration) => (
                                    <tr key={registration.id} className="group hover:bg-gray-50/50 transition-all">
                                        <td className="px-6 py-5 text-xs font-black uppercase tracking-tight">
                                            {registration.user.lastName || "—"}
                                        </td>
                                        <td className="px-6 py-5 text-xs font-bold">{registration.user.firstName || "—"}</td>
                                        <td className="px-6 py-5 text-[10px] font-mono text-gray-500 lowercase">
                                            {registration.user.email}
                                        </td>
                                        {scope === "all" && (
                                            <td className="px-6 py-5">
                                                <p className="text-[10px] font-black uppercase tracking-tight">
                                                    {registration.masterclass.title}
                                                </p>
                                                <p className="text-[9px] text-gray-400">
                                                    {monthLabel(registration.masterclass.monthKey)}
                                                </p>
                                            </td>
                                        )}
                                        <td className="px-6 py-5 text-[10px] font-mono text-gray-500">
                                            {formatSessionDateShort(registration.registeredAt)}
                                        </td>
                                        <td className="px-6 py-5">
                                            {registration.payment ? (
                                                <>
                                                    <span
                                                        className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest border ${PAYMENT_STYLES[registration.payment.status]
                                                            }`}
                                                    >
                                                        {PAYMENT_LABELS[registration.payment.status]}
                                                    </span>
                                                    <span className="block mt-1 text-[9px] text-gray-400">
                                                        {registration.payment.currency === "EUR"
                                                            ? formatEur(registration.payment.amount)
                                                            : formatAr(registration.payment.amount)}{" "}
                                                        · {registration.payment.method}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300">
                                                    {registration.amount === 0 ? "Séance offerte" : "Sans commande"}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            {/* Le statut se change ici : marquer une présence après la
                                                séance est le geste le plus courant de cette page. */}
                                            <select
                                                value={registration.status}
                                                onChange={(e) =>
                                                    statusMutation.mutate({
                                                        id: registration.id,
                                                        status: e.target.value as RegistrationStatus,
                                                    })
                                                }
                                                disabled={statusMutation.isPending}
                                                className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest border bg-white cursor-pointer focus:outline-none ${REGISTRATION_STYLES[registration.status]
                                                    }`}
                                            >
                                                {STATUS_ORDER.map((status) => (
                                                    <option key={status} value={status}>
                                                        {REGISTRATION_LABELS[status]}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-5">
                                            {registration.confirmationEmailSentAt ? (
                                                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-green-600">
                                                    <Check className="w-3 h-3" /> Envoyée
                                                </span>
                                            ) : registration.confirmationEmailError ? (
                                                <span
                                                    title={registration.confirmationEmailError}
                                                    className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-red-500"
                                                >
                                                    <AlertTriangle className="w-3 h-3" /> Échec
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {(registration.status === "CONFIRMED" || registration.status === "ATTENDED") && (
                                                <button
                                                    onClick={() => resendMutation.mutate(registration.id)}
                                                    disabled={resendMutation.isPending}
                                                    title="Renvoyer la confirmation"
                                                    className="p-2 border border-transparent hover:border-gray-200 text-gray-400 hover:text-[#2563EB] transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
