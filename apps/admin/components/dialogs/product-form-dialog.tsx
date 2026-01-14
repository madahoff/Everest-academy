"use client"

import * as React from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProductFormData { name: string; category: string; price: number; stock: number }

export function ProductFormDialog({ onSuccess, trigger }: { onSuccess?: () => void; trigger?: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ProductFormData>({
        defaultValues: { category: "Livre", price: 0, stock: 0 }
    })

    const onSubmit = async (data: ProductFormData) => {
        setLoading(true)
        try {
            const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, price: parseFloat(String(data.price)) || 0, stock: parseInt(String(data.stock)) || 0 }) })
            if (!res.ok) throw new Error((await res.json()).error || "Failed")
            reset(); setOpen(false); onSuccess?.()
        } catch (error) { toast.error(error instanceof Error ? error.message : "Erreur") }
        finally { setLoading(false) }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <button className="px-5 py-2.5 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-none flex items-center gap-2 hover:bg-[#2563EB] transition-all"><Plus className="w-4 h-4" /> Ajouter au stock</button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white border-none rounded-none shadow-2xl">
                <DialogHeader className="border-b border-gray-100 pb-6"><DialogTitle className="text-lg font-black uppercase tracking-tighter">Nouveau <span className="text-[#2563EB]">Produit</span></DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nom</Label>
                        <Input {...register("name", { required: "Requis" })} placeholder="Design Handbook" className="h-12 rounded-none border-gray-200" />
                        {errors.name && <p className="text-red-500 text-[10px]">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Catégorie</Label>
                        <Select defaultValue="Livre" onValueChange={(v) => setValue("category", v)}><SelectTrigger className="h-12 rounded-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Livre">Livre</SelectItem><SelectItem value="Ebook">Ebook</SelectItem><SelectItem value="Asset">Asset</SelectItem><SelectItem value="Merch">Merch</SelectItem></SelectContent></Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Prix ( Ar)</Label>
                            <Input {...register("price")} type="number" step="0.01" min="0" placeholder="29.99" className="h-12 rounded-none border-gray-200" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock</Label>
                            <Input {...register("stock")} type="number" min="0" placeholder="50" className="h-12 rounded-none border-gray-200" />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-widest">Annuler</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">{loading ? "Création..." : "Ajouter"}</button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
