/**
 * Vocabulaire commun de l'annuaire des membres : ce qu'une ligne porte, et comment
 * la recherche et les filtres la retiennent.
 *
 * Isolé de la page pour que la règle d'accès — « PREMIUM ouvre tout le catalogue » —
 * soit écrite UNE fois, et lue de la même façon par la colonne d'accès, par le filtre
 * et par le choix des destinataires d'un email.
 */

export type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT"
export type Plan = "FREE" | "PREMIUM"
export type Status = "ACTIVE" | "INACTIVE"

export interface DirectoryUser {
    id: string
    name: string
    email: string
    role: Role
    plan: Plan
    status: Status
    createdAt: string
    /** Accès accordés cours par cours (achat, code, inscription offerte, octroi console). */
    courseIds: string[]
    /** Parmi eux, ceux qui ont été PAYÉS : les retirer efface de la recette. */
    paidCourseIds: string[]
}

export interface DirectoryCourse {
    id: string
    title: string
    status: "ACTIVE" | "DRAFT"
}

export interface DirectoryFilters {
    search: string
    roles: Role[]
    plans: Plan[]
    statuses: Status[]
    /** Cours dont on veut voir les membres qui y ont accès (au moins un des cochés). */
    courseIds: string[]
}

export const EMPTY_FILTERS: DirectoryFilters = {
    search: "",
    roles: [],
    plans: [],
    statuses: [],
    courseIds: [],
}

export const ROLE_LABELS: Record<Role, string> = {
    ADMIN: "Admin",
    INSTRUCTOR: "Instructeur",
    STUDENT: "Étudiant",
}

export const PLAN_LABELS: Record<Plan, string> = {
    FREE: "Gratuit",
    PREMIUM: "Premium",
}

export const STATUS_LABELS: Record<Status, string> = {
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
}

/**
 * Ce membre a-t-il accès à ce cours ? Un compte PREMIUM a tout le catalogue, sans
 * qu'aucune ligne d'achat n'ait à l'attester — c'est la règle du site
 * (`apps/web/lib/premium.ts`), reprise ici telle quelle.
 */
export function hasCourseAccess(user: DirectoryUser, courseId: string): boolean {
    return user.plan === "PREMIUM" || user.courseIds.includes(courseId)
}

/** Nombre de cours du catalogue ouverts à ce membre. */
export function accessCount(user: DirectoryUser, courses: DirectoryCourse[]): number {
    if (user.plan === "PREMIUM") return courses.length
    const catalogue = new Set(courses.map((c) => c.id))
    return user.courseIds.filter((id) => catalogue.has(id)).length
}

/** Recherche libre : nom, email ou rôle, insensible à la casse. */
function matchesSearch(user: DirectoryUser, search: string): boolean {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        ROLE_LABELS[user.role].toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q)
    )
}

/**
 * Applique recherche et filtres. Un filtre vide ne restreint rien ; plusieurs valeurs
 * cochées dans un même filtre s'additionnent (OU), les filtres entre eux se cumulent (ET).
 */
export function filterUsers(users: DirectoryUser[], filters: DirectoryFilters): DirectoryUser[] {
    return users.filter((user) => {
        if (!matchesSearch(user, filters.search)) return false
        if (filters.roles.length > 0 && !filters.roles.includes(user.role)) return false
        if (filters.plans.length > 0 && !filters.plans.includes(user.plan)) return false
        if (filters.statuses.length > 0 && !filters.statuses.includes(user.status)) return false
        if (filters.courseIds.length > 0 && !filters.courseIds.some((id) => hasCourseAccess(user, id))) return false
        return true
    })
}

/** Un filtre est-il posé ? Sert à dire si « le résultat du filtre » diffère de tout l'annuaire. */
export function hasActiveFilters(filters: DirectoryFilters): boolean {
    return (
        filters.search.trim().length > 0 ||
        filters.roles.length > 0 ||
        filters.plans.length > 0 ||
        filters.statuses.length > 0 ||
        filters.courseIds.length > 0
    )
}
