"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Plus, X } from "lucide-react"
import { VariableRichTextEditor } from "@/components/ui/variable-rich-text-editor"
import { useBulkEmailSender } from "@/hooks/use-bulk-email-sender"
import { toast } from "sonner"

interface BulkEmailDialogProps {
    open: boolean
    onClose: () => void
    rows: Record<string, string>[]
    headers: string[]
}

export function BulkEmailDialog({ open, onClose, rows, headers }: BulkEmailDialogProps) {
    const [subject, setSubject] = useState("")
    const [htmlBody, setHtmlBody] = useState("<p>Bonjour {nom},</p><p></p><p>Cordialement,<br/>Everest Academy</p>")
    const [manualEmail, setManualEmail] = useState("")
    const { send, sending, progress, result: sendResult, reset } = useBulkEmailSender()

    // Find email column
    const emailColumn = useMemo(() => {
        return headers.find(
            (h) => h.toLowerCase().includes("email") || h.toLowerCase().includes("mail")
        ) || ""
    }, [headers])

    // Build recipients list with selection state
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
    const [additionalEmails, setAdditionalEmails] = useState<string[]>([])

    useEffect(() => {
        if (open && emailColumn) {
            const emails = new Set<string>()
            rows.forEach((row) => {
                const email = row[emailColumn]
                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    emails.add(email)
                }
            })
            setSelectedEmails(emails)
            setAdditionalEmails([])
            reset()
        }
    }, [open, rows, emailColumn])

    const toggleEmail = (email: string) => {
        setSelectedEmails((prev) => {
            const next = new Set(prev)
            if (next.has(email)) next.delete(email)
            else next.add(email)
            return next
        })
    }

    const allEmails = useMemo(() => {
        const tableEmails: string[] = []
        if (emailColumn) {
            rows.forEach((row) => {
                const email = row[emailColumn]
                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    if (!tableEmails.includes(email)) tableEmails.push(email)
                }
            })
        }
        return [...tableEmails, ...additionalEmails]
    }, [rows, emailColumn, additionalEmails])

    const addManualEmail = () => {
        const email = manualEmail.trim()
        if (!email) return
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast.error("Format email invalide")
            return
        }
        if (selectedEmails.has(email) || additionalEmails.includes(email)) {
            toast.error("Email déjà dans la liste")
            return
        }
        setAdditionalEmails((prev) => [...prev, email])
        setSelectedEmails((prev) => new Set(prev).add(email))
        setManualEmail("")
    }

    const removeAdditionalEmail = (email: string) => {
        setAdditionalEmails((prev) => prev.filter((e) => e !== email))
        setSelectedEmails((prev) => {
            const next = new Set(prev)
            next.delete(email)
            return next
        })
    }

    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error("Le sujet est requis")
            return
        }

        if (!htmlBody || htmlBody === "<p></p>") {
            toast.error("Le corps du mail est requis")
            return
        }

        if (selectedEmails.size === 0) {
            toast.error("Aucun destinataire sélectionné")
            return
        }

        const recipientsArray = Array.from(selectedEmails).map((email) => {
            const row = rows.find((r) => r[emailColumn] === email)
            return { email, variables: row || {} }
        })

        await send(recipientsArray, subject, htmlBody)
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) onClose() }}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] rounded-none border-0 shadow-xl overflow-hidden flex flex-col">
                <DialogHeader className="border-b border-gray-100 pb-4 shrink-0">
                    <DialogTitle className="text-sm font-black uppercase tracking-[0.15em] text-[#050505]">
                        Envoi Groupé d&apos;Emails
                    </DialogTitle>
                    <DialogDescription className="text-[9px] uppercase tracking-widest text-gray-400">
                        Envoyer un email personnalisé à tous les destinataires sélectionnés
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-6">
                    {/* Recipients Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                                Destinataires ({selectedEmails.size} sélectionné{selectedEmails.size > 1 ? "s" : ""})
                            </Label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedEmails(new Set(allEmails))}
                                    className="text-[8px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline"
                                >
                                    Tout sélectionner
                                </button>
                                <button
                                    onClick={() => setSelectedEmails(new Set())}
                                    className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                                >
                                    Tout désélectionner
                                </button>
                            </div>
                        </div>

                        <ScrollArea className="h-[140px] border border-gray-200 bg-gray-50/50">
                            <div className="p-3 space-y-2">
                                {allEmails.map((email) => (
                                    <div key={email} className="flex items-center gap-3 group">
                                        <Checkbox
                                            checked={selectedEmails.has(email)}
                                            onCheckedChange={() => toggleEmail(email)}
                                            className="rounded-none"
                                        />
                                        <span className="text-xs text-gray-700 flex-1">{email}</span>
                                        {additionalEmails.includes(email) && (
                                            <button
                                                onClick={() => removeAdditionalEmail(email)}
                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {allEmails.length === 0 && (
                                    <p className="text-[9px] text-gray-400 text-center py-4 uppercase tracking-widest">
                                        Aucun email trouvé dans les données
                                    </p>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Add manual email */}
                        <div className="flex gap-2">
                            <Input
                                value={manualEmail}
                                onChange={(e) => setManualEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addManualEmail()}
                                placeholder="Ajouter un email manuellement..."
                                className="h-9 rounded-none border-gray-200 text-xs flex-1 focus:border-[#2563EB]"
                            />
                            <button
                                onClick={addManualEmail}
                                className="px-3 h-9 bg-gray-100 hover:bg-gray-200 transition flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                <span className="text-[8px] font-bold uppercase tracking-widest">Ajouter</span>
                            </button>
                        </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Sujet
                        </Label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Objet de l'email..."
                            className="h-10 rounded-none border-gray-200 text-sm focus:border-[#2563EB]"
                        />
                    </div>

                    {/* Rich Text Editor */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Corps du message
                        </Label>
                        <VariableRichTextEditor content={htmlBody} onChange={setHtmlBody} variables={headers} />
                    </div>

                    {/* Send Results */}
                    {sendResult && (
                        <div className="border border-gray-200 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#050505]">
                                Résumé de l&apos;envoi
                            </p>
                            <div className="flex gap-4">
                                <span className="text-xs text-green-600 font-bold">
                                    ✓ {sendResult.sent} envoyé{sendResult.sent > 1 ? "s" : ""}
                                </span>
                                {sendResult.failed.length > 0 && (
                                    <span className="text-xs text-red-500 font-bold">
                                        ✗ {sendResult.failed.length} échoué{sendResult.failed.length > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            {sendResult.failed.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {sendResult.failed.map((f, i) => (
                                        <p key={i} className="text-[9px] text-red-500">
                                            {f.email}: {f.error}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4 gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border border-gray-200 hover:border-[#050505] transition-all disabled:opacity-50"
                    >
                        Fermer
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || selectedEmails.size === 0}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {progress
                                    ? `Envoi en cours (${progress.current}/${progress.total})...`
                                    : "Envoi en cours..."}
                            </>
                        ) : (
                            <>
                                <Send className="w-3 h-3" />
                                Envoyer à {selectedEmails.size} personne{selectedEmails.size > 1 ? "s" : ""}
                            </>
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
