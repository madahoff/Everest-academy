"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Wallet, Smartphone, CreditCard, Loader2, ArrowRight } from "lucide-react";
import PaymentDialog, { type PaymentMode, type PaymentPollResult } from "@/components/payment-dialog";
import { HOME_CURRENCY, formatAmount, methodsFor, type Currency } from "@/lib/pricing";

type Method = "WALLET" | "MOBILE_MONEY" | "CARD";

interface OrderPayload {
    id: string;
    status: string;
    amount: number;
    firstCourseId: string | null;
    firstSectionId: string | null;
    pollUrl: string;
}

interface PaymentMethodsProps {
    /** Route de règlement : /api/checkout ou /api/courses/:id/purchase. */
    endpoint: string;
    amount: number;
    /**
     * Devise du montant. Elle décide aussi des moyens présentés : hors ariary, ni le
     * solde (tenu en ariary) ni le Mobile Money (service malgache) ne peuvent régler.
     */
    currency?: Currency;
    /** Libellé affiché dans la fenêtre de paiement. */
    label: string;
    /** Chemin de retour (relatif) où renvoyer le payeur après Vanilla Pay. */
    returnPath: string;
    onPaid: (order: OrderPayload) => void;
    /** Chemin vers lequel envoyer un visiteur non connecté. */
    loginCallbackUrl?: string;
    dark?: boolean;
}

/**
 * Choix du moyen de paiement, puis règlement.
 *
 * Trois chemins, une seule mécanique côté serveur : le solde règle immédiatement,
 * Mobile Money et carte ouvrent un paiement Vanilla Pay dont l'issue est ensuite
 * sondée. Aucun code d'accès n'intervient : l'achat est direct.
 */
export default function PaymentMethods({
    endpoint,
    amount,
    currency = HOME_CURRENCY,
    label,
    returnPath,
    onPaid,
    loginCallbackUrl,
    dark = false,
}: PaymentMethodsProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const available = methodsFor(currency);

    const [balance, setBalance] = useState<number | null>(null);
    const [walletConfigured, setWalletConfigured] = useState(true);
    const [pending, setPending] = useState<Method | null>(null);
    const [settling, setSettling] = useState(false);
    const [error, setError] = useState<{ code: string; message: string } | null>(null);
    const [dialog, setDialog] = useState<{
        paymentUrl: string;
        mode: PaymentMode;
        pollUrl: string;
        origin: string | null;
    } | null>(null);

    const refreshBalance = useCallback(async () => {
        if (!session?.user) return;
        // Commande en euros : le solde ne peut pas la régler, inutile d'aller le lire.
        if (!methodsFor(currency).includes("WALLET")) return;
        try {
            const res = await fetch("/api/wallet", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setWalletConfigured(data.configured !== false);
            setBalance(typeof data.balance === "number" ? data.balance : null);
        } catch {
            // Solde indisponible : les autres moyens de paiement restent utilisables.
        }
    }, [session, currency]);

    useEffect(() => {
        void refreshBalance();
    }, [refreshBalance]);

    /**
     * Attend que le serveur ait accordé les accès d'une commande déjà réglée. Ne se
     * produit qu'après un incident technique survenu entre le débit et l'octroi ;
     * chaque sondage déclenche une nouvelle tentative côté serveur.
     */
    const awaitSettlement = async (pollUrl: string) => {
        setSettling(true);
        try {
            for (let attempt = 0; attempt < 10; attempt++) {
                try {
                    const res = await fetch(pollUrl, { cache: "no-store" });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.status === "PAID" && data.granted) {
                            toast.success("Paiement confirmé. Accès débloqué.");
                            await refreshBalance();
                            onPaid(data);
                            return;
                        }
                        if (data.status === "FAILED") {
                            setError({ code: "payment_failed", message: "Le paiement n'a pas abouti." });
                            return;
                        }
                    }
                } catch {
                    // Réseau instable : on retente.
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
            setError({
                code: "settlement_pending",
                message:
                    "Votre paiement a bien été enregistré, mais l'accès n'est pas encore actif. Il le sera dans quelques instants — rechargez la page.",
            });
        } finally {
            setSettling(false);
        }
    };

    const pay = async (method: Method) => {
        if (!session?.user) {
            router.push(`/auth/login?callbackUrl=${encodeURIComponent(loginCallbackUrl ?? returnPath)}`);
            return;
        }

        setPending(method);
        setError(null);

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method, returnPath }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError({ code: data.error ?? "internal_error", message: data.message ?? "Le paiement a échoué" });
                return;
            }

            if (data.order?.status === "PAID") {
                toast.success("Paiement confirmé. Accès débloqué.");
                await refreshBalance();
                onPaid(data.order);
                return;
            }

            if (data.paymentUrl && data.order?.pollUrl) {
                setDialog({
                    paymentUrl: data.paymentUrl,
                    mode: data.mode ?? "mobile_money",
                    pollUrl: data.order.pollUrl,
                    origin: data.paymentOrigin ?? null,
                });
                return;
            }

            if (data.order?.pollUrl) {
                // Réglé mais accès pas encore accordés : le serveur rattrape à chaque
                // sondage, on attend ici plutôt que de laisser croire à un échec.
                await awaitSettlement(data.order.pollUrl);
                return;
            }

            setError({ code: "no_payment_url", message: "Le service de paiement n'a pas renvoyé de lien." });
        } catch {
            setError({ code: "network_error", message: "Connexion impossible. Vérifiez votre réseau." });
        } finally {
            setPending(null);
        }
    };

    const onDialogSuccess = async (result: PaymentPollResult) => {
        setDialog(null);
        toast.success("Paiement confirmé. Accès débloqué.");
        await refreshBalance();
        onPaid(result as unknown as OrderPayload);
    };

    const onDialogFailure = () => {
        setDialog(null);
        setError({ code: "payment_failed", message: "Le paiement n'a pas abouti. Aucun montant n'a été prélevé." });
    };

    const walletUsable = walletConfigured && balance !== null && balance >= amount;
    const muted = dark ? "text-gray-500" : "text-gray-400";

    return (
        <div className="space-y-3">
            {/* Solde — ariary uniquement */}
            {available.includes("WALLET") && (
            <button
                onClick={() => pay("WALLET")}
                disabled={pending !== null || settling || (session?.user != null && !walletUsable)}
                className={`w-full flex items-center justify-between gap-3 px-5 py-4 border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    dark
                        ? "bg-white text-[#050505] border-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]"
                        : "bg-[#001F3F] text-white border-[#001F3F] hover:bg-[#2563EB] hover:border-[#2563EB]"
                }`}
            >
                <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                    {pending === "WALLET" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Payer avec mon solde
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                    {balance === null ? "—" : formatAmount(balance, HOME_CURRENCY)}
                </span>
            </button>
            )}

            {available.includes("WALLET") && session?.user && walletConfigured && balance !== null && balance < amount && (
                <button
                    onClick={() => router.push("/wallet")}
                    className="w-full text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:text-[#001F3F] flex items-center justify-center gap-1 transition-colors"
                >
                    Solde insuffisant — recharger le portefeuille <ArrowRight className="w-3 h-3" />
                </button>
            )}

            {/* Mobile Money — MVola / Orange / Airtel, donc Madagascar uniquement */}
            {available.includes("MOBILE_MONEY") && (
            <button
                onClick={() => pay("MOBILE_MONEY")}
                disabled={pending !== null || settling}
                className={`w-full flex items-center gap-3 px-5 py-4 border text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
                    dark
                        ? "border-gray-700 text-white hover:border-white"
                        : "border-gray-200 text-[#001F3F] hover:border-[#001F3F]"
                }`}
            >
                {pending === "MOBILE_MONEY" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Smartphone className="w-4 h-4 text-[#2563EB]" />
                )}
                Mobile Money
                <span className={`ml-auto text-[9px] font-medium normal-case tracking-normal ${muted}`}>
                    MVola · Orange · Airtel
                </span>
            </button>
            )}

            {/* Carte bancaire */}
            <button
                onClick={() => pay("CARD")}
                disabled={pending !== null || settling}
                className={`w-full flex items-center gap-3 px-5 py-4 border text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
                    dark
                        ? "border-gray-700 text-white hover:border-white"
                        : "border-gray-200 text-[#001F3F] hover:border-[#001F3F]"
                }`}
            >
                {pending === "CARD" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <CreditCard className="w-4 h-4 text-[#2563EB]" />
                )}
                Carte bancaire
                <span className={`ml-auto text-[9px] font-medium normal-case tracking-normal ${muted}`}>
                    Visa · Mastercard · PayPal
                </span>
            </button>

            {settling && (
                <p className="flex items-center justify-center gap-2 p-3 text-[10px] font-bold uppercase tracking-widest text-[#2563EB]">
                    <Loader2 className="w-3 h-3 animate-spin" /> Validation du paiement…
                </p>
            )}

            {error && (
                <div className="p-3 border border-red-200 bg-red-50 text-[11px] text-red-600 font-medium text-center">
                    {error.message}
                    {error.code === "insufficient_funds" && (
                        <button
                            onClick={() => router.push("/wallet")}
                            className="block mx-auto mt-2 underline font-bold uppercase tracking-widest text-[10px]"
                        >
                            Recharger
                        </button>
                    )}
                </div>
            )}

            {dialog && (
                <PaymentDialog
                    paymentUrl={dialog.paymentUrl}
                    mode={dialog.mode}
                    pollUrl={dialog.pollUrl}
                    expectedOrigin={dialog.origin}
                    title={label}
                    amount={amount}
                    currency={currency}
                    onSuccess={onDialogSuccess}
                    onFailure={onDialogFailure}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
