import { useState } from "react"
import { toast } from "sonner"

export interface BulkEmailRecipient {
    email: string
    variables: Record<string, string>
}

export interface BulkEmailResult {
    sent: number
    failed: { email: string; error: string }[]
}

/**
 * Sends one email per recipient sequentially against /api/import/send-email,
 * tracking progress so the UI can show "x/y" while sending.
 */
export function useBulkEmailSender() {
    const [sending, setSending] = useState(false)
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
    const [result, setResult] = useState<BulkEmailResult | null>(null)

    const send = async (recipients: BulkEmailRecipient[], subject: string, htmlBody: string) => {
        setSending(true)
        setResult(null)
        setProgress({ current: 0, total: recipients.length })

        let sentCount = 0
        const failedList: { email: string; error: string }[] = []

        for (let i = 0; i < recipients.length; i++) {
            setProgress({ current: i + 1, total: recipients.length })

            try {
                const res = await fetch("/api/import/send-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ recipients: [recipients[i]], subject, htmlBody }),
                })

                const data = await res.json()
                if (!res.ok) throw new Error(data.error)

                if (data.sent > 0) sentCount++
                if (data.failed?.length > 0) failedList.push(...data.failed)
            } catch (err: any) {
                failedList.push({ email: recipients[i].email, error: err.message || "Erreur d'envoi" })
            }
        }

        const finalResult = { sent: sentCount, failed: failedList }
        setResult(finalResult)

        if (sentCount > 0) toast.success(`${sentCount} email(s) envoyé(s) avec succès`)
        if (failedList.length > 0) toast.error(`${failedList.length} email(s) échoué(s)`)

        setSending(false)
        setProgress(null)
        return finalResult
    }

    const reset = () => {
        setResult(null)
        setProgress(null)
    }

    return { send, sending, progress, result, reset }
}
