"use client"

import * as React from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { UserPlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserFormData { name: string; email: string; role: string; plan: string }

export function UserFormDialog({ onSuccess, trigger }: { onSuccess?: () => void; trigger?: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UserFormData>({
        defaultValues: { role: "STUDENT", plan: "FREE" }
    })

    const onSubmit = async (data: UserFormData) => {
        setLoading(true)
        try {
            const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
            if (!res.ok) throw new Error((await res.json()).error || "Failed")
            reset(); setOpen(false); onSuccess?.()
        } catch (error) { toast.error(error instanceof Error ? error.message : "Erreur") }
        finally { setLoading(false) }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <button className="px-6 py-3 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#2563EB] transition-all flex items-center gap-2"><UserPlus className="w-4 h-4" /> Inviter un Utilisateur</button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white border-none rounded-none shadow-2xl">
                <DialogHeader className="border-b border-gray-100 pb-6"><DialogTitle className="text-lg font-black uppercase tracking-tighter">Nouvel <span className="text-[#2563EB]">Utilisateur</span></DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nom Complet</Label>
                        <Input {...register("name", { required: "Requis" })} placeholder="Jean Dupont" className="h-12 rounded-none border-gray-200" />
                        {errors.name && <p className="text-red-500 text-[10px]">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email</Label>
                        <Input {...register("email", { required: "Requis", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email invalide" } })} type="email" placeholder="jean@example.com" className="h-12 rounded-none border-gray-200" />
                        {errors.email && <p className="text-red-500 text-[10px]">{errors.email.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rôle</Label>
                            <Select defaultValue="STUDENT" onValueChange={(v) => setValue("role", v)}><SelectTrigger className="h-12 rounded-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="STUDENT">Étudiant</SelectItem><SelectItem value="INSTRUCTOR">Instructeur</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Plan</Label>
                            <Select defaultValue="FREE" onValueChange={(v) => setValue("plan", v)}><SelectTrigger className="h-12 rounded-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FREE">Gratuit</SelectItem><SelectItem value="PREMIUM">Premium</SelectItem></SelectContent></Select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-widest">Annuler</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">{loading ? "Création..." : "Créer"}</button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
