"use client"

import * as React from "react"
import { toast } from "sonner"
import { useForm, Controller } from "react-hook-form"
import { Plus, Image, Video, FileText, BookOpen } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileUpload } from "@/components/ui/file-upload"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

interface SectionFormData {
    title: string
    description: string
    heroImage: string
    cardImage: string
    video: string
    summary: string
}

interface SectionFormDialogProps {
    courseId: string
    onSuccess?: () => void
    trigger?: React.ReactNode
    editData?: SectionFormData & { id: string }
}

export function SectionFormDialog({ courseId, onSuccess, trigger, editData }: SectionFormDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const isEdit = !!editData

    const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<SectionFormData>({
        defaultValues: editData || {
            summary: "", // Ensure default value for rich text
        }
    })

    React.useEffect(() => {
        if (editData) {
            Object.entries(editData).forEach(([key, value]) => {
                setValue(key as keyof SectionFormData, value)
            })
        }
    }, [editData, setValue])

    const onSubmit = async (data: SectionFormData) => {
        setLoading(true)
        try {
            const url = isEdit ? `/api/sections/${editData.id}` : `/api/courses/${courseId}/sections`
            const method = isEdit ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Échec de l'opération")
            }

            if (!isEdit) reset()
            setOpen(false)
            onSuccess?.()
        } catch (error) { toast.error(error instanceof Error ? error.message : "Erreur") }
        finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="px-4 py-2 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-widest rounded-none flex items-center gap-2 hover:bg-[#001F3F] transition-all">
                        <Plus className="w-3 h-3" /> Nouvelle Section
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-white border-none rounded-none shadow-2xl">
                <DialogHeader className="border-b border-gray-100 pb-6">
                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">
                        {isEdit ? "Modifier" : "Nouvelle"} <span className="text-[#2563EB]">Section</span>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-6">
                    {/* Section: Informations */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <BookOpen className="w-3 h-3" /> Contenu pédagogique
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Titre de la section <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                {...register("title", { required: "Le titre est obligatoire" })}
                                placeholder="Ex: Introduction aux composants React"
                                className="h-12 rounded-none border-gray-200"
                            />
                            {errors.title && <p className="text-red-500 text-[10px]">{errors.title.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Description <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                {...register("description", { required: "La description est obligatoire" })}
                                placeholder="Décrivez le contenu de cette section..."
                                className="min-h-[80px] rounded-none border-gray-200 resize-none"
                            />
                            {errors.description && <p className="text-red-500 text-[10px]">{errors.description.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                <FileText className="w-3 h-3 inline mr-1" /> Résumé et Contenu Détaillé <span className="text-red-500">*</span>
                            </Label>
                            <div className="min-h-[200px]">
                                <Controller
                                    name="summary"
                                    control={control}
                                    rules={{ required: "Le résumé est obligatoire" }}
                                    render={({ field }) => (
                                        <RichTextEditor
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            placeholder="Rédigez le contenu détaillé, ajoutez des titres, des images..."
                                        />
                                    )}
                                />
                            </div>
                            {errors.summary && <p className="text-red-500 text-[10px]">{errors.summary.message}</p>}
                        </div>
                    </div>

                    {/* Section: Médias */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <Image className="w-3 h-3" /> Médias
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Image Hero (grande) <span className="text-red-500">*</span>
                                </Label>
                                <FileUpload
                                    value={watch("heroImage")}
                                    onChange={(url) => setValue("heroImage", url)}
                                    type="hero"
                                    label="Image Hero"
                                />
                                <input type="hidden" {...register("heroImage", { required: "L'image hero est obligatoire" })} />
                                {errors.heroImage && <p className="text-red-500 text-[10px]">{errors.heroImage.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Image Card (moyenne) <span className="text-red-500">*</span>
                                </Label>
                                <FileUpload
                                    value={watch("cardImage")}
                                    onChange={(url) => setValue("cardImage", url)}
                                    type="card"
                                    label="Image Carte"
                                />
                                <input type="hidden" {...register("cardImage", { required: "L'image card est obligatoire" })} />
                                {errors.cardImage && <p className="text-red-500 text-[10px]">{errors.cardImage.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <Video className="w-3 h-3" /> Vidéo pédagogique <span className="text-red-500">*</span>
                            </Label>
                            <FileUpload
                                value={watch("video")}
                                onChange={(url) => setValue("video", url)}
                                type="video"
                                label="Vidéo pédagogique"
                            />
                            <input type="hidden" {...register("video", { required: "La vidéo est obligatoire" })} />
                            {errors.video && <p className="text-red-500 text-[10px]">{errors.video.message}</p>}
                        </div>
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
                            {loading ? "Enregistrement..." : isEdit ? "Sauvegarder" : "Créer la section"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
