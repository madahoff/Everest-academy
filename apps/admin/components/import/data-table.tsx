"use client"

import { useState, useMemo } from "react"
import { Pencil, Mail, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface DataTableProps {
    headers: string[]
    rows: Record<string, string>[]
    onEditRow: (index: number) => void
    onSendEmail: (index: number) => void
}

export function DataTable({ headers, rows, onEditRow, onSendEmail }: DataTableProps) {
    const [currentPage, setCurrentPage] = useState(1)
    const rowsPerPage = 20
    const totalPages = Math.ceil(rows.length / rowsPerPage)

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage
        return rows.slice(start, start + rowsPerPage)
    }, [rows, currentPage])

    const startIndex = (currentPage - 1) * rowsPerPage

    // Find email column
    const emailColumn = useMemo(() => {
        return headers.find(
            (h) => h.toLowerCase().includes("email") || h.toLowerCase().includes("mail")
        )
    }, [headers])

    const handleSendEmail = (index: number) => {
        const globalIndex = startIndex + index
        const row = rows[globalIndex]
        if (!emailColumn || !row[emailColumn] || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[emailColumn])) {
            toast.error("Cette ligne ne contient pas d'adresse email valide")
            return
        }
        onSendEmail(globalIndex)
    }

    // Generate page numbers to display
    const pageNumbers = useMemo(() => {
        const pages: (number | "...")[] = []
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            pages.push(1)
            if (currentPage > 3) pages.push("...")
            const start = Math.max(2, currentPage - 1)
            const end = Math.min(totalPages - 1, currentPage + 1)
            for (let i = start; i <= end; i++) pages.push(i)
            if (currentPage < totalPages - 2) pages.push("...")
            pages.push(totalPages)
        }
        return pages
    }, [totalPages, currentPage])

    if (rows.length === 0) return null

    return (
        <div className="bg-white border border-gray-100 overflow-hidden">
            {/* Table header info */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#2563EB]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#050505]">
                        Données Importées
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-2">
                        {rows.length} entrée{rows.length > 1 ? "s" : ""} • Page {currentPage}/{totalPages}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 bg-gray-50/80 whitespace-nowrap">
                                #
                            </th>
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    className="px-4 py-3 text-left text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 bg-gray-50/80 whitespace-nowrap"
                                >
                                    {header}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-right text-[8px] font-black uppercase tracking-[0.3em] text-gray-400 bg-gray-50/80 whitespace-nowrap sticky right-0 bg-gray-50">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.map((row, i) => {
                            const globalIndex = startIndex + i
                            return (
                                <tr
                                    key={globalIndex}
                                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group"
                                >
                                    <td className="px-4 py-3 text-[9px] font-bold text-gray-300 whitespace-nowrap">
                                        {globalIndex + 1}
                                    </td>
                                    {headers.map((header) => (
                                        <td
                                            key={header}
                                            className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                                            title={row[header] || ""}
                                        >
                                            {header.toLowerCase() === "code" && row[header] ? (
                                                <code className="bg-[#2563EB]/10 text-[#2563EB] px-2 py-0.5 font-mono text-[10px] font-bold">
                                                    {row[header]}
                                                </code>
                                            ) : (
                                                row[header] || <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white group-hover:bg-gray-50/50">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <button
                                                onClick={() => onEditRow(globalIndex)}
                                                className="px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest bg-gray-100 hover:bg-[#050505] hover:text-white transition-all flex items-center gap-1"
                                                title="Éditer"
                                            >
                                                <Pencil className="w-3 h-3" />
                                                Éditer
                                            </button>
                                            <button
                                                onClick={() => handleSendEmail(i)}
                                                className="px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB] hover:text-white transition-all flex items-center gap-1"
                                                title="Envoyer Mail"
                                            >
                                                <Mail className="w-3 h-3" />
                                                Mail
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        Affichage {startIndex + 1}-{Math.min(startIndex + rowsPerPage, rows.length)} sur {rows.length}
                    </p>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {pageNumbers.map((page, idx) =>
                            page === "..." ? (
                                <span key={`dots-${idx}`} className="px-2 text-gray-400 text-xs">
                                    …
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page as number)}
                                    className={`
                                        w-8 h-8 text-[10px] font-bold transition-all
                                        ${currentPage === page
                                            ? "bg-[#050505] text-white"
                                            : "hover:bg-gray-100 text-gray-500"
                                        }
                                    `}
                                >
                                    {page}
                                </button>
                            )
                        )}

                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
