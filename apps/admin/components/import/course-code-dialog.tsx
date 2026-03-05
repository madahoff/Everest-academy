"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, KeyRound, BookOpen } from "lucide-react"
import { toast } from "sonner"

interface Course {
    id: string
    title: string
    status: string
}

interface CourseCodeDialogProps {
    open: boolean
    onClose: () => void
    rowCount: number
    onCodesGenerated: (codes: string[]) => void
}

export function CourseCodeDialog({ open, onClose, rowCount, onCodesGenerated }: CourseCodeDialogProps) {
    const [courses, setCourses] = useState<Course[]>([])
    const [selectedCourseId, setSelectedCourseId] = useState("")
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        if (open) {
            setLoading(true)
            fetch("/api/courses")
                .then((res) => res.json())
                .then((data) => {
                    setCourses(Array.isArray(data) ? data : data.courses || [])
                })
                .catch(() => toast.error("Impossible de charger les cours"))
                .finally(() => setLoading(false))
        }
    }, [open])

    const handleGenerate = async () => {
        if (!selectedCourseId) {
            toast.error("Sélectionnez un cours")
            return
        }

        setGenerating(true)
        try {
            const res = await fetch("/api/import/generate-codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId: selectedCourseId, count: rowCount }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            onCodesGenerated(data.codes)
            toast.success(`${data.count} codes générés pour "${data.courseTitle}"`)
            onClose()
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de la génération")
        } finally {
            setGenerating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-[500px] rounded-none border-0 shadow-xl">
                <DialogHeader className="border-b border-gray-100 pb-4">
                    <DialogTitle className="text-sm font-black uppercase tracking-[0.15em] text-[#050505] flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-[#2563EB]" />
                        Générer des Codes d&apos;Accès
                    </DialogTitle>
                    <DialogDescription className="text-[9px] uppercase tracking-widest text-gray-400">
                        Un code unique sera généré pour chaque personne ({rowCount} codes)
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Sélectionner un cours
                        </Label>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="border border-dashed border-gray-200 p-6 text-center">
                                <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Aucun cours disponible
                                </p>
                                <p className="text-[9px] text-gray-300 mt-1">
                                    Créez d&apos;abord un cours dans le catalogue
                                </p>
                            </div>
                        ) : (
                            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                                <SelectTrigger className="h-12 rounded-none border-gray-200 text-sm focus:border-[#2563EB]">
                                    <SelectValue placeholder="Choisir un cours..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {courses.map((course) => (
                                        <SelectItem key={course.id} value={course.id} className="rounded-none">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-3 h-3 text-[#2563EB]" />
                                                <span>{course.title}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {selectedCourseId && (
                        <div className="bg-gray-50 border border-gray-200 p-4">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">
                                Résumé de l&apos;opération
                            </p>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-700">
                                    • <strong>{rowCount}</strong> codes uniques seront générés
                                </p>
                                <p className="text-xs text-gray-700">
                                    • Format : <code className="bg-white px-1.5 py-0.5 text-[#2563EB] font-mono text-[10px]">EVEREST-XXXX-XXXX</code>
                                </p>
                                <p className="text-xs text-gray-700">
                                    • La colonne &quot;Code&quot; sera ajoutée au tableau
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4 gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border border-gray-200 hover:border-[#050505] transition-all"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !selectedCourseId || courses.length === 0}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest bg-[#050505] text-white hover:bg-[#2563EB] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                        Générer {rowCount} Codes
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
