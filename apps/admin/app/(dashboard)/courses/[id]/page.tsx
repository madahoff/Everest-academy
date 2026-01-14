"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
    ArrowLeft,
    Edit3,
    Trash2,
    Play,
    Image as ImageIcon,
    Layers,
    HelpCircle,
    ChevronDown,
    ChevronRight,
    GripVertical,
    Loader2,
    CheckCircle,
    Circle,
    Video,
    FileText
} from "lucide-react"
import { SectionFormDialog } from "@/components/dialogs/section-form-dialog"
import { QuestionFormDialog } from "@/components/dialogs/question-form-dialog"
import { AccessCodeManager } from "@/components/access-code-manager"
import * as React from "react"

// --- TYPES ---
interface Answer {
    id: string
    text: string
    isCorrect: boolean
    order: number
}

interface Question {
    id: string
    text: string
    order: number
    answers: Answer[]
}

interface Section {
    id: string
    title: string
    description: string
    heroImage: string
    cardImage: string
    video: string
    summary: string
    order: number
    questions: Question[]
}

interface Course {
    id: string
    title: string
    description: string
    heroImage: string
    cardImage: string
    welcomeVideo: string
    price: string | number
    status: "ACTIVE" | "DRAFT"
    salesCount: number
    sections: Section[]
}

// --- COMPOSANT PRINCIPAL ---

export default function CourseDetailPage() {
    const params = useParams()
    const courseId = params.id as string
    const queryClient = useQueryClient()
    const [expandedSections, setExpandedSections] = React.useState<string[]>([])

    const { data: course, isLoading, error } = useQuery<Course>({
        queryKey: ["course", courseId],
        queryFn: async () => {
            const res = await fetch(`/api/courses/${courseId}`)
            if (!res.ok) throw new Error("Course not found")
            return res.json()
        }
    })

    const deleteSectionMutation = useMutation({
        mutationFn: async (sectionId: string) => {
            const res = await fetch(`/api/sections/${sectionId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed")
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["course", courseId] })
    })

    const deleteQuestionMutation = useMutation({
        mutationFn: async (questionId: string) => {
            const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed")
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["course", courseId] })
    })

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["course", courseId] })
    }

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        )
    }

    const formatPrice = (price: string | number) => {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price
        return numPrice === 0 ? 'Gratuit' : `${numPrice.toFixed(2)}  Ar`
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
            </div>
        )
    }

    if (error || !course) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
                <p className="text-red-500 font-bold mb-4">Cours introuvable</p>
                <Link href="/courses" className="text-[#2563EB] text-sm font-bold uppercase tracking-widest hover:underline">
                    Retour aux cours
                </Link>
            </div>
        )
    }

    return (
        <div className="flex-1 bg-white min-h-screen font-sans text-[#050505]">
            {/* Hero Banner */}
            <div className="relative h-64 bg-[#050505] overflow-hidden">
                {course.heroImage && (
                    <img
                        src={course.heroImage}
                        alt={course.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />

                <div className="relative h-full max-w-6xl mx-auto px-8 flex flex-col justify-end pb-8">
                    <Link href="/courses" className="absolute top-6 left-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest">
                        <ArrowLeft className="w-4 h-4" /> Retour aux cours
                    </Link>

                    <div className="flex items-end justify-between">
                        <div>
                            <span className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest mb-3 inline-block ${course.status === 'ACTIVE' ? 'bg-green-500 text-white' : 'bg-white/20 text-white'
                                }`}>
                                {course.status === 'ACTIVE' ? 'Publié' : 'Brouillon'}
                            </span>
                            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
                                {course.title}
                            </h1>
                        </div>
                        <div className="text-right text-white">
                            <p className="text-3xl font-black">{formatPrice(course.price)}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                                {course.salesCount} ventes
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 py-10">
                {/* Course Info */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
                    <div className="lg:col-span-2">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Description</h2>
                        <p className="text-sm text-gray-600 leading-relaxed">{course.description}</p>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Médias</h2>

                        {course.welcomeVideo && (
                            <a href={course.welcomeVideo} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-[#2563EB] hover:text-white transition-all group">
                                <Play className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Vidéo de bienvenue</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* Sections */}
                <div className="border-t border-gray-100 pt-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Layers className="w-5 h-5 text-[#2563EB]" />
                            <h2 className="text-xl font-black uppercase tracking-tighter">
                                Sections <span className="text-gray-300">({course.sections.length})</span>
                            </h2>
                        </div>
                        <SectionFormDialog courseId={courseId} onSuccess={handleRefresh} />
                    </div>

                    {course.sections.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-gray-200">
                            <Layers className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                            <p className="text-gray-400 text-sm font-bold mb-4">Aucune section</p>
                            <div className="flex justify-center">
                                <SectionFormDialog courseId={courseId} onSuccess={handleRefresh} />
                            </div>

                        </div>
                    ) : (
                        <div className="space-y-4">
                            {course.sections.map((section, index) => (
                                <div key={section.id} className="border border-gray-100 bg-white overflow-hidden">
                                    {/* Section Header */}
                                    <div
                                        className="flex items-center gap-4 p-5 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => toggleSection(section.id)}
                                    >
                                        <GripVertical className="w-4 h-4 text-gray-300" />

                                        <div className="w-16 h-12 bg-gray-200 rounded-none overflow-hidden flex-shrink-0">
                                            {section.cardImage ? (
                                                <img src={section.cardImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageIcon className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-[#2563EB] uppercase">Section {index + 1}</span>
                                                {section.questions.length > 0 && (
                                                    <span className="text-[8px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5">
                                                        {section.questions.length} QCM
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-sm uppercase tracking-tight">{section.title}</h3>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <SectionFormDialog
                                                courseId={courseId}
                                                onSuccess={handleRefresh}
                                                editData={section}
                                                trigger={
                                                    <button
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                }
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteSectionMutation.mutate(section.id) }} className="p-2 text-gray-300 hover:text-red-500 transition-colors"                                                >                                                    <Trash2 className="w-4 h-4" />                                                </button>                                                {expandedSections.includes(section.id) ? (<ChevronDown className="w-5 h-5 text-gray-400" />) : (<ChevronRight className="w-5 h-5 text-gray-400" />)}                                            </div>
                                    </div>

                                    {/* Section Content (Expanded) */}
                                    {expandedSections.includes(section.id) && (
                                        <div className="p-6 border-t border-gray-100 space-y-6">
                                            {/* Description & Summary */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Description</h4>
                                                    <p className="text-xs text-gray-600">{section.description}</p>
                                                </div>
                                                <div className="bg-gray-50 p-4">
                                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1">
                                                        <FileText className="w-3 h-3" /> Résumé
                                                    </h4>
                                                    <div
                                                        className="text-xs text-gray-600 rich-text max-w-none"
                                                        dangerouslySetInnerHTML={{ __html: section.summary }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Video Link */}
                                            {section.video && (
                                                <a href={section.video} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#050505] text-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all">
                                                    <Video className="w-3 h-3" /> Voir la vidéo
                                                </a>
                                            )}

                                            {/* Questions */}
                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                        <HelpCircle className="w-3 h-3" /> Questions QCM ({section.questions.length})
                                                    </h4>
                                                    <QuestionFormDialog sectionId={section.id} onSuccess={handleRefresh} />
                                                </div>

                                                {section.questions.length === 0 ? (
                                                    <p className="text-[10px] text-gray-400 text-center py-4">Aucune question QCM</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {section.questions.map((question, qIndex) => (
                                                            <div key={question.id} className="bg-gray-50 p-4">
                                                                <div className="flex items-start justify-between mb-3">
                                                                    <p className="text-xs font-bold">
                                                                        <span className="text-[#2563EB]">Q{qIndex + 1}.</span> {question.text}
                                                                    </p>
                                                                    <button
                                                                        onClick={() => deleteQuestionMutation.mutate(question.id)}
                                                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {question.answers.map((answer) => (
                                                                        <div key={answer.id} className={`flex items-center gap-2 text-[10px] p-2 ${answer.isCorrect ? 'bg-green-50 text-green-700' : 'bg-white text-gray-600'
                                                                            }`}>
                                                                            {answer.isCorrect ? (
                                                                                <CheckCircle className="w-3 h-3" />
                                                                            ) : (
                                                                                <Circle className="w-3 h-3 text-gray-300" />
                                                                            )}
                                                                            {answer.text}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Access Codes Section */}
                <div className="border-t border-gray-100 pt-10 mt-10">
                    <AccessCodeManager courseId={courseId} />
                </div>
            </div>
        </div>
    )
}
