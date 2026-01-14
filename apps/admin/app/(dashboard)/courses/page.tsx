"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
    Search,
    Filter,
    Download,
    ExternalLink,
    Edit3,
    Trash2,
    Eye,
    Loader2,
    BookOpen,
    Layers,
    Image as ImageIcon
} from "lucide-react"
import { CourseFormDialog } from "@/components/dialogs/course-form-dialog"

// --- TYPES ---
interface CourseData {
    id: string
    title: string
    description: string
    heroImage: string
    cardImage: string
    welcomeVideo: string
    status: "ACTIVE" | "DRAFT"
    price: string | number
    duration: string
    level: string
    salesCount: number
    createdAt: string
    _count?: { sections: number }
}

// --- COMPOSANTS UI INTERNES ---

const StatusBadge = ({ status }: { status: string }) => {
    const isActive = status === "ACTIVE"
    return (
        <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-tighter ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
            {isActive ? "● Publié" : "○ Brouillon"}
        </span>
    )
}

// --- COMPOSANT PRINCIPAL ---

export default function CoursesPage() {
    const queryClient = useQueryClient()

    const { data: courses = [], isLoading, error } = useQuery<CourseData[]>({
        queryKey: ["courses"],
        queryFn: async () => {
            const res = await fetch("/api/courses")
            if (!res.ok) throw new Error("Failed to fetch courses")
            return res.json()
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/courses/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete course")
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courses"] })
        }
    })

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["courses"] })
    }

    const handleDelete = (id: string, title: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer "${title}" et toutes ses sections ?`)) {
            deleteMutation.mutate(id)
        }
    }

    const formatPrice = (price: string | number) => {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price
        return numPrice === 0 ? 'Gratuit' : `${numPrice.toFixed(2)}  Ar`
    }

    return (
        <div className="flex-1 font-sans text-[#050505]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b border-gray-100">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#2563EB] mb-2">Learning Management</div>
                    <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">
                        Catalogue <span className="text-gray-200 italic">Cours</span>
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:border-[#050505] transition-all flex items-center gap-2">
                        <Download className="w-3 h-3" /> Export
                    </button>
                    <CourseFormDialog onSuccess={handleRefresh} />
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="RECHERCHER UN COURS..."
                        className="w-full bg-gray-50 border-none px-12 py-3 text-[10px] font-bold tracking-widest focus:ring-1 focus:ring-[#2563EB] outline-none"
                    />
                </div>
                <button className="p-3 bg-gray-50 text-gray-400 hover:text-[#050505] transition-colors">
                    <Filter className="w-4 h-4" />
                </button>
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
                    <p className="text-red-500 text-sm font-bold">Erreur lors du chargement</p>
                    <button onClick={handleRefresh} className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline">
                        Réessayer
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && courses.length === 0 && (
                <div className="text-center py-20 border border-dashed border-gray-200">
                    <BookOpen className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 text-sm font-bold mb-4">Aucun cours dans le catalogue</p>
                    <div className="flex justify-center">
                        <CourseFormDialog onSuccess={handleRefresh} />
                    </div>
                </div>
            )}

            {/* Courses Grid */}
            {!isLoading && !error && courses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                        <div key={course.id} className="border border-gray-100 bg-white group hover:border-[#2563EB] transition-all overflow-hidden">
                            {/* Image */}
                            <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                {course.cardImage ? (
                                    <img
                                        src={course.cardImage}
                                        alt={course.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-12 h-12 text-gray-200" />
                                    </div>
                                )}
                                <div className="absolute top-3 left-3">
                                    <StatusBadge status={course.status} />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                <Link href={`/courses/${course.id}`}>
                                    <h3 className="font-bold uppercase text-sm tracking-tight mb-2 group-hover:text-[#2563EB] transition-colors cursor-pointer flex items-center gap-2">
                                        {course.title}
                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                    </h3>
                                </Link>

                                <p className="text-[10px] text-gray-400 line-clamp-2 mb-4">
                                    {course.description}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
                                            <Layers className="w-3 h-3" />
                                            {course._count?.sections || 0} sections
                                        </div>
                                        <span className="text-xs font-black">{formatPrice(course.price)}</span>
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CourseFormDialog
                                            onSuccess={handleRefresh}
                                            editData={{
                                                id: course.id,
                                                title: course.title,
                                                description: course.description,
                                                heroImage: course.heroImage,
                                                cardImage: course.cardImage,
                                                welcomeVideo: course.welcomeVideo,
                                                price: typeof course.price === 'string' ? parseFloat(course.price) : course.price,
                                                duration: course.duration || "Variable",
                                                level: course.level || "INTERMEDIATE",
                                                status: course.status
                                            }}
                                            trigger={
                                                <button className="p-2 hover:bg-gray-50 transition-all" title="Modifier">
                                                    <Edit3 className="w-3.5 h-3.5 text-gray-400 hover:text-[#2563EB]" />
                                                </button>
                                            }
                                        />
                                        <Link href={`/courses/${course.id}`}>
                                            <button className="p-2 hover:bg-gray-50 transition-all" title="Voir">
                                                <Eye className="w-3.5 h-3.5 text-gray-400 hover:text-[#2563EB]" />
                                            </button>
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(course.id, course.title)}
                                            className="p-2 hover:bg-gray-50 transition-all"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer Summary */}
            <div className="mt-12 flex gap-8 items-center border-t border-gray-100 pt-8">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Total Cours</p>
                    <p className="text-2xl font-black italic tracking-tighter">{courses.length}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Publiés</p>
                    <p className="text-2xl font-black italic tracking-tighter text-[#2563EB]">
                        {courses.filter(c => c.status === 'ACTIVE').length}
                    </p>
                </div>
            </div>
        </div>
    )
}