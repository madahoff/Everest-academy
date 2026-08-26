import { NextResponse } from "next/server";
import { CheckoutError } from "@/lib/wallet";
import { WalletApiError } from "@/lib/wallet-api";

/**
 * Traduit une erreur du service de paiement ou du domaine en réponse HTTP.
 *
 * Le code (`error`) est un identifiant stable, destiné au code client ; `message`
 * est du texte français destiné à l'utilisateur. Le client doit brancher sa logique
 * sur `error`, jamais sur `message`.
 */
export function paymentErrorResponse(error: unknown): NextResponse {
    if (error instanceof CheckoutError) {
        return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }

    if (error instanceof WalletApiError) {
        return NextResponse.json(
            { error: error.code, message: userMessage(error), details: error.details },
            { status: httpStatusFor(error) },
        );
    }

    console.error("Erreur de paiement inattendue :", error);
    return NextResponse.json(
        { error: "internal_error", message: "Une erreur est survenue. Réessayez dans un instant." },
        { status: 500 },
    );
}

/**
 * Certains codes du Wallet API méritent un statut différent côté Everest : une
 * ressource introuvable chez lui (404 par étanchéité entre applications) n'est pas
 * forcément une 404 pour notre utilisateur.
 */
function httpStatusFor(error: WalletApiError): number {
    if (error.code === "wallet_not_configured") return 503;
    return error.status;
}

/** Les messages du service sont corrects mais techniques : on les reformule. */
function userMessage(error: WalletApiError): string {
    switch (error.code) {
        case "insufficient_funds":
            return "Solde insuffisant. Rechargez votre portefeuille pour continuer.";
        case "wallet_frozen":
            return "Votre portefeuille est momentanément gelé. Contactez le support.";
        case "invalid_msisdn":
            return "Numéro Mobile Money invalide.";
        case "amount_out_of_range":
            return "Montant hors des limites autorisées (1 000 Ar à 5 000 000 Ar).";
        case "wallet_not_configured":
            return "Le paiement en ligne n'est pas encore activé sur cette plateforme.";
        case "service_unavailable":
        case "upstream_error":
            return "Le service de paiement est momentanément indisponible. Réessayez dans un instant.";
        default:
            return error.message;
    }
}
