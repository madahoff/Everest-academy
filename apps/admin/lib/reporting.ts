/**
 * Périodes calendaires du reporting de la console.
 *
 * Module volontairement sans accès à la base : le tableau de bord est un composant
 * client et importe les libellés d'ici. Les agrégats vivent dans `course-sales.ts`.
 */

export type ReportingPeriod = "week" | "month" | "quarter" | "year"

export const REPORTING_PERIODS: ReportingPeriod[] = ["week", "month", "quarter", "year"]

export const PERIOD_LABELS: Record<ReportingPeriod, string> = {
    week: "Semaine",
    month: "Mois",
    quarter: "Trimestre",
    year: "Année",
}

/**
 * Fuseau des bornes de période. Les conteneurs tournent en UTC : sans ce réglage,
 * « le mois en cours » basculerait à 21h heure de Madagascar, et les ventes des trois
 * premières heures du mois seraient comptées sur le mois précédent.
 */
const TIME_ZONE = process.env.REPORTING_TIMEZONE || "Indian/Antananarivo"

const PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
})

function partsOf(date: Date) {
    const parts: Record<string, string> = {}
    for (const { type, value } of PARTS_FORMAT.formatToParts(date)) parts[type] = value
    return {
        year: Number(parts.year),
        month: Number(parts.month), // 1-12
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    }
}

/** Décalage du fuseau de reporting par rapport à UTC, à cet instant précis. */
function offsetMs(date: Date): number {
    const p = partsOf(date)
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Instant UTC de minuit, heure du fuseau de reporting, pour la date civile donnée.
 * `month` est indexé à partir de 0 et les débordements sont tolérés (`day` négatif,
 * `month` à 12) : `Date.UTC` les reporte sur le mois ou l'année voisine.
 */
function zonedMidnight(year: number, month: number, day: number): Date {
    const guess = Date.UTC(year, month, day)
    return new Date(guess - offsetMs(new Date(guess)))
}

export interface PeriodRange {
    period: ReportingPeriod
    /** Début inclus. */
    start: Date
    /** Fin exclue. */
    end: Date
    previousStart: Date
    previousEnd: Date
    /** Libellé affichable, ex. « Septembre 2026 » ou « T3 2026 ». */
    label: string
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Normalise le paramètre `period` reçu du client. Défaut : le mois en cours. */
export function parsePeriod(value: string | null | undefined): ReportingPeriod {
    return REPORTING_PERIODS.includes(value as ReportingPeriod) ? (value as ReportingPeriod) : "month"
}

/**
 * Bornes de la période calendaire en cours, et de celle qui la précède.
 *
 * Les bornes sont recalculées à chaque appel à partir de l'instant courant : le total
 * d'un mois repart donc de zéro le 1er à minuit, sans tâche planifiée ni remise à zéro
 * stockée quelque part.
 */
export function resolvePeriod(period: ReportingPeriod, now: Date = new Date()): PeriodRange {
    const { year, month, day } = partsOf(now)
    const m = month - 1

    let start: Date
    let end: Date
    let previousStart: Date
    let label: string

    switch (period) {
        case "week": {
            // Le jour de la semaine se déduit de la date civile, indépendamment du fuseau.
            const weekday = new Date(Date.UTC(year, m, day)).getUTCDay() // 0 = dimanche
            const sinceMonday = (weekday + 6) % 7
            start = zonedMidnight(year, m, day - sinceMonday)
            end = zonedMidnight(year, m, day - sinceMonday + 7)
            previousStart = zonedMidnight(year, m, day - sinceMonday - 7)
            label = `Semaine du ${new Intl.DateTimeFormat("fr-FR", {
                timeZone: TIME_ZONE,
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(start)}`
            break
        }
        case "quarter": {
            const quarter = Math.floor(m / 3)
            start = zonedMidnight(year, quarter * 3, 1)
            end = zonedMidnight(year, quarter * 3 + 3, 1)
            previousStart = zonedMidnight(year, quarter * 3 - 3, 1)
            label = `T${quarter + 1} ${year}`
            break
        }
        case "year": {
            start = zonedMidnight(year, 0, 1)
            end = zonedMidnight(year + 1, 0, 1)
            previousStart = zonedMidnight(year - 1, 0, 1)
            label = String(year)
            break
        }
        case "month":
        default: {
            start = zonedMidnight(year, m, 1)
            end = zonedMidnight(year, m + 1, 1)
            previousStart = zonedMidnight(year, m - 1, 1)
            label = capitalize(
                new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, month: "long", year: "numeric" }).format(start),
            )
            break
        }
    }

    return { period, start, end, previousStart, previousEnd: start, label }
}
