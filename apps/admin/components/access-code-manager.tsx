"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Copy, Plus, CheckCircle, XCircle, Loader2, Ticket, RefreshCw } from "lucide-react"

interface AccessCode {
    id: string
    code: string
    used: boolean
    usedAt: string | null
    usedBy: { id: string; name: string; email: string } | null
    createdAt: string
}

interface AccessCodeManagerProps {
    courseId: string
}

export function AccessCodeManager({ courseId }: AccessCodeManagerProps) {
    const queryClient = useQueryClient()
    const [copied, setCopied] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)

    const { data: codes, isLoading } = useQuery<AccessCode[]>({
        queryKey: ["access-codes", courseId],
        queryFn: async () => {
            const res = await fetch(`/api/access-codes?courseId=${courseId}`)
            if (!res.ok) throw new Error("Failed to fetch codes")
            return res.json()
        }
    })

    const generateMutation = useMutation({
        mutationFn: async (count: number = 1) => {
            setGenerating(true)
            const res = await fetch("/api/access-codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, count })
            })
            if (!res.ok) throw new Error("Failed to generate code")
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["access-codes", courseId] })
            setGenerating(false)
        },
        onError: () => setGenerating(false)
    })

    const copyToClipboard = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(code)
            setTimeout(() => setCopied(null), 2000)
        } catch (err) {
            console.error("Failed to copy:", err)
        }
    }

    const usedCount = codes?.filter(c => c.used).length || 0
    const totalCount = codes?.length || 0

    return (
        <div className="border border-gray-100 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-[#2563EB]" />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                        Codes d'accès <span className="text-gray-300">({usedCount}/{totalCount} utilisés)</span>
                    </h3>
                </div>
                <button
                    onClick={() => generateMutation.mutate(1)}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-[#050505] text-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all disabled:opacity-50"
                >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Générer un code
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
            ) : codes && codes.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {codes.map((code) => (
                        <div
                            key={code.id}
                            className={`flex items-center justify-between p-3 ${code.used ? 'bg-gray-50' : 'bg-white border border-gray-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                {code.used ? (
                                    <XCircle className="w-4 h-4 text-gray-300" />
                                ) : (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                                <span className={`font-mono text-sm ${code.used ? 'text-gray-400 line-through' : 'text-[#050505] font-bold'}`}>
                                    {code.code}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                {code.used && code.usedBy ? (
                                    <span className="text-[9px] text-gray-400 uppercase">
                                        Utilisé par {code.usedBy.name || code.usedBy.email}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => copyToClipboard(code.code)}
                                        className="flex items-center gap-1 text-[9px] font-bold uppercase text-gray-400 hover:text-[#2563EB] transition-colors"
                                    >
                                        {copied === code.code ? (
                                            <>
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                                Copié!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3 h-3" />
                                                Copier
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 border border-dashed border-gray-200">
                    <Ticket className="w-8 h-8 mx-auto text-gray-200 mb-3" />
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        Aucun code généré
                    </p>
                    <button
                        onClick={() => generateMutation.mutate(5)}
                        disabled={generating}
                        className="mt-4 text-[9px] font-bold text-[#2563EB] uppercase tracking-widest hover:underline"
                    >
                        Générer 5 codes
                    </button>
                </div>
            )}
        </div>
    )
}
