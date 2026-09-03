"use client"

import { useEffect, useMemo, useState } from "react"
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
    Loader2,
    X,
    Check,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { UserFormDialog } from "@/components/dialogs/user-form-dialog"
import { MembersBulkEmailDialog } from "@/components/dialogs/members-bulk-email-dialog"
import { MultiSelect } from "@/components/ui/multi-select"
import { CourseAccessCell } from "@/components/users/course-access-cell"
import { BulkAccessBar } from "@/components/users/bulk-access-bar"
import {
    EMPTY_FILTERS,
    PLAN_LABELS,
    ROLE_LABELS,
    STATUS_LABELS,
    filterUsers,
    hasActiveFilters,
    type DirectoryCourse,
    type DirectoryFilters,
    type DirectoryUser,
    type Plan,
    type Role,
    type Status,
} from "@/lib/user-directory"

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

/** Case à cocher carrée, au même dessin que celles des listes à choix multiples. */
const SquareCheckbox = ({
    checked,
    partial,
    onChange,
    label,
}: {
    checked: boolean
    partial?: boolean
    onChange: () => void
    label: string
}) => (
    <button
        type="button"
        aria-label={label}
        onClick={onChange}
        className={`flex h-4 w-4 shrink-0 items-center justify-center border transition-colors ${checked || partial ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-gray-300 hover:border-[#050505]"
            }`}
    >
        {checked && <Check className="h-3 w-3" />}
        {!checked && partial && <span className="h-0.5 w-2 bg-white" />}
    </button>
)

/** Tailles de page proposées. La première est la valeur par défaut. */
const PAGE_SIZES = [25, 50, 100, 200]

/**
 * Navigation entre les pages de l'annuaire.
 *
 * Les numéros sont resserrés autour de la page courante : au-delà de quelques
 * milliers de membres, une barre qui les listerait tous déborderait l'écran.
 */
const Pagination = ({
    page,
    pageCount,
    onChange,
}: {
    page: number
    pageCount: number
    onChange: (page: number) => void
}) => {
    if (pageCount <= 1) return null

    const pages: (number | "gap")[] = []
    for (let candidate = 1; candidate <= pageCount; candidate++) {
        const near = Math.abs(candidate - page) <= 1
        const edge = candidate === 1 || candidate === pageCount
        if (near || edge) {
            pages.push(candidate)
        } else if (pages[pages.length - 1] !== "gap") {
            pages.push("gap")
        }
    }

    const arrow = "flex h-9 w-9 items-center justify-center border border-gray-200 text-gray-400 transition-all hover:border-[#050505] hover:text-[#050505] disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-400"

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                aria-label="Page précédente"
                className={arrow}
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {pages.map((entry, index) =>
                entry === "gap" ? (
                    <span key={`gap-${index}`} className="px-1 text-[10px] font-black text-gray-300">
                        …
                    </span>
                ) : (
                    <button
                        key={entry}
                        onClick={() => onChange(entry)}
                        aria-current={entry === page ? "page" : undefined}
                        className={`h-9 min-w-9 px-2 text-[10px] font-black tracking-widest transition-all ${entry === page
                            ? "bg-[#050505] text-white"
                            : "border border-gray-200 text-gray-400 hover:border-[#050505] hover:text-[#050505]"
                            }`}
                    >
                        {entry}
                    </button>
                ),
            )}

            <button
                onClick={() => onChange(page + 1)}
                disabled={page >= pageCount}
                aria-label="Page suivante"
                className={arrow}
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    )
}

// --- COMPOSANT PRINCIPAL ---

export default function UsersPage() {
    const queryClient = useQueryClient()

    const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_FILTERS)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

    const { data: users = [], isLoading, error } = useQuery<DirectoryUser[]>({
        queryKey: ["users"],
        queryFn: async () => {
            const res = await fetch("/api/users")
            if (!res.ok) throw new Error("Failed to fetch users")
            return res.json()
        }
    })

    // Le catalogue sert à cocher les accès et à filtrer l'annuaire : sans lui, la
    // colonne d'accès n'a rien à proposer.
    const { data: courses = [] } = useQuery<DirectoryCourse[]>({
        queryKey: ["courses"],
        queryFn: async () => {
            const res = await fetch("/api/courses")
            if (!res.ok) throw new Error("Failed to fetch courses")
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

    const filtered = useMemo(() => filterUsers(users, filters), [users, filters])

    // --- PAGINATION ---
    // Purement locale : l'annuaire tient déjà en mémoire — c'est ce qui permet aux
    // filtres et aux actions groupées de porter sur l'ensemble, pas sur une page.
    // Elle ne découpe donc que l'AFFICHAGE.
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))

    // Un filtre qui réduit la liste sous la page courante laisserait un tableau vide :
    // on revient au début plutôt que d'afficher du néant.
    useEffect(() => {
        setPage(1)
    }, [filters, pageSize])

    const currentPage = Math.min(page, pageCount)
    const pageStart = (currentPage - 1) * pageSize
    const paginated = filtered.slice(pageStart, pageStart + pageSize)

    // La sélection survit aux changements de filtre — on coche, on affine, on agit —
    // mais jamais à la disparition d'un compte.
    const selectedUsers = useMemo(
        () => users.filter((u) => selectedIds.includes(u.id)),
        [users, selectedIds],
    )

    const courseOptions = useMemo(
        () => courses.map((c) => ({
            value: c.id,
            label: c.title,
            hint: c.status === "DRAFT" ? "Brouillon" : undefined,
        })),
        [courses],
    )

    const filteredSelectedCount = filtered.filter((u) => selectedIds.includes(u.id)).length
    const allFilteredSelected = filtered.length > 0 && filteredSelectedCount === filtered.length

    // La case d'en-tête coche la PAGE affichée : c'est ce que voit l'utilisateur, et
    // cocher en silence des lignes hors écran serait dangereux devant des actions
    // groupées qui retirent des accès. L'extension à tout le filtre est proposée
    // juste en dessous, explicitement.
    const pageSelectedCount = paginated.filter((u) => selectedIds.includes(u.id)).length
    const allPageSelected = paginated.length > 0 && pageSelectedCount === paginated.length

    const toggleAllOnPage = () => {
        const ids = paginated.map((u) => u.id)
        setSelectedIds((current) =>
            allPageSelected
                ? current.filter((id) => !ids.includes(id))
                : [...new Set([...current, ...ids])],
        )
    }

    const selectAllFiltered = () => {
        setSelectedIds((current) => [...new Set([...current, ...filtered.map((u) => u.id)])])
    }

    const toggleOne = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
        )
    }

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["users"] })
    }

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer ${name} ?`)) {
            deleteMutation.mutate(id)
            setSelectedIds((current) => current.filter((v) => v !== id))
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const filtersActive = hasActiveFilters(filters)

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
                    <MembersBulkEmailDialog users={users} filtered={filtered} selected={selectedUsers} />
                    <UserFormDialog onSuccess={handleRefresh} />
                </div>
            </div>

            {/* Recherche et filtres */}
            <div className="mb-8 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#2563EB] transition-colors" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            placeholder="FILTRER PAR NOM, EMAIL OU RÔLE..."
                            className="w-full bg-gray-50 border-none px-12 py-4 text-[10px] font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#2563EB]"
                        />
                        {filters.search && (
                            <button
                                onClick={() => setFilters({ ...filters, search: "" })}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#050505]"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <MultiSelect
                            options={courseOptions}
                            selected={filters.courseIds}
                            onChange={(courseIds) => setFilters({ ...filters, courseIds })}
                            placeholder="Accès au cours"
                            title="A accès à au moins un de ces cours"
                            searchPlaceholder="Rechercher un cours..."
                            triggerClassName="min-w-[190px]"
                        />
                        <MultiSelect
                            options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                            selected={filters.roles}
                            onChange={(roles) => setFilters({ ...filters, roles: roles as Role[] })}
                            placeholder="Rôle"
                            title="Rôles"
                            triggerClassName="min-w-[130px]"
                        />
                        <MultiSelect
                            options={(Object.keys(PLAN_LABELS) as Plan[]).map((p) => ({ value: p, label: PLAN_LABELS[p] }))}
                            selected={filters.plans}
                            onChange={(plans) => setFilters({ ...filters, plans: plans as Plan[] })}
                            placeholder="Abonnement"
                            title="Abonnements"
                            triggerClassName="min-w-[150px]"
                        />
                        <MultiSelect
                            options={(Object.keys(STATUS_LABELS) as Status[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                            selected={filters.statuses}
                            onChange={(statuses) => setFilters({ ...filters, statuses: statuses as Status[] })}
                            placeholder="État"
                            title="États"
                            triggerClassName="min-w-[130px]"
                        />
                        {filtersActive && (
                            <button
                                onClick={() => setFilters(EMPTY_FILTERS)}
                                className="flex items-center gap-1 px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X className="w-3 h-3" /> Réinitialiser
                            </button>
                        )}
                    </div>
                </div>

                {filtersActive && (
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {filtered.length} membre{filtered.length > 1 ? "s" : ""} sur {users.length}
                    </p>
                )}
            </div>

            {/* Actions groupées */}
            {selectedUsers.length > 0 && (
                <BulkAccessBar
                    selected={selectedUsers}
                    courses={courses}
                    onClear={() => setSelectedIds([])}
                >
                    <MembersBulkEmailDialog
                        users={users}
                        filtered={filtered}
                        selected={selectedUsers}
                        trigger={
                            <button className="border border-gray-200 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:border-[#050505]">
                                Email à la sélection
                            </button>
                        }
                    />
                </BulkAccessBar>
            )}

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

            {/* Aucun résultat pour le filtre courant */}
            {!isLoading && !error && users.length > 0 && filtered.length === 0 && (
                <div className="text-center py-20 border border-dashed border-gray-200">
                    <Search className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 text-sm font-bold mb-4">Aucun membre ne correspond à ces filtres</p>
                    <button
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline"
                    >
                        Réinitialiser les filtres
                    </button>
                </div>
            )}

            {/* Identity Grid (Tableau) */}
            {!isLoading && !error && filtered.length > 0 && (
                <div className="border border-gray-100 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[#F9FAFB] border-b border-gray-100">
                                <th className="px-6 py-5 w-10">
                                    <SquareCheckbox
                                        checked={allPageSelected}
                                        partial={pageSelectedCount > 0 && !allPageSelected}
                                        onChange={toggleAllOnPage}
                                        label="Sélectionner cette page"
                                    />
                                </th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Identité Utilisateur</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Accès aux cours</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Privilèges</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Abonnement</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">État</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-left">Enregistré</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.map((user) => {
                                const isSelected = selectedIds.includes(user.id)
                                return (
                                    <tr
                                        key={user.id}
                                        className={`group transition-all ${isSelected ? "bg-[#2563EB]/5" : "hover:bg-gray-50/50"}`}
                                    >
                                        <td className="px-6 py-6">
                                            <SquareCheckbox
                                                checked={isSelected}
                                                onChange={() => toggleOne(user.id)}
                                                label={`Sélectionner ${user.name}`}
                                            />
                                        </td>
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
                                            <CourseAccessCell user={user} courses={courses} />
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
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Extension explicite de la sélection à tout le filtre — jamais implicite. */}
            {!isLoading && !error && allPageSelected && filtered.length > paginated.length && !allFilteredSelected && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border border-[#2563EB]/30 bg-[#2563EB]/5 px-6 py-4 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Les {paginated.length} membres de cette page sont sélectionnés.
                    </span>
                    <button
                        onClick={selectAllFiltered}
                        className="text-[10px] font-black uppercase tracking-widest text-[#2563EB] underline hover:text-[#001F3F]"
                    >
                        Sélectionner les {filtered.length} membres filtrés
                    </button>
                </div>
            )}

            {/* Barre de pagination */}
            {!isLoading && !error && filtered.length > 0 && (
                <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 pt-6 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} sur {filtered.length}
                        {filtered.length !== users.length && ` (${users.length} au total)`}
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-300">
                                Par page
                            </span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                aria-label="Nombre de membres par page"
                                className="border border-gray-200 bg-white px-3 py-2 text-[10px] font-black tracking-widest text-[#050505] focus:border-[#2563EB] focus:outline-none"
                            >
                                {PAGE_SIZES.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
                    </div>
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
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Sélectionnés</p>
                        <p className="text-2xl font-black italic tracking-tighter">{selectedUsers.length}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
