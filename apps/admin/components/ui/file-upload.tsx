"use client"

import * as React from "react"
import { Upload, X, FileVideo, RotateCcw } from "lucide-react"
import { getUploadManager } from "@/lib/media-upload/client"
import { setUploadPanelOpen, useSlotTask } from "@/lib/media-upload/client/hooks"
import { canCancel } from "@/lib/media-upload/client/manager"
import type { UploadTask } from "@/lib/media-upload/client/types"
import type { AttachTarget } from "@/lib/media-upload/targets"
import { describeStatus, percent, TONE_TEXT } from "@/components/uploads/labels"
import { ProgressBar } from "@/components/uploads/upload-task-row"

interface FileUploadProps {
    value?: string
    onChange?: (url: string) => void
    disabled?: boolean
    type?: "hero" | "card" | "video"
    label?: string
    /**
     * Emplacement stable de ce champ (« section:abc:video »). C'est lui qui permet de
     * retrouver l'envoi après avoir fermé puis rouvert le formulaire. Sans lui, l'envoi
     * reste suivi dans le panneau, mais n'est plus relié à ce champ une fois démonté.
     */
    slotKey?: string
    /** Contenu auquel rattacher le média quand l'envoi se termine formulaire fermé. */
    target?: Omit<AttachTarget, "expected">
}

/**
 * Champ d'envoi d'un média. Il ne transfère rien lui-même : il confie le fichier au
 * gestionnaire global et affiche l'avancement de SON emplacement. Fermer le dialogue
 * qui le contient n'interrompt donc pas l'envoi.
 */
export function FileUpload({ value, onChange, disabled, type = "hero", label, slotKey, target }: FileUploadProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const localKey = React.useId()
    const slot = slotKey ?? `local:${localKey}`
    const task = useSlotTask(slot)

    const onChangeRef = React.useRef(onChange)
    React.useEffect(() => {
        onChangeRef.current = onChange
    })
    React.useEffect(() => getUploadManager().bindSlot(slot, (url) => onChangeRef.current?.(url)), [slot])

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return
        getUploadManager().add([file], {
            kind: type,
            slotKey: slot,
            target: target && { ...target, expected: value ?? "" },
        })
    }

    const handleRemove = (event: React.MouseEvent) => {
        event.stopPropagation()
        // Le média retiré ne doit pas revenir à la prochaine ouverture du formulaire.
        getUploadManager().forgetSlots(slot)
        onChange?.("")
    }

    const isVideo = type === "video" || value?.match(/\.(mp4|webm|mov|m4v)$/i)
    const pick = () => !disabled && fileInputRef.current?.click()

    return (
        <div className="w-full">
            {task ? (
                <TaskCard task={task} />
            ) : value ? (
                <div className="relative group border border-gray-200 bg-gray-50 overflow-hidden h-32 w-full flex items-center justify-center">
                    {isVideo ? (
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                            <FileVideo className="w-8 h-8" />
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[200px]">{value.split('/').pop()}</span>
                        </div>
                    ) : (
                        <img
                            src={value}
                            alt="Upload"
                            className="h-full w-full object-cover"
                        />
                    )}

                    <button
                        onClick={handleRemove}
                        disabled={disabled}
                        type="button"
                        aria-label="Retirer le média"
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-none hover:bg-red-600 transition-colors z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={pick}
                        disabled={disabled}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center"
                    >
                        <span className="text-white text-[10px] font-bold uppercase tracking-widest">Remplacer</span>
                    </button>
                </div>
            ) : (
                <div
                    onClick={pick}
                    className={`
                        border-2 border-dashed border-gray-200 bg-gray-50 p-6
                        flex flex-col items-center justify-center gap-2
                        cursor-pointer hover:border-[#2563EB] hover:bg-[#2563EB]/5
                        transition-all h-32 w-full
                        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                >
                    <Upload className="w-6 h-6 text-gray-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {label || "Cliquer pour uploader"}
                    </p>
                    <p className="text-[8px] text-gray-400">
                        {type === "video" ? "MP4, WebM, MOV — compressée avant l'envoi" : "JPG, PNG, WEBP — optimisée avant l'envoi"}
                    </p>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept={type === "video" ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" : "image/jpeg,image/png,image/webp,image/gif,image/avif"}
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />
        </div>
    )
}

/** L'envoi en cours sur cet emplacement : avancement, état, et les gestes immédiats. */
function TaskCard({ task }: { task: UploadTask }) {
    const manager = getUploadManager()
    const status = describeStatus(task)
    const failed = task.status === "failed"

    return (
        <div className={`flex h-32 w-full flex-col justify-between border p-3 ${failed ? "border-red-200 bg-red-50/50" : "border-[#2563EB]/30 bg-[#2563EB]/5"}`}>
            <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] font-bold text-[#050505]" title={task.name}>{task.name}</p>
                <div className="flex shrink-0 items-center gap-1">
                    {failed && task.error?.retryable && (
                        <button type="button" onClick={() => manager.retry(task.id)} aria-label="Relancer" title="Relancer" className="p-1 text-gray-500 hover:text-[#050505]">
                            <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {(canCancel(task) || failed) && (
                        <button
                            type="button"
                            onClick={() => (failed ? manager.dismiss(task.id) : manager.cancel(task.id))}
                            aria-label={failed ? "Retirer" : "Annuler l'envoi"}
                            title={failed ? "Retirer" : "Annuler l'envoi"}
                            className="p-1 text-gray-500 hover:text-red-600"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div>
                <p className={`text-[10px] font-bold ${TONE_TEXT[status.tone]}`} aria-live="polite">
                    {failed ? task.error?.message : status.label}
                </p>
                {failed && task.error?.hint && <p className="text-[10px] leading-snug text-gray-500">{task.error.hint}</p>}
                {!failed && (
                    <div className="mt-1.5 flex items-center gap-2">
                        <ProgressBar value={task.status === "running" && task.progress === 0 ? null : task.progress} />
                        <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-gray-500">{percent(task.progress)}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] leading-tight text-gray-400">{failed ? "" : "Vous pouvez fermer cette fenêtre : l'envoi continue."}</p>
                <button type="button" onClick={() => setUploadPanelOpen(true)} className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline">
                    Détails
                </button>
            </div>
        </div>
    )
}
