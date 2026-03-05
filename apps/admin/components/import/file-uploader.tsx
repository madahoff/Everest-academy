"use client"

import { useRef, useState, useCallback } from "react"
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface FileUploaderProps {
    onDataLoaded: (data: { headers: string[]; rows: Record<string, string>[] }) => void
}

export function FileUploader({ onDataLoaded }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback(async (file: File) => {
        const validTypes = [
            "text/csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ]
        const ext = file.name.toLowerCase()
        if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
            toast.error("Format non supporté. Utilisez .csv, .xlsx ou .xls")
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Le fichier dépasse la limite de 10MB")
            return
        }

        setIsLoading(true)
        setFileName(file.name)

        try {
            const formData = new FormData()
            formData.append("file", file)

            const res = await fetch("/api/import", { method: "POST", body: formData })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Erreur lors de l'import")
            }

            onDataLoaded({ headers: data.headers, rows: data.rows })
            toast.success(`${data.totalRows} lignes importées avec succès`)
        } catch (err: any) {
            toast.error(err.message || "Erreur lors du traitement du fichier")
            setFileName(null)
        } finally {
            setIsLoading(false)
        }
    }, [onDataLoaded])

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
        },
        [handleFile]
    )

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
                relative border-2 border-dashed cursor-pointer transition-all duration-300 
                ${isDragging
                    ? "border-[#2563EB] bg-[#2563EB]/5"
                    : "border-gray-200 hover:border-[#2563EB]/50 bg-white hover:bg-gray-50/50"
                }
                ${isLoading ? "pointer-events-none opacity-60" : ""}
            `}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = ""
                }}
            />

            <div className="flex flex-col items-center justify-center py-12 px-6">
                {isLoading ? (
                    <>
                        <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Traitement en cours...
                        </p>
                    </>
                ) : fileName ? (
                    <>
                        <FileSpreadsheet className="w-10 h-10 text-[#2563EB] mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#050505] mb-1">
                            {fileName}
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest">
                            Cliquez pour remplacer le fichier
                        </p>
                    </>
                ) : (
                    <>
                        <div className={`p-4 mb-4 transition-colors duration-300 ${isDragging ? "bg-[#2563EB] text-white" : "bg-gray-50 text-gray-400"}`}>
                            <Upload className="w-8 h-8" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#050505] mb-1">
                            Glissez-déposez votre fichier ici
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-4">
                            ou cliquez pour sélectionner
                        </p>
                        <div className="flex gap-2">
                            {["CSV", "XLSX", "XLS"].map((ext) => (
                                <span
                                    key={ext}
                                    className="px-3 py-1 text-[8px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500"
                                >
                                    .{ext}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Accent line */}
            <div className={`absolute bottom-0 left-0 h-[2px] transition-all duration-500 ${isDragging ? "w-full bg-[#2563EB]" : "w-0 bg-transparent"}`} />
        </div>
    )
}
