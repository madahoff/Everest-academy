"use client"

import * as React from "react"
import { useCallback } from "react"
import { toast } from "sonner"
import { Upload, X, Image as ImageIcon, FileVideo, Loader2 } from "lucide-react"

interface FileUploadProps {
    value?: string
    onChange?: (url: string) => void
    disabled?: boolean
    type?: "hero" | "card" | "video"
    label?: string
}

export function FileUpload({ value, onChange, disabled, type = "hero", label }: FileUploadProps) {
    const [loading, setLoading] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        const formData = new FormData()
        formData.append("file", file)
        formData.append("type", type)

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) throw new Error("Upload failed")

            const data = await res.json()
            onChange?.(data.url)
        } catch (e) {
            console.error(e)
            toast.error("Erreur lors de l'upload")
        } finally {
            setLoading(false)
        }
    }, [onChange, type])

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onChange?.("")
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }, [onChange])

    const isVideo = type === "video" || value?.match(/\.(mp4|webm|ogg)$/i)

    return (
        <div className="w-full">
            {value ? (
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
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-none hover:bg-red-600 transition-colors z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <p className="text-white text-[10px] font-bold uppercase tracking-widest">Modifier</p>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => !disabled && fileInputRef.current?.click()}
                    className={`
                        border-2 border-dashed border-gray-200 bg-gray-50 p-6 
                        flex flex-col items-center justify-center gap-2 
                        cursor-pointer hover:border-[#2563EB] hover:bg-[#2563EB]/5 
                        transition-all h-32 w-full
                        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                >
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
                    ) : (
                        <>
                            <Upload className="w-6 h-6 text-gray-400" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                {label || "Cliquer pour uploader"}
                            </p>
                            <p className="text-[8px] text-gray-400">
                                {type === "video" ? "MP4, WebM" : "JPG, PNG, WEBP"}
                            </p>
                        </>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept={type === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled || loading}
            />
        </div>
    )
}
