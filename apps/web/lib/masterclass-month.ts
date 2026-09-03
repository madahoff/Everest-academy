/**
 * Rattachement mensuel des Masterclass.
 *
 * Une Masterclass est la session d'UN mois, désignée par sa clé « YYYY-MM ». Cette
 * clé est calculée dans le fuseau de Madagascar, comme les périodes du reporting :
 * les conteneurs tournent en UTC, et un mois qui basculerait à 21h heure locale
 * rattacherait les trois premières heures du mois à la session précédente.
 *
 * Module volontairement PUR et sans accès à la base : il est importé par des routes
 * d'API, des composants serveur et des composants client.
 */

/** Même fuseau que le reporting de la console : une seule notion de « mois ». */
const TIME_ZONE = process.env.REPORTING_TIMEZONE || "Indian/Antananarivo";

const PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

function partsOf(date: Date) {
    const parts: Record<string, string> = {};
    for (const { type, value } of PARTS_FORMAT.formatToParts(date)) parts[type] = value;
    return {
        year: Number(parts.year),
        month: Number(parts.month), // 1-12
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    };
}

/** Décalage du fuseau par rapport à UTC, à cet instant précis. */
function offsetMs(date: Date): number {
    const p = partsOf(date);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Instant UTC correspondant à une heure civile de Madagascar. `month` est indexé à
 * partir de 0 et les débordements sont tolérés — `Date.UTC` les reporte sur le mois
 * voisin.
 */
function zonedInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
    const guess = Date.UTC(year, month, day, hour, minute);
    return new Date(guess - offsetMs(new Date(guess)));
}

/** Instant UTC de minuit, heure de Madagascar, pour la date civile donnée. */
function zonedMidnight(year: number, month: number, day: number): Date {
    return zonedInstant(year, month, day);
}

/** Clé de mois d'une date : « 2026-09 ». */
export function monthKeyOf(date: Date): string {
    const { year, month } = partsOf(date);
    return `${year}-${String(month).padStart(2, "0")}`;
}

/** Clé du mois EN COURS. Bascule seule le 1er à minuit, heure de Madagascar. */
export function currentMonthKey(now: Date = new Date()): string {
    return monthKeyOf(now);
}

/** Clé du mois suivant celui de `key`. Sert à proposer la session à préparer. */
export function nextMonthKey(key: string): string {
    const parsed = parseMonthKey(key);
    if (!parsed) return currentMonthKey();
    const { year, month } = parsed;
    return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** « 2026-09 » → { year: 2026, month: 9 }, ou `null` si la clé est mal formée. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key.trim());
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]) };
}

/** La clé est-elle un mois valide ? */
export function isMonthKey(value: unknown): value is string {
    return typeof value === "string" && parseMonthKey(value) !== null;
}

/** Bornes du mois, début inclus et fin exclue, en instants UTC. */
export function monthRange(key: string): { start: Date; end: Date } | null {
    const parsed = parseMonthKey(key);
    if (!parsed) return null;
    return {
        start: zonedMidnight(parsed.year, parsed.month - 1, 1),
        end: zonedMidnight(parsed.year, parsed.month, 1),
    };
}

/** « Septembre 2026 », pour l'affichage. */
export function monthLabel(key: string): string {
    const range = monthRange(key);
    if (!range) return key;
    const label = new Intl.DateTimeFormat("fr-FR", {
        timeZone: TIME_ZONE,
        month: "long",
        year: "numeric",
    }).format(range.start);
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Date et heure d'une séance, en toutes lettres : « jeudi 24 septembre 2026 à 18:00 ». */
export function formatSessionDate(date: Date | string): string {
    const value = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(value);
}

/** Version courte, pour les tableaux : « 24/09/2026 18:00 ». */
export function formatSessionDateShort(date: Date | string): string {
    const value = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(value);
}

// ─── Saisie d'une date de séance ──────────────────────────────────────────────
//
// L'heure d'une Masterclass est TOUJOURS annoncée en heure de Madagascar. Les deux
// fonctions ci-dessous font la conversion dans les deux sens, pour que la console
// n'ait jamais à dépendre du fuseau du navigateur de l'administrateur — un
// formateur saisi depuis Paris ne doit pas décaler la séance de deux heures.

/** « 2026-09-24T18:00 » lu en heure de Madagascar → instant UTC. */
export function fromLocalInput(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
    const date = zonedInstant(year, month - 1, day, hour, minute);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Inverse : instant → « 2026-09-24T18:00 », pour un `<input type="datetime-local">`. */
export function toLocalInput(date: Date | string): string {
    const value = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(value.getTime())) return "";
    const p = partsOf(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
