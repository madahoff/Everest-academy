"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save } from "lucide-react"

interface EditRowDialogProps {
    open: boolean
    onClose: () => void
    headers: string[]
    row: Record<string, string>
    onSave: (updatedRow: Record<string, string>) => void
}

export function EditRowDialog({ open, onClose, headers, row, onSave }: EditRowDialogProps) {
    const [values, setValues] = useState<Record<string, string>>({ ...row })
    const [saving, setSaving] = useState(false)

    const handleSave = () => {
        setSaving(true)
        // Sanitize values
        const sanitized: Record<string, string> = {}
        for (const [key, value] of Object.entries(values)) {
            sanitized[key] = value.trim()
        }
        onSave(sanitized)
        setSaving(false)
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-[600px] rounded-none border-0 shadow-xl">
                <DialogHeader className="border-b border-gray-100 pb-4">
                    <DialogTitle className="text-sm font-black uppercase tracking-[0.15em] text-[#050505]">
                        Modifier la ligne
                    </DialogTitle>
                    <DialogDescription className="text-[9px] uppercase tracking-widest text-gray-400">
                        Modifiez les valeurs ci-dessous et sauvegardez
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto py-4 space-y-4">
                    {headers.map((header) => (
                        <div key={header} className="space-y-1.5">
                            <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                                {header}
                            </Label>
                            <Input
                                value={values[header] || ""}
                                onChange={(e) =>
                                    setValues((prev) => ({ ...prev, [header]: e.target.value }))
                                }
                                className="h-10 rounded-none border-gray-200 text-sm focus:border-[#2563EB] focus:ring-[#2563EB]/20 transition-colors"
                            />
                        </div>
                    ))}
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4 gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border border-gray-200 hover:border-[#050505] transition-all"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest bg-[#050505] text-white hover:bg-[#2563EB] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Sauvegarder
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
