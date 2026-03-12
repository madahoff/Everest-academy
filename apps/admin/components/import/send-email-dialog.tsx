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
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { toast } from "sonner"

interface SendEmailDialogProps {
    open: boolean
    onClose: () => void
    recipientEmail: string
    rowData: Record<string, string>
}

export function SendEmailDialog({ open, onClose, recipientEmail, rowData }: SendEmailDialogProps) {
    const [subject, setSubject] = useState("")
    const [htmlBody, setHtmlBody] = useState("<p>Bonjour,</p><p></p><p>Cordialement,<br/>Everest Academy</p>")
    const [sending, setSending] = useState(false)

    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error("Le sujet est requis")
            return
        }

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
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] rounded-none border-0 shadow-xl overflow-hidden flex flex-col">
                <DialogHeader className="border-b border-gray-100 pb-4 shrink-0">
                    <DialogTitle className="text-sm font-black uppercase tracking-[0.15em] text-[#050505]">
                        Envoyer un Email
                    </DialogTitle>
                    <DialogDescription className="text-[9px] uppercase tracking-widest text-gray-400">
                        Composer et envoyer un email à {recipientEmail}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4">
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

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Corps du message <span className="text-red-500">*</span>
                        </Label>
                        <div className="min-h-[200px]">
                            <RichTextEditor
                                value={htmlBody}
                                onChange={setHtmlBody}
                                placeholder="Rédigez votre email, ajoutez des titres, des images..."
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4 gap-2 shrink-0">
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
