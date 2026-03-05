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
import { Loader2, Send } from "lucide-react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Color from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { toast } from "sonner"

interface SendEmailDialogProps {
    open: boolean
    onClose: () => void
    recipientEmail: string
    rowData: Record<string, string>
}

export function SendEmailDialog({ open, onClose, recipientEmail, rowData }: SendEmailDialogProps) {
    const [subject, setSubject] = useState("")
    const [sending, setSending] = useState(false)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
        ],
        content: "<p>Bonjour,</p><p></p><p>Cordialement,<br/>Everest Academy</p>",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4",
            },
        },
    })

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

        setSending(true)
        try {
            const res = await fetch("/api/import/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipients: [{ email: recipientEmail, variables: rowData }],
                    subject,
                    htmlBody,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            if (data.sent > 0) {
                toast.success(`Email envoyé à ${recipientEmail}`)
                onClose()
            } else if (data.failed?.length > 0) {
                toast.error(`Échec : ${data.failed[0].error}`)
            }
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'envoi")
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-[650px] rounded-none border-0 shadow-xl">
                <DialogHeader className="border-b border-gray-100 pb-4">
                    <DialogTitle className="text-sm font-black uppercase tracking-[0.15em] text-[#050505]">
                        Envoyer un Email
                    </DialogTitle>
                    <DialogDescription className="text-[9px] uppercase tracking-widest text-gray-400">
                        Composer et envoyer un email à {recipientEmail}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Destinataire
                        </Label>
                        <Input
                            value={recipientEmail}
                            disabled
                            className="h-10 rounded-none border-gray-200 text-sm bg-gray-50"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Sujet
                        </Label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Objet de l'email..."
                            className="h-10 rounded-none border-gray-200 text-sm focus:border-[#2563EB] focus:ring-[#2563EB]/20"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Corps du message
                        </Label>
                        {/* Toolbar */}
                        {editor && (
                            <div className="flex gap-1 p-2 bg-gray-50 border border-gray-200 border-b-0">
                                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 text-xs font-bold hover:bg-white transition ${editor.isActive("bold") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>B</button>
                                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 text-xs italic hover:bg-white transition ${editor.isActive("italic") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>I</button>
                                <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 text-xs underline hover:bg-white transition ${editor.isActive("underline") ? "bg-white text-[#2563EB]" : "text-gray-500"}`}>U</button>
                            </div>
                        )}
                        <div className="border border-gray-200 bg-white">
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4 gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border border-gray-200 hover:border-[#050505] transition-all"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Envoyer
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
