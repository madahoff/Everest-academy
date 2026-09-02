"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X, ExternalLink, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { HOME_CURRENCY, formatAmount, type Currency } from "@/lib/pricing";

export type PaymentMode = "mobile_money" | "international";

export interface PaymentPollResult {
    terminal?: boolean;
    status?: string;
    done?: boolean;
    granted?: boolean;
    [key: string]: unknown;
}

interface PaymentDialogProps {
    /** URL de paiement Vanilla Pay renvoyée par le serveur. */
    paymentUrl: string;
    mode: PaymentMode;
    /** Route à sonder pour connaître l'issue réelle (commande ou recharge). */
    pollUrl: string;
    /**
     * Origine du Wallet API, telle que renvoyée par le serveur à l'ouverture du
     * paiement. Seuls les messages venant d'elle sont écoutés. Absente (service non
     * configuré), le postMessage est ignoré : le sondage suffit à conclure.
     */
    expectedOrigin?: string | null;
    title: string;
    amount: number;
    /** Devise du montant affiché. Ariary par défaut, comportement historique. */
    currency?: Currency;
    onSuccess: (result: PaymentPollResult) => void;
    onFailure: (result: PaymentPollResult) => void;
    onClose: () => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Fenêtre de paiement Vanilla Pay.
 *
 * Deux contextes d'affichage, imposés par le mode :
 *  - mobile_money : la page s'intègre en iframe ;
 *  - international : les banques bloquent souvent l'iframe (3-D Secure), on ouvre
 *    donc une popup et la fenêtre reste sur un écran d'attente.
 *
 * Le paiement est terminé quand le SERVEUR le dit. Ni le postMessage de la page de
 * retour, ni les paramètres d'URL ne font autorité : ils ne servent qu'à déclencher
 * un sondage immédiat au lieu d'attendre le tick suivant.
 */
export default function PaymentDialog({
    paymentUrl,
    mode,
    pollUrl,
    expectedOrigin,
    title,
    amount,
    currency = HOME_CURRENCY,
    onSuccess,
    onFailure,
    onClose,
}: PaymentDialogProps) {
    const [phase, setPhase] = useState<"waiting" | "checking" | "done" | "failed" | "timeout">("waiting");
    const [popupBlocked, setPopupBlocked] = useState(false);
    const settledRef = useRef(false);
    const popupRef = useRef<Window | null>(null);

    const poll = useCallback(async (): Promise<boolean> => {
        if (settledRef.current) return true;

        try {
            const res = await fetch(pollUrl, { cache: "no-store" });
            if (!res.ok) return false;

            const data: PaymentPollResult = await res.json();
            if (!data.terminal) return false;

            settledRef.current = true;
            const success = data.done === true || data.status === "PAID" || data.status === "SUCCESS";
            setPhase(success ? "done" : "failed");
            // Laisse à l'utilisateur le temps de lire l'issue avant de rendre la main.
            setTimeout(() => (success ? onSuccess(data) : onFailure(data)), 1200);
            return true;
        } catch {
            // Réseau instable : on retentera au tick suivant.
            return false;
        }
    }, [pollUrl, onSuccess, onFailure]);

    // Popup pour le mode international (une iframe y est le plus souvent bloquée).
    useEffect(() => {
        if (mode !== "international") return;
        const popup = window.open(paymentUrl, "everest-payment", "width=520,height=720,noopener=no");
        popupRef.current = popup;
        if (!popup) setPopupBlocked(true);
        return () => {
            try {
                popupRef.current?.close();
            } catch {
                // La popup a pu être fermée par l'utilisateur : sans conséquence.
            }
        };
    }, [mode, paymentUrl]);

    // Le payeur a terminé : la page de retour du Wallet API nous le signale.
    useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (!expectedOrigin || event.origin !== expectedOrigin) return;
            if ((event.data as { type?: string })?.type !== "vpi:done") return;
            setPhase("checking");
            void poll();
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [poll, expectedOrigin]);

    // Filet : le message peut ne jamais arriver (onglet fermé, popup bloquée,
    // navigateur restrictif). Le sondage régulier est ce qui garantit l'issue.
    useEffect(() => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (settledRef.current) {
                clearInterval(timer);
                return;
            }
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                clearInterval(timer);
                setPhase("timeout");
                return;
            }
            void poll();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [poll]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white border border-gray-100 shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Paiement sécurisé</p>
                        <h2 className="text-lg font-bold uppercase tracking-tighter mt-1">{title}</h2>
                        <p className="text-2xl font-black tracking-tighter text-[#001F3F] mt-2">
                            {formatAmount(amount, currency)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fermer"
                        className="p-2 text-gray-400 hover:text-[#050505] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {phase === "done" && (
                        <div className="p-12 flex flex-col items-center text-center gap-4">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                            <p className="font-bold uppercase tracking-widest text-sm">Paiement confirmé</p>
                        </div>
                    )}

                    {phase === "failed" && (
                        <div className="p-12 flex flex-col items-center text-center gap-4">
                            <AlertCircle className="w-12 h-12 text-red-500" />
                            <p className="font-bold uppercase tracking-widest text-sm">Paiement non abouti</p>
                            <p className="text-xs text-gray-500 font-light">
                                Aucun montant n&apos;a été prélevé. Vous pouvez réessayer.
                            </p>
                        </div>
                    )}

                    {phase === "timeout" && (
                        <div className="p-12 flex flex-col items-center text-center gap-4">
                            <AlertCircle className="w-12 h-12 text-amber-500" />
                            <p className="font-bold uppercase tracking-widest text-sm">Toujours en attente</p>
                            <p className="text-xs text-gray-500 font-light max-w-xs">
                                Si vous avez validé le paiement, il sera pris en compte automatiquement. Rouvrez cette
                                page dans quelques instants pour vérifier.
                            </p>
                        </div>
                    )}

                    {(phase === "waiting" || phase === "checking") && mode === "mobile_money" && (
                        <iframe
                            src={paymentUrl}
                            title="Paiement Mobile Money"
                            className="w-full h-[520px] border-0"
                            allow="payment"
                        />
                    )}

                    {(phase === "waiting" || phase === "checking") && mode === "international" && (
                        <div className="p-10 flex flex-col items-center text-center gap-5">
                            <Loader2 className="w-10 h-10 animate-spin text-[#2563EB]" />
                            <p className="text-sm font-bold uppercase tracking-widest">
                                {phase === "checking" ? "Vérification en cours…" : "Paiement ouvert dans une fenêtre"}
                            </p>
                            <p className="text-xs text-gray-500 font-light max-w-xs">
                                Terminez le paiement par carte dans la fenêtre ouverte. Cette page se mettra à jour
                                automatiquement.
                            </p>
                            {popupBlocked && (
                                <p className="text-xs text-amber-600 font-medium">
                                    La fenêtre a été bloquée par votre navigateur.
                                </p>
                            )}
                            <a
                                href={paymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:border-[#001F3F] transition-colors"
                            >
                                <ExternalLink className="w-3 h-3" /> Rouvrir la page de paiement
                            </a>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                        <ShieldCheck className="w-3 h-3 text-[#2563EB]" /> Vanilla Pay International
                    </span>
                    {phase !== "done" && (
                        <button
                            onClick={() => {
                                setPhase("checking");
                                void poll();
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:text-[#001F3F] transition-colors"
                        >
                            J&apos;ai terminé le paiement
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
