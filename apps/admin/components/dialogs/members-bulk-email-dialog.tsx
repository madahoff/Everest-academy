"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Send } from "lucide-react"
import { VariableRichTextEditor } from "@/components/ui/variable-rich-text-editor"
import { useBulkEmailSender } from "@/hooks/use-bulk-email-sender"
import { toast } from "sonner"

interface MemberData {
    name: string
    email: string
    role: string
    plan: string
}

/** À qui l'envoi s'adresse. Le choix est explicite, jamais deviné au moment d'envoyer. */
type Scope = "all" | "filtered" | "selected"

interface MembersBulkEmailDialogProps {
    /** Tout l'annuaire. */
    users: MemberData[]
    /** Ce que la recherche et les filtres laissent voir. */
    filtered?: MemberData[]
    /** Les lignes cochées dans la liste. */
    selected?: MemberData[]
    trigger?: React.ReactNode
}

const VARIABLES = ["name", "email", "role", "plan"]

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export function MembersBulkEmailDialog({
    users,
    filtered = users,
    selected = [],
    trigger,
}: MembersBulkEmailDialogProps) {
    const [open, setOpen] = useState(false)
    const [subject, setSubject] = useState("")
    const [htmlBody, setHtmlBody] = useState("<p>Bonjour {name},</p><p></p><p>Cordialement,<br/>Everest Academy</p>")
    const [scope, setScope] = useState<Scope>("all")
    const { send, sending, progress, result: sendResult, reset } = useBulkEmailSender()

    /** Trois viviers, chacun débarrassé des adresses inexploitables. */
    const pools = useMemo(
        () => ({
            all: users.filter((u) => isValidEmail(u.email)),
            filtered: filtered.filter((u) => isValidEmail(u.email)),
            selected: selected.filter((u) => isValidEmail(u.email)),
        }),
        [users, filtered, selected],
    )

    const isFiltered = filtered.length !== users.length
    const recipients = pools[scope]

    const handleOpenChange = (v: boolean) => {
        if (!v && sending) return
        if (v) {
            reset()
            // Le champ le plus étroit fait foi à l'ouverture : on vise une sélection
            // faite exprès avant de viser tout l'annuaire.
            setScope(selected.length > 0 ? "selected" : isFiltered ? "filtered" : "all")
        }
        setOpen(v)
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

        if (recipients.length === 0) {
            toast.error("Aucun destinataire avec une adresse email valide")
            return
        }

        const recipientsArray = recipients.map((u) => ({
            email: u.email,
            variables: { name: u.name, email: u.email, role: u.role, plan: u.plan },
        }))

        await send(recipientsArray, subject, htmlBody)
    }

    const scopes: { key: Scope; label: string; hint: string; count: number; disabled?: boolean }[] = [
        { key: "selected", label: "Sélection", hint: "Lignes cochées", count: pools.selected.length, disabled: selected.length === 0 },
        { key: "filtered", label: "Résultat du filtre", hint: "Recherche et filtres en cours", count: pools.filtered.length, disabled: !isFiltered },
        { key: "all", label: "Tout l'annuaire", hint: "Tous les membres", count: pools.all.length },
    ]

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="px-6 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-[0.2em] hover:border-[#050505] transition-all flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" /> Envoyer un Email
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] rounded-none border-0 shadow-xl overflow-hidden flex flex-col">
                <DialogHeader className="border-b border-gray-100 pb-4 shrink-0">
                    <DialogTitle className="text-sm font-black uppercase tracking-[0.15em] text-[#050505]">
                        Envoi Groupé d&apos;Emails
                    </DialogTitle>
                    <DialogDescription className="text-[9px] uppercase tracking-widest text-gray-400">
                        Choisissez les destinataires, puis rédigez le message
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-6">
                    {/* Destinataires */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Destinataires
                        </Label>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {scopes.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setScope(option.key)}
                                    disabled={option.disabled || sending}
                                    className={`border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${scope === option.key
                                        ? "border-[#2563EB] bg-[#2563EB]/5"
                                        : "border-gray-200 hover:border-[#050505]"
                                        }`}
                                >
                                    <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#050505]">
                                        {option.label}
                                    </span>
                                    <span className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">
                                        {option.hint}
                                    </span>
                                    <span className="mt-1 block text-lg font-black italic tracking-tighter text-[#2563EB]">
                                        {option.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                            {recipients.length} membre{recipients.length > 1 ? "s" : ""} recevra
                            {recipients.length > 1 ? "ont" : ""} cet email · les adresses invalides sont écartées
                        </p>
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
                        <VariableRichTextEditor content={htmlBody} onChange={setHtmlBody} variables={VARIABLES} />
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
                        onClick={() => handleOpenChange(false)}
                        disabled={sending}
                        className="px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border border-gray-200 hover:border-[#050505] transition-all disabled:opacity-50"
                    >
                        Fermer
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || recipients.length === 0}
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
                                Envoyer à {recipients.length} membre{recipients.length > 1 ? "s" : ""}
                            </>
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
