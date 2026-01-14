"use client"

import * as React from "react"
import { Plus, Trash2, CheckCircle, Circle, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Answer {
    text: string
    isCorrect: boolean
}

interface QuestionFormDialogProps {
    sectionId: string
    onSuccess?: () => void
    trigger?: React.ReactNode
    editData?: { id: string; text: string; answers: Answer[] }
}

export function QuestionFormDialog({ sectionId, onSuccess, trigger, editData }: QuestionFormDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [questionText, setQuestionText] = React.useState(editData?.text || "")
    const [answers, setAnswers] = React.useState<Answer[]>(
        editData?.answers || [
            { text: "", isCorrect: false },
            { text: "", isCorrect: false }
        ]
    )
    const isEdit = !!editData

    React.useEffect(() => {
        if (editData) {
            setQuestionText(editData.text)
            setAnswers(editData.answers)
        }
    }, [editData])

    const addAnswer = () => {
        setAnswers([...answers, { text: "", isCorrect: false }])
    }

    const removeAnswer = (index: number) => {
        if (answers.length <= 2) return // Minimum 2 réponses
        setAnswers(answers.filter((_, i) => i !== index))
    }

    const updateAnswer = (index: number, field: keyof Answer, value: any) => {
        const newAnswers = [...answers]
        newAnswers[index] = { ...newAnswers[index], [field]: value }
        setAnswers(newAnswers)
    }

    const toggleCorrect = (index: number) => {
        const newAnswers = [...answers]
        newAnswers[index].isCorrect = !newAnswers[index].isCorrect
        setAnswers(newAnswers)
    }

    const validate = (): string | null => {
        if (!questionText.trim()) return "Le texte de la question est obligatoire"
        if (answers.some(a => !a.text.trim())) return "Toutes les réponses doivent avoir un texte"
        if (!answers.some(a => a.isCorrect)) return "Au moins une réponse correcte est requise"
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const error = validate()
        if (error) {
            alert(error)
            return
        }

        setLoading(true)
        try {
            const url = isEdit ? `/api/questions/${editData.id}` : `/api/sections/${sectionId}/questions`
            const method = isEdit ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: questionText, answers })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Échec de l'opération")
            }

            if (!isEdit) {
                setQuestionText("")
                setAnswers([{ text: "", isCorrect: false }, { text: "", isCorrect: false }])
            }
            setOpen(false)
            onSuccess?.()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[9px] font-bold uppercase tracking-widest rounded-none flex items-center gap-1.5 hover:bg-[#2563EB] hover:text-white transition-all">
                        <HelpCircle className="w-3 h-3" /> Ajouter QCM
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white border-none rounded-none shadow-2xl">
                <DialogHeader className="border-b border-gray-100 pb-6">
                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">
                        {isEdit ? "Modifier" : "Nouvelle"} <span className="text-[#2563EB]">Question QCM</span>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-6">
                    {/* Question */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Question <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Posez votre question ici..."
                            className="min-h-[80px] rounded-none border-gray-200 resize-none"
                        />
                    </div>

                    {/* Réponses */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Réponses <span className="text-red-500">*</span> <span className="text-gray-300">(min. 2)</span>
                            </Label>
                            <button
                                type="button"
                                onClick={addAnswer}
                                className="text-[9px] font-bold uppercase tracking-widest text-[#2563EB] hover:text-[#001F3F] flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Ajouter
                            </button>
                        </div>

                        <div className="space-y-3">
                            {answers.map((answer, index) => (
                                <div key={index} className="flex items-center gap-3 group">
                                    {/* Toggle correct */}
                                    <button
                                        type="button"
                                        onClick={() => toggleCorrect(index)}
                                        className={`p-2 transition-all ${answer.isCorrect ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
                                        title={answer.isCorrect ? "Bonne réponse" : "Marquer comme correcte"}
                                    >
                                        {answer.isCorrect ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                    </button>

                                    {/* Answer text */}
                                    <Input
                                        value={answer.text}
                                        onChange={(e) => updateAnswer(index, "text", e.target.value)}
                                        placeholder={`Réponse ${index + 1}`}
                                        className="h-11 rounded-none border-gray-200 flex-1"
                                    />

                                    {/* Delete */}
                                    {answers.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeAnswer(index)}
                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <p className="text-[9px] text-gray-400">
                            Cliquez sur le cercle pour marquer une réponse comme correcte (une ou plusieurs)
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex-1 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:border-[#050505] transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#001F3F] transition-all disabled:opacity-50"
                        >
                            {loading ? "Enregistrement..." : isEdit ? "Sauvegarder" : "Créer la question"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
