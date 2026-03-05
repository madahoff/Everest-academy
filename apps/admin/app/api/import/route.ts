import { NextResponse } from "next/server"
import { auth } from "@/auth"
import Papa from "papaparse"
import * as XLSX from "xlsx"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "Le fichier dépasse 10MB" }, { status: 400 })
        }

        const fileName = file.name.toLowerCase()
        let headers: string[] = []
        let rows: Record<string, string>[] = []

        if (fileName.endsWith(".csv")) {
            // Parse CSV
            const text = await file.text()
            const result = Papa.parse<Record<string, string>>(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h: string) => h.trim(),
            })

            if (result.errors.length > 0) {
                return NextResponse.json(
                    { error: "Erreur de parsing CSV", details: result.errors.slice(0, 5) },
                    { status: 400 }
                )
            }

            headers = result.meta.fields || []
            rows = result.data.map((row) => {
                const sanitized: Record<string, string> = {}
                for (const [key, value] of Object.entries(row)) {
                    sanitized[key] = String(value ?? "").trim()
                }
                return sanitized
            })
        } else if (
            fileName.endsWith(".xlsx") ||
            fileName.endsWith(".xls")
        ) {
            // Parse Excel
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: "array" })
            const sheetName = workbook.SheetNames[0]

            if (!sheetName) {
                return NextResponse.json({ error: "Le fichier Excel est vide" }, { status: 400 })
            }

            const sheet = workbook.Sheets[sheetName]!
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                defval: "",
            })

            if (jsonData.length === 0) {
                return NextResponse.json({ error: "Aucune donnée trouvée dans le fichier" }, { status: 400 })
            }

            headers = Object.keys(jsonData[0]!)
            rows = jsonData.map((row) => {
                const sanitized: Record<string, string> = {}
                for (const [key, value] of Object.entries(row)) {
                    sanitized[key.trim()] = String(value ?? "").trim()
                }
                return sanitized
            })
        } else {
            return NextResponse.json(
                { error: "Format non supporté. Utilisez .csv, .xlsx ou .xls" },
                { status: 400 }
            )
        }

        return NextResponse.json({ headers, rows, totalRows: rows.length })
    } catch (error) {
        console.error("Import error:", error)
        return NextResponse.json(
            { error: "Erreur lors du traitement du fichier" },
            { status: 500 }
        )
    }
}
