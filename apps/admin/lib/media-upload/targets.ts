/**
 * Champs de contenu auxquels un média envoyé peut être rattaché automatiquement.
 * Liste fermée : le rattachement n'écrit jamais ailleurs.
 */
export const ATTACH_FIELDS = {
    course: { heroImage: false, cardImage: false, welcomeVideo: false },
    section: { heroImage: false, cardImage: false, video: false },
    masterclass: { coverImage: true, presentationVideo: true },
} as const satisfies Record<string, Record<string, boolean>> // valeur : le champ est-il facultatif (nullable) ?

export type AttachEntity = keyof typeof ATTACH_FIELDS

export interface AttachTarget {
    entity: AttachEntity
    /** Identifiant du contenu. Absent tant qu'il n'est pas créé : rien n'est alors rattaché automatiquement. */
    id?: string
    field: string
    /** Valeur du champ au lancement de l'envoi : le rattachement est refusé si elle a changé depuis. */
    expected: string
    /** Libellé lisible pour le panneau de suivi (« Section — Vidéo pédagogique »). */
    label: string
}

export function isAttachable(entity: string, field: string): entity is AttachEntity {
    return entity in ATTACH_FIELDS && field in ATTACH_FIELDS[entity as AttachEntity]
}

export const MEDIA_URL_PATTERN = /^\/uploads\/(video|hero|card|misc)\/[A-Za-z0-9_.-]+$/
