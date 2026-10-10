"use client"

import * as React from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { CloudUpload, Plus } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getUploadManager } from "@/lib/media-upload/client"
import { setUploadPanelOpen, useUploadPanelOpen, useUploads } from "@/lib/media-upload/client/hooks"
import type { UploadTask } from "@/lib/media-upload/client/types"
import { percent } from "./labels"
import { ProgressBar, UploadTaskRow } from "./upload-task-row"

const isLive = (task: UploadTask) => task.status === "queued" || task.status === "running" || task.status === "paused"

/**
 * Centre des envois : le bouton de l'en-tête, le panneau de suivi et les effets globaux
 * (restauration de la file, notifications, garde à la fermeture de l'onglet).
 *
 * Monté une fois dans le layout de la console : il est présent sur toutes les pages.
 * Fermer le panneau ne touche à aucun transfert — le gestionnaire vit en dehors de lui.
 */
export function UploadCenter() {
    const { tasks, global, persistent } = useUploads()
    const open = useUploadPanelOpen()
    const queryClient = useQueryClient()
    const manager = getUploadManager()

    React.useEffect(() => {
        void manager.init()
        return manager.onEvent((event) => {
            const show = { label: "Voir", onClick: () => setUploadPanelOpen(true) }
            if (event.type === "done") {
                toast.success(`${event.task.name} est disponible`, { description: event.task.attach.message, action: show })
            } else if (event.type === "conflict") {
                toast.warning(`${event.task.name} est disponible, mais n'a pas été rattaché`, { description: event.task.attach.message, action: show, duration: 10000 })
            } else if (event.type === "failed") {
                toast.error(`Échec de l'envoi de ${event.task.name}`, { description: event.task.error?.message, action: show, duration: 10000 })
            } else {
                // Un contenu vient d'être modifié en arrière-plan : les listes affichées doivent le refléter.
                void queryClient.invalidateQueries()
            }
        })
    }, [manager, queryClient])

    // Fermer ou recharger l'onglet interrompt les transferts (ils reprendront ensuite) : on prévient.
    React.useEffect(() => {
        if (global.active === 0) return
        const warn = (event: BeforeUnloadEvent) => event.preventDefault()
        window.addEventListener("beforeunload", warn)
        return () => window.removeEventListener("beforeunload", warn)
    }, [global.active])

    const live = tasks.filter(isLive)
    const failed = tasks.filter((task) => task.status === "failed")
    const finished = tasks.filter((task) => task.status === "done" || task.status === "canceled").reverse()

    return (
        <>
            <button
                type="button"
                onClick={() => setUploadPanelOpen(true)}
                aria-label={global.active > 0 ? `Envois de médias : ${global.active} en cours, ${percent(global.progress)}` : "Envois de médias"}
                className="group relative flex h-9 shrink-0 items-center gap-2 whitespace-nowrap border border-gray-100 px-3 text-gray-500 transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
            >
                <CloudUpload className="h-4 w-4" />
                {global.active > 0 ? (
                    <span className="text-[10px] font-black tabular-nums tracking-tight text-[#2563EB]">
                        {global.active} · {percent(global.progress)}
                    </span>
                ) : (
                    <span className="hidden text-[10px] font-bold uppercase tracking-widest sm:inline">Envois</span>
                )}
                {failed.length > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />}
                {global.active > 0 && <ProgressBar value={global.progress} className="absolute inset-x-0 bottom-0 !h-0.5" />}
            </button>

            <Sheet open={open} onOpenChange={setUploadPanelOpen}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 border-none bg-[#F9FAFB] p-0 sm:max-w-md">
                    <SheetHeader className="space-y-3 border-b border-gray-100 bg-white p-5 text-left">
                        <SheetTitle className="text-sm font-black uppercase tracking-tighter text-[#050505]">
                            Envois de <span className="text-[#2563EB]">médias</span>
                        </SheetTitle>
                        <SheetDescription className="text-[11px] leading-snug text-gray-500">
                            Les envois continuent pendant que vous naviguez dans la console. Vous pouvez fermer ce panneau.
                        </SheetDescription>

                        {global.active > 0 && (
                            <div>
                                <div className="mb-1.5 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-widest">
                                    <span className="text-gray-400">
                                        {global.active - global.paused - global.queued} en cours{global.queued > 0 && ` · ${global.queued} en attente`}{global.paused > 0 && ` · ${global.paused} suspendu${global.paused > 1 ? "s" : ""}`}
                                    </span>
                                    <span className="tabular-nums text-[#2563EB]">{percent(global.progress)}</span>
                                </div>
                                <ProgressBar value={global.progress} className="!h-1.5" />
                            </div>
                        )}
                    </SheetHeader>

                    <div className="flex-1 space-y-5 overflow-y-auto p-5">
                        <DropZone />

                        {!persistent && tasks.length > 0 && (
                            <p className="border border-amber-200 bg-amber-50 p-3 text-[11px] leading-snug text-amber-800">
                                Un autre onglet de la console gère déjà une file d&apos;envois : ceux lancés ici ne seront pas repris après un rechargement.
                            </p>
                        )}

                        <Group title="En cours" tasks={live} />
                        <Group title="Échecs" tasks={failed} />
                        <Group
                            title="Terminés"
                            tasks={finished}
                            action={
                                <button type="button" onClick={() => manager.clearFinished()} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#050505]">
                                    Tout effacer
                                </button>
                            }
                        />

                        {tasks.length === 0 && <p className="py-8 text-center text-[11px] text-gray-400">Aucun envoi pour le moment.</p>}
                    </div>

                    <p className="border-t border-gray-100 bg-white px-5 py-3 text-[10px] leading-snug text-gray-400">
                        Fermer ou recharger l&apos;onglet interrompt les transferts : ils reprennent là où ils en étaient à la réouverture de la console, sur ce même navigateur.
                    </p>
                </SheetContent>
            </Sheet>
        </>
    )
}

function Group({ title, tasks, action }: { title: string; tasks: UploadTask[]; action?: React.ReactNode }) {
    if (tasks.length === 0) return null
    return (
        <section>
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title} ({tasks.length})</h3>
                {action}
            </div>
            <ul className="space-y-2">
                {tasks.map((task) => <UploadTaskRow key={task.id} task={task} />)}
            </ul>
        </section>
    )
}

/**
 * Dépôt libre de plusieurs médias à la fois. Ils ne sont rattachés à aucun contenu :
 * une fois disponibles, leur lien se copie depuis la liste.
 */
function DropZone() {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [over, setOver] = React.useState(false)

    const add = (list: FileList | null) => {
        const files = Array.from(list ?? [])
        const videos = files.filter((file) => file.type.startsWith("video/"))
        const images = files.filter((file) => file.type.startsWith("image/"))
        const manager = getUploadManager()
        if (videos.length) manager.add(videos, { kind: "video" })
        if (images.length) manager.add(images, { kind: "misc" })
        const ignored = files.length - videos.length - images.length
        if (ignored > 0) toast.error(`${ignored} fichier${ignored > 1 ? "s" : ""} ignoré${ignored > 1 ? "s" : ""} : seules les images et les vidéos sont acceptées.`)
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()}
            onDragOver={(event) => {
                event.preventDefault()
                setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
                event.preventDefault()
                setOver(false)
                add(event.dataTransfer.files)
            }}
            className={`flex cursor-pointer items-center gap-3 border-2 border-dashed p-4 transition-colors ${over ? "border-[#2563EB] bg-[#2563EB]/5" : "border-gray-200 bg-white hover:border-[#2563EB]"}`}
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#2563EB] text-white"><Plus className="h-4 w-4" /></div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#050505]">Ajouter des médias</p>
                <p className="text-[10px] text-gray-400">Déposez ou choisissez plusieurs vidéos et images.</p>
            </div>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                    add(event.target.files)
                    event.target.value = ""
                }}
            />
        </div>
    )
}
