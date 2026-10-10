"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, ChevronDown, Copy, FileText, FileVideo, Image as ImageIcon, Loader2, Minus, Pause, Play, RotateCcw, Trash2, X } from "lucide-react"
import { getUploadManager } from "@/lib/media-upload/client"
import { canCancel, canPause } from "@/lib/media-upload/client/manager"
import { PHASES, type PhaseState, type UploadTask } from "@/lib/media-upload/client/types"
import { describeStatus, formatBytes, formatDuration, percent, PHASE_LABELS, TONE_BAR, TONE_TEXT } from "./labels"

const FAMILY = {
    video: { label: "Vidéo", Icon: FileVideo },
    image: { label: "Image", Icon: ImageIcon },
    document: { label: "Document", Icon: FileText },
} as const

/** Barre de progression ; sans valeur mesurable, un balayage indique simplement l'activité. */
export function ProgressBar({ value, className, tone = "bg-[#2563EB]" }: { value: number | null; className?: string; tone?: string }) {
    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value === null ? undefined : Math.floor(value * 100)}
            className={`relative h-1 w-full overflow-hidden bg-gray-100 ${className ?? ""}`}
        >
            {value === null ? (
                <div className={`absolute inset-y-0 w-1/3 animate-[upload-sweep_1.2s_ease-in-out_infinite] ${tone}`} />
            ) : (
                <div className={`h-full transition-[width] duration-300 ${tone}`} style={{ width: `${Math.min(100, value * 100)}%` }} />
            )}
        </div>
    )
}

function sizes(task: UploadTask): string {
    const original = formatBytes(task.originalSize)
    const result = task.finalSize ?? task.preparedSize
    if (result === null || result === task.originalSize) return original
    const delta = Math.round((1 - result / task.originalSize) * 100)
    return `${original} → ${formatBytes(result)} (${delta >= 0 ? "−" : "+"}${Math.abs(delta)} %)`
}

function transferLine(task: UploadTask): string | null {
    if (task.status !== "running") return null
    const parts: string[] = []
    if (task.phases.upload.status === "active" && task.bytesTotal) {
        parts.push(`${formatBytes(task.bytesSent)} / ${formatBytes(task.bytesTotal)}`)
        if (task.speed) parts.push(`${formatBytes(task.speed)}/s`)
    }
    if (task.etaSeconds !== null) parts.push(`environ ${formatDuration(task.etaSeconds)} restantes`)
    return parts.length ? parts.join(" · ") : null
}

function PhaseIcon({ state }: { state: PhaseState }) {
    if (state.status === "done") return <Check className="h-3 w-3 text-emerald-600" />
    if (state.status === "active") return <Loader2 className="h-3 w-3 animate-spin text-[#2563EB]" />
    if (state.status === "skipped") return <Minus className="h-3 w-3 text-gray-300" />
    return <span className="block h-1.5 w-1.5 rounded-full bg-gray-200" />
}

function phaseValue(state: PhaseState): string {
    if (state.status === "done") return "Terminée"
    if (state.status === "skipped") return "Non nécessaire"
    if (state.status === "pending") return "En attente"
    return state.progress === null ? "En cours" : percent(state.progress)
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#050505]"
        >
            {children}
        </button>
    )
}

export function UploadTaskRow({ task }: { task: UploadTask }) {
    const [expanded, setExpanded] = React.useState(false)
    const manager = getUploadManager()
    const { label: familyLabel, Icon } = FAMILY[task.family]
    const status = describeStatus(task)
    const line = transferLine(task)
    const live = task.status === "queued" || task.status === "running" || task.status === "paused"

    const copyLink = async () => {
        if (!task.url) return
        await navigator.clipboard.writeText(task.url)
        toast.success("Lien du média copié")
    }

    return (
        <li className="border border-gray-100 bg-white">
            <div className="flex items-start gap-3 p-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-gray-50 text-gray-400">
                    <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#050505]" title={task.name}>{task.name}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">
                        <span className="font-bold uppercase tracking-widest">{familyLabel}</span> · {sizes(task)}
                    </p>

                    {/* Un échec définitif n'a plus d'avancement à montrer ; un échec relançable garde son point de reprise. */}
                    {task.status !== "done" && task.status !== "canceled" && !(task.status === "failed" && !task.error?.retryable) && (
                        <div className="mt-2 flex items-center gap-2">
                            <ProgressBar
                                value={task.status === "running" && task.progress === 0 ? null : task.progress}
                                tone={TONE_BAR[status.tone === "neutral" ? "active" : status.tone]}
                            />
                            <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums text-gray-500">{percent(task.progress)}</span>
                        </div>
                    )}

                    <p className={`mt-1.5 text-[10px] font-bold ${TONE_TEXT[status.tone]}`} aria-live="polite">{status.label}</p>
                    {line && <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">{line}</p>}

                    {task.error && (
                        <p className="mt-1.5 text-[11px] leading-snug text-red-600">
                            {task.error.message}
                            {task.error.hint && <span className="block text-gray-500">{task.error.hint}</span>}
                        </p>
                    )}
                    {task.status === "done" && task.attach.message && (
                        <p className={`mt-1 text-[11px] leading-snug ${task.attach.state === "attached" ? "text-gray-500" : "text-amber-700"}`}>{task.attach.message}</p>
                    )}
                </div>

                <div className="flex shrink-0 items-center">
                    {canPause(task) && (
                        <IconButton label="Mettre en pause" onClick={() => manager.pause(task.id)}><Pause className="h-3.5 w-3.5" /></IconButton>
                    )}
                    {task.status === "paused" && (
                        <IconButton label="Reprendre" onClick={() => manager.resume(task.id)}><Play className="h-3.5 w-3.5" /></IconButton>
                    )}
                    {task.status === "failed" && task.error?.retryable && (
                        <IconButton label="Relancer" onClick={() => manager.retry(task.id)}><RotateCcw className="h-3.5 w-3.5" /></IconButton>
                    )}
                    {task.status === "done" && task.url && (
                        <IconButton label="Copier le lien du média" onClick={copyLink}><Copy className="h-3.5 w-3.5" /></IconButton>
                    )}
                    {canCancel(task) && (
                        <IconButton label="Annuler l'envoi" onClick={() => manager.cancel(task.id)}><X className="h-3.5 w-3.5" /></IconButton>
                    )}
                    {!live && (
                        <IconButton label="Retirer de la liste" onClick={() => manager.dismiss(task.id)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    )}
                    <IconButton label={expanded ? "Masquer les étapes" : "Voir les étapes"} onClick={() => setExpanded((value) => !value)}>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </IconButton>
                </div>
            </div>

            {expanded && (
                <ol className="space-y-1.5 border-t border-gray-100 bg-gray-50/60 px-3 py-3">
                    {PHASES.map((phase) => {
                        const state = task.phases[phase]
                        return (
                            <li key={phase} className="flex items-start gap-2 text-[11px]">
                                <span className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center"><PhaseIcon state={state} /></span>
                                <span className="min-w-0 flex-1">
                                    <span className={state.status === "pending" || state.status === "skipped" ? "text-gray-400" : "text-[#050505]"}>
                                        {PHASE_LABELS[phase]}
                                    </span>
                                    {state.note && <span className="block text-[10px] text-gray-400">{state.note}</span>}
                                    {phase === "compression" && task.compressionMs !== null && (
                                        <span className="block text-[10px] text-gray-400">Durée : {formatDuration(task.compressionMs / 1000)}</span>
                                    )}
                                </span>
                                <span className="shrink-0 tabular-nums text-gray-500">{phaseValue(state)}</span>
                            </li>
                        )
                    })}
                    {!task.reloadSafe && live && (
                        <li className="pt-1 text-[10px] text-amber-700">
                            Ce fichier n&apos;est pas conservé par le navigateur : gardez cet onglet ouvert jusqu&apos;à la fin de l&apos;envoi.
                        </li>
                    )}
                </ol>
            )}
        </li>
    )
}
