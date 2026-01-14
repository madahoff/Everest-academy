"use client"

import * as React from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { Plus, Image, Video, FileText, Clock, GraduationCap } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload } from "@/components/ui/file-upload"

interface CourseFormData {
    title: string
    description: string
    heroImage: string
    cardImage: string
    welcomeVideo: string
    price: number
    duration: string
    level: string
    status: string
}

interface CourseFormDialogProps {
    onSuccess?: () => void
    trigger?: React.ReactNode
    editData?: CourseFormData & { id: string }
}

export function CourseFormDialog({ onSuccess, trigger, editData }: CourseFormDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const isEdit = !!editData

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CourseFormData>({
        defaultValues: editData || { status: "DRAFT", price: 0, duration: "Variable", level: "INTERMEDIATE" }
    })

    React.useEffect(() => {
        if (editData) {
            Object.entries(editData).forEach(([key, value]) => {
                setValue(key as keyof CourseFormData, value)
            })
        }
    }, [editData, setValue])

    const onSubmit = async (data: CourseFormData) => {
        setLoading(true)
        try {
            const url = isEdit ? `/api/courses/${editData.id}` : "/api/courses"
            const method = isEdit ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, price: parseFloat(String(data.price)) || 0 })
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
                    <button className="px-4 py-2 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest rounded-none flex items-center gap-2 hover:bg-[#2563EB] transition-all">
                        <Plus className="w-3 h-3" /> Nouveau Cours
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white border-none rounded-none shadow-2xl">
                <DialogHeader className="border-b border-gray-100 pb-6">
                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">
                        {isEdit ? "Modifier" : "Nouveau"} <span className="text-[#2563EB]">Cours</span>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-6">
                    {/* Section: Informations de base */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <FileText className="w-3 h-3" /> Informations de base
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Titre du cours <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                {...register("title", { required: "Le titre est obligatoire" })}
                                placeholder="Ex: Développement Web avec React"
                                className="h-12 rounded-none border-gray-200"
                            />
                            {errors.title && <p className="text-red-500 text-[10px]">{errors.title.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Description détaillée <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                {...register("description", { required: "La description est obligatoire" })}
                                placeholder="Décrivez le contenu et les objectifs du cours..."
                                className="min-h-[100px] rounded-none border-gray-200 resize-none"
                            />
                            {errors.description && <p className="text-red-500 text-[10px]">{errors.description.message}</p>}
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
                                    Image Card (petite) <span className="text-red-500">*</span>
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
                                <Video className="w-3 h-3" /> Vidéo de bienvenue <span className="text-red-500">*</span>
                            </Label>
                            <FileUpload
                                value={watch("welcomeVideo")}
                                onChange={(url) => setValue("welcomeVideo", url)}
                                type="video"
                                label="Vidéo de bienvenue"
                            />
                            <input type="hidden" {...register("welcomeVideo", { required: "La vidéo de bienvenue est obligatoire" })} />
                            {errors.welcomeVideo && <p className="text-red-500 text-[10px]">{errors.welcomeVideo.message}</p>}
                        </div>
                    </div>

                    {/* Section: Configuration */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Prix ( Ar) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    {...register("price", { required: "Le prix est obligatoire" })}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="99.00"
                                    className="h-12 rounded-none border-gray-200"
                                />
                                {errors.price && <p className="text-red-500 text-[10px]">{errors.price.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Durée
                                </Label>
                                <Input
                                    {...register("duration")}
                                    placeholder="Ex: 2h 30min, 5 semaines"
                                    className="h-12 rounded-none border-gray-200"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                    <GraduationCap className="w-3 h-3" /> Niveau
                                </Label>
                                <Select defaultValue={editData?.level || "INTERMEDIATE"} onValueChange={(v) => setValue("level", v)}>
                                    <SelectTrigger className="h-12 rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BEGINNER">Débutant</SelectItem>
                                        <SelectItem value="INTERMEDIATE">Intermédiaire</SelectItem>
                                        <SelectItem value="ADVANCED">Avancé</SelectItem>
                                        <SelectItem value="EXPERT">Expert</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    Statut
                                </Label>
                                <Select defaultValue={editData?.status || "DRAFT"} onValueChange={(v) => setValue("status", v)}>
                                    <SelectTrigger className="h-12 rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DRAFT">Brouillon</SelectItem>
                                        <SelectItem value="ACTIVE">Publié</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                            className="flex-1 py-3 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all disabled:opacity-50"
                        >
                            {loading ? "Enregistrement..." : isEdit ? "Sauvegarder" : "Créer le cours"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
