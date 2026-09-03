"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarPlus, Globe, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fromLocalInput, monthKeyOf, monthLabel, toLocalInput } from "@/lib/masterclass-month"
import { parsePriceEur } from "@/lib/pricing"

export interface MasterclassRow {
    id: string
    monthKey: string
    title: string
    description: string
    instructor: string
    scheduledAt: string
    duration: string | null
    location: string | null
    coverImage: string | null
    price: number
    priceEur: number | null
    capacity: number | null
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
    isNext: boolean
    registrationCount: number
    confirmedCount: number
    pendingCount: number
    seatsLeft: number | null
    revenue: number
}

/** Champs du formulaire, tous en chaînes : ce que rend un `<input>`. */
interface FormState {
    title: string
    description: string
    instructor: string
    scheduledAt: string
    duration: string
    location: string
    price: string
    priceEur: string
    capacity: string
    status: MasterclassRow["status"]
}

const EMPTY: FormState = {
    title: "",
    description: "",
    instructor: "",
    scheduledAt: "",
    duration: "",
    location: "",
    price: "0",
    priceEur: "",
    capacity: "",
    status: "DRAFT",
}

const label = "text-[10px] font-bold uppercase tracking-widest text-gray-400"
const field = "h-12 rounded-none border-gray-200"

/**
 * Programmation d'une séance mensuelle.
 *
 * Le mois de rattachement n'est pas saisi : il se DÉDUIT de la date de la séance.
 * Deux champs pour une même information ouvriraient la porte à une incohérence — une
 * séance de septembre rangée en octobre disparaîtrait de la vitrine.
 *
 * L'heure est saisie et relue en heure de Madagascar, quel que soit le fuseau du
 * navigateur : c'est celle qui sera annoncée aux inscrits.
 */
export function MasterclassFormDialog({
    masterclass,
    onSuccess,
    trigger,
}: {
    masterclass?: MasterclassRow
    onSuccess?: () => void
    trigger?: React.ReactNode
}) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [form, setForm] = React.useState(EMPTY)
    const [error, setError] = React.useState<string | null>(null)

    // Rempli à l'ouverture seulement : rouvrir après une modification doit repartir
    // des valeurs enregistrées, pas d'une saisie abandonnée.
    React.useEffect(() => {
        if (!open) return
        setError(null)
        setForm(
            masterclass
                ? {
                      title: masterclass.title,
                      description: masterclass.description,
                      instructor: masterclass.instructor,
                      scheduledAt: toLocalInput(masterclass.scheduledAt),
                      duration: masterclass.duration ?? "",
                      location: masterclass.location ?? "",
                      price: String(masterclass.price),
                      priceEur: masterclass.priceEur === null ? "" : String(masterclass.priceEur),
                      capacity: masterclass.capacity === null ? "" : String(masterclass.capacity),
                      status: masterclass.status,
                  }
                : EMPTY,
        )
    }, [open, masterclass])

    const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

    const scheduled = form.scheduledAt ? fromLocalInput(form.scheduledAt) : null

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        if (!scheduled) {
            setError("La date et l'heure de la séance sont obligatoires")
            return
        }
        const eur = parsePriceEur(form.priceEur.trim())
        if ("error" in eur) {
            setError(eur.error)
            return
        }

        setLoading(true)
        try {
            const res = await fetch(masterclass ? `/api/masterclass/${masterclass.id}` : "/api/masterclass", {
                method: masterclass ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: form.title,
                    description: form.description,
                    instructor: form.instructor,
                    // Envoyée en ISO : le serveur n'a aucun fuseau à deviner.
                    scheduledAt: scheduled.toISOString(),
                    duration: form.duration,
                    location: form.location,
                    price: Number(form.price) || 0,
                    priceEur: eur.value,
                    capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
                    status: form.status,
                }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || "Échec de l'enregistrement")

            toast.success(masterclass ? "Masterclass mise à jour" : "Masterclass programmée")
            setOpen(false)
            onSuccess?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="px-5 py-2.5 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-none flex items-center gap-2 hover:bg-[#2563EB] transition-all">
                        <CalendarPlus className="w-4 h-4" /> Programmer une séance
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto bg-white border-none rounded-none shadow-2xl">
                <DialogHeader className="border-b border-gray-100 pb-6">
                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">
                        {masterclass ? "Modifier la" : "Nouvelle"} <span className="text-[#2563EB]">Masterclass</span>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={submit} className="space-y-6 pt-6">
                    <div className="space-y-2">
                        <Label className={label}>Titre</Label>
                        <Input
                            value={form.title}
                            onChange={(e) => set("title")(e.target.value)}
                            required
                            placeholder="Rhétorique de crise"
                            className={field}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className={label}>Description</Label>
                        <Textarea
                            value={form.description}
                            onChange={(e) => set("description")(e.target.value)}
                            required
                            rows={4}
                            placeholder="Ce que la séance apporte, en quelques phrases."
                            className="rounded-none border-gray-200"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className={label}>Formateur</Label>
                            <Input
                                value={form.instructor}
                                onChange={(e) => set("instructor")(e.target.value)}
                                required
                                placeholder="Avo Razafindrazaka"
                                className={field}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className={label}>Durée annoncée</Label>
                            <Input
                                value={form.duration}
                                onChange={(e) => set("duration")(e.target.value)}
                                placeholder="2h30"
                                className={field}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className={label}>Date et heure (heure de Madagascar)</Label>
                            <Input
                                type="datetime-local"
                                value={form.scheduledAt}
                                onChange={(e) => set("scheduledAt")(e.target.value)}
                                required
                                className={field}
                            />
                            {/* Le mois de rattachement se lit ici plutôt que de se saisir. */}
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB]">
                                {scheduled ? `Masterclass de ${monthLabel(monthKeyOf(scheduled))}` : "Mois déduit de la date"}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label className={label}>Lieu ou lien d'accès</Label>
                            <Input
                                value={form.location}
                                onChange={(e) => set("location")(e.target.value)}
                                placeholder="En ligne (Zoom) / Antananarivo"
                                className={field}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className={label}>Tarif (Ar)</Label>
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                value={form.price}
                                onChange={(e) => set("price")(e.target.value)}
                                className={field}
                            />
                            <p className="text-[9px] text-gray-400">0 = séance offerte</p>
                        </div>
                        {/* Vide : la séance n'est pas proposée hors de Madagascar. */}
                        <div className="space-y-2">
                            <Label className={`${label} flex items-center gap-1.5`}>
                                <Globe className="w-3 h-3" /> Tarif (€)
                            </Label>
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                value={form.priceEur}
                                onChange={(e) => set("priceEur")(e.target.value)}
                                placeholder="—"
                                className={field}
                            />
                            <p className="text-[9px] text-gray-400">Vide = non vendue à l'étranger</p>
                        </div>
                        <div className="space-y-2">
                            <Label className={label}>Places</Label>
                            <Input
                                type="number"
                                step="1"
                                min="1"
                                value={form.capacity}
                                onChange={(e) => set("capacity")(e.target.value)}
                                placeholder="—"
                                className={field}
                            />
                            <p className="text-[9px] text-gray-400">Vide = illimité</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className={label}>Statut</Label>
                        <Select value={form.status} onValueChange={(v) => set("status")(v)}>
                            <SelectTrigger className="h-12 rounded-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DRAFT">Brouillon — invisible du public</SelectItem>
                                <SelectItem value="PUBLISHED">Publiée — ouverte aux inscriptions</SelectItem>
                                <SelectItem value="ARCHIVED">Archivée — séance passée</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <p className="p-3 border border-red-200 bg-red-50 text-[11px] font-medium text-red-600">{error}</p>
                    )}

                    <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-6 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-[0.2em] hover:border-[#050505] transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-[#050505] text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-[#2563EB] transition-all disabled:opacity-50"
                        >
                            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {masterclass ? "Enregistrer" : "Programmer"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
