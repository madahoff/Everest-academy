import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import type { VerificationPurpose } from "@prisma/client"

const TTL_MS = parseInt(process.env.MAGIC_LINK_TTL_MINUTES || "15") * 60 * 1000
const RATE_LIMIT_MAX = parseInt(process.env.MAGIC_LINK_RATE_LIMIT_MAX || "3")
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.MAGIC_LINK_RATE_LIMIT_WINDOW_MINUTES || "15") * 60 * 1000
const RESEND_COOLDOWN_MS = parseInt(process.env.MAGIC_LINK_RESEND_COOLDOWN_SECONDS || "60") * 1000

function hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

function logAuthAttempt(data: {
    email: string
    purpose: VerificationPurpose
    action: "REQUEST" | "CONSUME"
    success: boolean
    reason: string
    ip?: string | null
    userAgent?: string | null
}) {
    return prisma.authAuditLog.create({
        data: {
            email: data.email,
            purpose: data.purpose,
            action: data.action,
            success: data.success,
            reason: data.reason,
            ip: data.ip || null,
            userAgent: data.userAgent || null,
        },
    }).catch((err) => console.error("Failed to write auth audit log:", err))
}

export class MagicLinkRateLimitError extends Error {
    retryAfterSeconds: number
    constructor(message: string, retryAfterSeconds: number) {
        super(message)
        this.retryAfterSeconds = retryAfterSeconds
    }
}

export async function createMagicLink({
    email,
    purpose,
    payload,
    ip,
}: {
    email: string
    purpose: VerificationPurpose
    payload?: Record<string, unknown>
    ip?: string | null
}) {
    const last = await prisma.verificationLink.findFirst({
        where: { email, purpose },
        orderBy: { createdAt: "desc" },
    })

    if (last) {
        const elapsedMs = Date.now() - last.createdAt.getTime()
        if (elapsedMs < RESEND_COOLDOWN_MS) {
            const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000)
            await logAuthAttempt({ email, purpose, action: "REQUEST", success: false, reason: "cooldown", ip })
            throw new MagicLinkRateLimitError("Veuillez patienter avant de demander un nouveau lien", retryAfterSeconds)
        }
    }

    const recentCount = await prisma.verificationLink.count({
        where: { email, purpose, createdAt: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
    })

    if (recentCount >= RATE_LIMIT_MAX) {
        await logAuthAttempt({ email, purpose, action: "REQUEST", success: false, reason: "rate_limited", ip })
        throw new MagicLinkRateLimitError("Trop de demandes, veuillez réessayer plus tard", Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
    }

    const token = crypto.randomBytes(32).toString("base64url")
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + TTL_MS)

    await prisma.verificationLink.create({
        data: {
            tokenHash,
            email,
            purpose,
            payload: payload ? JSON.stringify(payload) : null,
            expiresAt,
            requestIp: ip || null,
        },
    })

    await logAuthAttempt({ email, purpose, action: "REQUEST", success: true, reason: "ok", ip })

    return { token, expiresAt }
}

export async function consumeMagicLink({
    token,
    ip,
    userAgent,
}: {
    token: string
    ip?: string | null
    userAgent?: string | null
}) {
    const tokenHash = hashToken(token)

    // Atomic claim: prevents replay/double-use race conditions (e.g. double-click, link prefetch)
    const claimed = await prisma.verificationLink.updateMany({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
    })

    if (claimed.count === 0) {
        const existing = await prisma.verificationLink.findUnique({ where: { tokenHash } })
        const reason = !existing ? "not_found" : existing.consumedAt ? "already_used" : "expired"
        await logAuthAttempt({
            email: existing?.email ?? "unknown",
            purpose: existing?.purpose ?? "LOGIN",
            action: "CONSUME",
            success: false,
            reason,
            ip,
            userAgent,
        })
        return { ok: false as const, reason }
    }

    const link = await prisma.verificationLink.findUnique({ where: { tokenHash } })

    await logAuthAttempt({
        email: link!.email,
        purpose: link!.purpose,
        action: "CONSUME",
        success: true,
        reason: "ok",
        ip,
        userAgent,
    })

    return {
        ok: true as const,
        email: link!.email,
        purpose: link!.purpose,
        payload: link!.payload,
    }
}
