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
import { Loader2, Send, Plus, X, Variable } from "lucide-react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Color from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { toast } from "sonner"

interface BulkEmailDialogProps {
    open: boolean
    onClose: () => void
    rows: Record<string, string>[]
    headers: string[]
}

export function BulkEmailDialog({ open, onClose, rows, headers }: BulkEmailDialogProps) {
    const [subject, setSubject] = useState("")
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState<{ sent: number; failed: { email: string; error: string }[] } | null>(null)
    const [manualEmail, setManualEmail] = useState("")

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
            setSendResult(null)
            setSending(false)
        }
    }, [open, rows, emailColumn])

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
        ],
        content: "<p>Bonjour {nom},</p><p></p><p>Cordialement,<br/>Everest Academy</p>",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4",
            },
        },
    })

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

    const insertVariable = (variable: string) => {
        editor?.chain().focus().insertContent(`{${variable}}`).run()
    }

    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error("Le sujet est requis")
            return
        }

        const htmlBody = editor?.getHTML() || ""
        if (!htmlBody || htmlBody === "<p></p>") {
            toast.error("Le corps du mail est requis")
            return
        }

        if (selectedEmails.size === 0) {
            toast.error("Aucun destinataire sélectionné")
            return
        }

        setSending(true)
        setSendResult(null)

        try {
            // Build recipients with their row data for variable replacement
            const recipients = Array.from(selectedEmails).map((email) => {
                const row = rows.find((r) => r[emailColumn] === email)
                return { email, variables: row || {} }
            })

            const res = await fetch("/api/import/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipients, subject, htmlBody }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSendResult(data)
            if (data.sent > 0) {
                toast.success(`${data.sent} email(s) envoyé(s) avec succès`)
            }
            if (data.failed?.length > 0) {
                toast.error(`${data.failed.length} email(s) échoué(s)`)
            }
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'envoi")
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
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
                        <div className="flex items-center justify-between">
                            <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                                Corps du message
                            </Label>
                        </div>

                        {/* Variable insertion buttons */}
                        <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 border-b-0">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 mr-2">
                                <Variable className="w-3 h-3" /> Variables :
                            </span>
                            {headers.map((header) => (
                                <button
                                    key={header}
                                    onClick={() => insertVariable(header)}
                                    className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 transition"
                                >
                                    {`{${header}}`}
                                </button>
                            ))}
                        </div>

                        {/* Toolbar */}
                        {editor && (
                            <div className="flex gap-1 p-2 bg-gray-50 border border-gray-200 border-b-0 border-t-0">
                                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 text-xs font-bold hover:bg-white transition ${editor.isActive("bold") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>B</button>
                                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 text-xs italic hover:bg-white transition ${editor.isActive("italic") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>I</button>
                                <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 text-xs underline hover:bg-white transition ${editor.isActive("underline") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>U</button>
                                <div className="w-px bg-gray-200 mx-1" />
                                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 text-xs hover:bg-white transition ${editor.isActive("bulletList") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>• Liste</button>
                                <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 text-xs hover:bg-white transition ${editor.isActive("orderedList") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>1. Liste</button>
                            </div>
                        )}
                        <div className="border border-gray-200 bg-white">
                            <EditorContent editor={editor} />
                        </div>
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
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border border-gray-200 hover:border-[#050505] transition-all"
                    >
                        Fermer
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || selectedEmails.size === 0}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Envoyer à {selectedEmails.size} personne{selectedEmails.size > 1 ? "s" : ""}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
