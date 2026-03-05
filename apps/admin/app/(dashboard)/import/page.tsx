"use client"

import { useState, useCallback } from "react"
import { FileSpreadsheet, KeyRound, Mail, Download } from "lucide-react"
import { toast } from "sonner"

import { FileUploader } from "@/components/import/file-uploader"
import { DataTable } from "@/components/import/data-table"
import { EditRowDialog } from "@/components/import/edit-row-dialog"
import { SendEmailDialog } from "@/components/import/send-email-dialog"
import { BulkEmailDialog } from "@/components/import/bulk-email-dialog"
import { CourseCodeDialog } from "@/components/import/course-code-dialog"

export default function ImportPage() {
    // Data state
    const [headers, setHeaders] = useState<string[]>([])
    const [rows, setRows] = useState<Record<string, string>[]>([])

    // Dialog states
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
    const [emailRowIndex, setEmailRowIndex] = useState<number | null>(null)
    const [showBulkEmail, setShowBulkEmail] = useState(false)
    const [showCourseCode, setShowCourseCode] = useState(false)

    const hasData = headers.length > 0 && rows.length > 0

    // Find email column
    const emailColumn = headers.find(
        (h) => h.toLowerCase().includes("email") || h.toLowerCase().includes("mail")
    )

    const handleDataLoaded = useCallback((data: { headers: string[]; rows: Record<string, string>[] }) => {
        setHeaders(data.headers)
        setRows(data.rows)
    }, [])

    const handleEditRow = useCallback((index: number) => {
        setEditingRowIndex(index)
    }, [])

    const handleSaveRow = useCallback((updatedRow: Record<string, string>) => {
        if (editingRowIndex === null) return
        setRows((prev) => {
            const next = [...prev]
            next[editingRowIndex] = updatedRow
            return next
        })
    }, [editingRowIndex])

    const handleSendEmail = useCallback((index: number) => {
        setEmailRowIndex(index)
    }, [])

    const handleCodesGenerated = useCallback((codes: string[]) => {
        // Add "Code" column if not present
        setHeaders((prev) => {
            if (prev.includes("Code")) return prev
            return [...prev, "Code"]
        })

        // Assign one code per row
        setRows((prev) =>
            prev.map((row, i) => ({
                ...row,
                Code: codes[i] || "",
            }))
        )
    }, [])

    return (
        <div className="flex-1 space-y-8 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-8">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#2563EB] mb-2">
                        <div className="w-2 h-2 bg-[#2563EB]" />
                        Admin / Import
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-[#050505]">
                        Import <span className="text-gray-300">& Gestion</span>
                    </h2>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">
                        Importez des fichiers CSV/Excel et gérez les données
                    </p>
                </div>
            </div>

            {/* File Upload Zone */}
            <FileUploader onDataLoaded={handleDataLoaded} />

            {/* Data Table */}
            {hasData && (
                <>
                    <DataTable
                        headers={headers}
                        rows={rows}
                        onEditRow={handleEditRow}
                        onSendEmail={handleSendEmail}
                    />

                    {/* Global Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => setShowCourseCode(true)}
                            className="flex-1 sm:flex-none px-6 py-4 bg-[#050505] text-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-all flex items-center justify-center gap-2"
                        >
                            <KeyRound className="w-4 h-4" />
                            Générer un Code pour un Cours pour Tout le Monde
                        </button>

                        <button
                            onClick={() => {
                                if (!emailColumn) {
                                    toast.error("Aucune colonne email détectée dans les données")
                                    return
                                }
                                setShowBulkEmail(true)
                            }}
                            className="flex-1 sm:flex-none px-6 py-4 bg-[#2563EB] text-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#1d4ed8] transition-all flex items-center justify-center gap-2"
                        >
                            <Mail className="w-4 h-4" />
                            Envoyer un Mail à Tout le Monde
                        </button>
                    </div>
                </>
            )}

            {/* Dialogs */}
            {editingRowIndex !== null && (
                <EditRowDialog
                    open={true}
                    onClose={() => setEditingRowIndex(null)}
                    headers={headers}
                    row={rows[editingRowIndex]}
                    onSave={handleSaveRow}
                />
            )}

            {emailRowIndex !== null && emailColumn && (
                <SendEmailDialog
                    open={true}
                    onClose={() => setEmailRowIndex(null)}
                    recipientEmail={rows[emailRowIndex][emailColumn]}
                    rowData={rows[emailRowIndex]}
                />
            )}

            <BulkEmailDialog
                open={showBulkEmail}
                onClose={() => setShowBulkEmail(false)}
                rows={rows}
                headers={headers}
            />

            <CourseCodeDialog
                open={showCourseCode}
                onClose={() => setShowCourseCode(false)}
                rowCount={rows.length}
                onCodesGenerated={handleCodesGenerated}
            />
        </div>
    )
}
