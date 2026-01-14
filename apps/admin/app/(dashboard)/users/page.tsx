"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    MoreHorizontal,
    Search,
    User,
    Shield,
    ShieldCheck,
    Calendar,
    Settings,
    UserMinus,
    Loader2
} from "lucide-react"
import { UserFormDialog } from "@/components/dialogs/user-form-dialog"

// --- TYPES ---
interface UserData {
    id: string
    name: string
    email: string
    role: "ADMIN" | "INSTRUCTOR" | "STUDENT"
    plan: "FREE" | "PREMIUM"
    status: "ACTIVE" | "INACTIVE"
    createdAt: string
}

// --- COMPOSANTS UI INTERNES ---

const RoleBadge = ({ role }: { role: string }) => {
    const configs: Record<string, { icon: any, color: string, label: string }> = {
        ADMIN: { icon: ShieldCheck, color: "text-[#2563EB]", label: "ADMIN" },
        INSTRUCTOR: { icon: Shield, color: "text-[#001F3F]", label: "INSTRUCTEUR" },
        STUDENT: { icon: User, color: "text-gray-400", label: "ÉTUDIANT" }
    };
    const { icon: Icon, color, label } = configs[role] || configs.STUDENT;

    return (
        <div className={`flex items-center gap-2 ${color}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </div>
    );
};

// --- COMPOSANT PRINCIPAL ---

export default function UsersPage() {
    const queryClient = useQueryClient()

    const { data: users = [], isLoading, error } = useQuery<UserData[]>({
        queryKey: ["users"],
        queryFn: async () => {
            const res = await fetch("/api/users")
            if (!res.ok) throw new Error("Failed to fetch users")
            return res.json()
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete user")
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] })
        }
    })

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["users"] })
    }

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer ${name} ?`)) {
            deleteMutation.mutate(id)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    return (
        <div className="flex-1 bg-white min-h-screen p-8 lg:p-12 font-sans text-[#050505]">

            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16 pb-8 border-b-2 border-gray-100">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#2563EB] mb-2">User Access Control</div>
                    <h2 className="text-5xl font-black tracking-tighter uppercase leading-none italic">
                        Annuaire <span className="text-gray-300">Membres</span>
                    </h2>
                </div>
                <div className="flex gap-3">
                    <button className="px-6 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-[0.2em] hover:border-[#050505] transition-all">
                        Exporter Logs
                    </button>
                    <UserFormDialog onSuccess={handleRefresh} />
                </div>
            </div>

            {/* Table Control Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#2563EB] transition-colors" />
                    <input
                        type="text"
                        placeholder="FILTRER PAR NOM, EMAIL OU RÔLE..."
                        className="w-full bg-gray-50 border-none px-12 py-4 text-[10px] font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#2563EB]"
                    />
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="text-center py-20">
                    <p className="text-red-500 text-sm font-bold">Erreur lors du chargement des utilisateurs</p>
                    <button onClick={handleRefresh} className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline">
                        Réessayer
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && users.length === 0 && (
                <div className="text-center py-20 border border-dashed border-gray-200">
                    <User className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 text-sm font-bold mb-4">Aucun utilisateur enregistré</p>
                    <UserFormDialog onSuccess={handleRefresh} />
                </div>
            )}

            {/* Identity Grid (Tableau) */}
            {!isLoading && !error && users.length > 0 && (
                <div className="border border-gray-100">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[#F9FAFB] border-b border-gray-100">
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Identité Utilisateur</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Privilèges</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Abonnement</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">État</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Enregistré</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users.map((user) => (
                                <tr key={user.id} className="group hover:bg-gray-50/50 transition-all">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-[#001F3F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                                                {user.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black uppercase tracking-tight group-hover:text-[#2563EB] transition-colors">{user.name}</span>
                                                <span className="text-[10px] font-mono text-gray-400 lowercase">{user.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <RoleBadge role={user.role} />
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest border ${user.plan === 'PREMIUM' ? 'border-[#2563EB] text-[#2563EB]' : 'border-gray-200 text-gray-400'
                                            }`}>
                                            {user.plan === 'PREMIUM' ? 'Premium' : 'Gratuit'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest ${user.status === 'ACTIVE' ? 'text-gray-900' : 'text-gray-300'}`}>
                                                {user.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-gray-400 text-[10px] font-mono">
                                            <Calendar className="w-3 h-3" /> {formatDate(user.createdAt)}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 hover:text-[#001F3F] transition-all">
                                                <Settings className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id, user.name)}
                                                className="p-2 hover:bg-white border border-transparent hover:border-red-100 text-gray-400 hover:text-red-500 transition-all"
                                            >
                                                <UserMinus className="w-4 h-4" />
                                            </button>
                                            <button className="p-2">
                                                <MoreHorizontal className="w-4 h-4 text-gray-300" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer Summary */}
            <div className="mt-12 flex flex-col md:flex-row gap-8 items-center justify-between border-t border-gray-100 pt-10">
                <div className="flex gap-12">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Total Utilisateurs</p>
                        <p className="text-2xl font-black italic tracking-tighter">{users.length}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Utilisateurs Premium</p>
                        <p className="text-2xl font-black italic tracking-tighter text-[#2563EB]">
                            {users.filter(u => u.plan === 'PREMIUM').length}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}