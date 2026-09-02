/**
 * Libellés d'affichage des mouvements du grand livre.
 * Module volontairement sans dépendance serveur : il est importé aussi bien par
 * la page portefeuille que par la carte du profil, toutes deux côté client.
 */
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    TOPUP: "Recharge",
    PAYMENT: "Achat",
    REFUND: "Remboursement",
    PAYOUT: "Retrait",
    PAYOUT_REVERSAL: "Retrait annulé",
    ADJUSTMENT: "Régularisation",
};
