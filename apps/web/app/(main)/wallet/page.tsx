"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
    Wallet,
    Smartphone,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    Loader2,
    ShieldCheck,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";
import PaymentDialog, { type PaymentMode } from "@/components/payment-dialog";

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000];
const MIN_TOPUP = 1000;
const MAX_TOPUP = 5_000_000;

interface Transaction {
    id: string;
    direction: "CREDIT" | "DEBIT";
    type: string;
    amount: string;
    balanceAfter: string;
    description: string | null;
    createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
    TOPUP: "Recharge",
    PAYMENT: "Achat",
    REFUND: "Remboursement",
    PAYOUT: "Retrait",
    PAYOUT_REVERSAL: "Retrait annulé",
    ADJUSTMENT: "Régularisation",
};

function WalletPageContent() {
    const { data: session, status: sessionStatus } = useSession();
    const searchParams = useSearchParams();

    const [balance, setBalance] = useState<number | null>(null);
    const [currency, setCurrency] = useState("MGA");
    const [configured, setConfigured] = useState(true);
    const [walletStatus, setWalletStatus] = useState<"ACTIVE" | "FROZEN">("ACTIVE");
    const [loadingWallet, setLoadingWallet] = useState(true);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTx, setLoadingTx] = useState(true);

    const [amount, setAmount] = useState<string>("25000");
    const [pendingMethod, setPendingMethod] = useState<"MOBILE_MONEY" | "CARD" | null>(null);
    const [dialog, setDialog] = useState<{
        paymentUrl: string;
        mode: PaymentMode;
        pollUrl: string;
        origin: string | null;
        amount: number;
    } | null>(null);

    const loadWallet = useCallback(async () => {
        setLoadingWallet(true);
        try {
            const res = await fetch("/api/wallet", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message ?? "Impossible de charger le portefeuille");
                return;
            }
            setConfigured(data.configured !== false);
            setBalance(typeof data.balance === "number" ? data.balance : 0);
            setCurrency(data.currency ?? "MGA");
            setWalletStatus(data.status ?? "ACTIVE");
        } catch {
            toast.error("Connexion impossible au service de paiement");
        } finally {
            setLoadingWallet(false);
        }
    }, []);

    const loadTransactions = useCallback(async () => {
        setLoadingTx(true);
        try {
            const res = await fetch("/api/wallet/transactions?limit=15", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setTransactions(Array.isArray(data.data) ? data.data : []);
        } catch {
            // L'historique est secondaire : son échec ne bloque pas la page.
        } finally {
            setLoadingTx(false);
        }
    }, []);

    useEffect(() => {
        if (sessionStatus !== "authenticated") return;
        void loadWallet();
        void loadTransactions();
    }, [sessionStatus, loadWallet, loadTransactions]);

    /**
     * Retour du payeur en navigation classique : Vanilla Pay ajoute
     * `payment_reference` et `payment_status` à l'URL. Ces paramètres viennent du
     * navigateur du payeur et ne font PAS autorité — ils ne servent qu'à savoir
     * quelle recharge interroger auprès du serveur.
     */
    useEffect(() => {
        const reference = searchParams.get("payment_reference");
        if (!reference || sessionStatus !== "authenticated") return;

        let cancelled = false;
        (async () => {
            for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
                try {
                    const res = await fetch(`/api/wallet/topup/${encodeURIComponent(reference)}`, { cache: "no-store" });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.done) {
                            toast.success("Recharge créditée sur votre portefeuille");
                            await loadWallet();
                            await loadTransactions();
                            return;
                        }
                        if (data.terminal) {
                            toast.error("La recharge n'a pas abouti");
                            return;
                        }
                    }
                } catch {
                    // On retente.
                }
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [searchParams, sessionStatus, loadWallet, loadTransactions]);

    const startTopup = async (method: "MOBILE_MONEY" | "CARD") => {
        const value = Number(amount);
        if (!Number.isFinite(value) || value < MIN_TOPUP || value > MAX_TOPUP) {
            toast.error(
                `Montant entre ${MIN_TOPUP.toLocaleString("fr-FR")} Ar et ${MAX_TOPUP.toLocaleString("fr-FR")} Ar`,
            );
            return;
        }

        setPendingMethod(method);
        try {
            const res = await fetch("/api/wallet/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: value, method, returnPath: "/wallet" }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message ?? "Impossible d'ouvrir le paiement");
                return;
            }

            setDialog({
                paymentUrl: data.paymentUrl,
                mode: data.mode ?? "mobile_money",
                pollUrl: data.pollUrl,
                origin: data.paymentOrigin ?? null,
                amount: value,
            });
        } catch {
            toast.error("Connexion impossible au service de paiement");
        } finally {
            setPendingMethod(null);
        }
    };

    if (sessionStatus === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
        );
    }

    if (!session?.user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6">
                <Wallet className="w-10 h-10 text-gray-300" />
                <p className="text-sm font-bold uppercase tracking-widest">Connectez-vous pour accéder à votre portefeuille</p>
                <a
                    href="/auth/login?callbackUrl=/wallet"
                    className="px-8 py-4 bg-[#001F3F] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-colors"
                >
                    Se connecter
                </a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505]">
            <main className="max-w-5xl mx-auto px-6 py-20 space-y-8">
                <div className="bg-white border border-gray-100 p-8 md:p-12">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 bg-[#001F3F] text-white flex items-center justify-center">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold uppercase tracking-tighter">Mon Portefeuille</h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                Wallet MADA.H · Vanilla Pay International
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                void loadWallet();
                                void loadTransactions();
                            }}
                            aria-label="Actualiser"
                            className="p-2 text-gray-300 hover:text-[#001F3F] transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingWallet ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {!configured && (
                        <div className="mb-8 flex items-start gap-3 p-4 border border-amber-200 bg-amber-50 text-amber-800">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <p className="text-xs font-medium">
                                Le module de paiement n&apos;est pas encore configuré sur cette instance
                                (WALLET_API_URL / WALLET_API_KEY).
                            </p>
                        </div>
                    )}

                    {walletStatus === "FROZEN" && (
                        <div className="mb-8 flex items-start gap-3 p-4 border border-red-200 bg-red-50 text-red-700">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <p className="text-xs font-medium">
                                Portefeuille gelé : les paiements au solde sont refusés. Les recharges restent possibles.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Solde */}
                        <div className="bg-[#050505] text-white p-8 flex flex-col justify-between min-h-[16rem]">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    Solde disponible
                                </span>
                                <div className="text-4xl md:text-5xl font-bold mt-3 tracking-tight">
                                    {loadingWallet && balance === null ? (
                                        <Loader2 className="w-7 h-7 animate-spin text-gray-600" />
                                    ) : (
                                        `${(balance ?? 0).toLocaleString("fr-FR")} ${currency}`
                                    )}
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                                Utilisable immédiatement pour acheter une formation, sans code d&apos;accès.
                            </p>
                        </div>

                        {/* Recharge */}
                        <div className="space-y-5">
                            <h2 className="text-xs font-bold uppercase tracking-widest">Recharger</h2>

                            <div className="grid grid-cols-2 gap-3">
                                {PRESET_AMOUNTS.map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => setAmount(String(value))}
                                        className={`py-3 text-xs font-bold border transition-all ${
                                            Number(amount) === value
                                                ? "bg-[#001F3F] text-white border-[#001F3F]"
                                                : "bg-transparent text-gray-500 border-gray-200 hover:border-[#001F3F]"
                                        }`}
                                    >
                                        {value.toLocaleString("fr-FR")} Ar
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <input
                                    type="number"
                                    min={MIN_TOPUP}
                                    max={MAX_TOPUP}
                                    step={1}
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    className="w-full bg-gray-50 border-b-2 border-gray-200 py-4 pl-4 pr-16 font-bold text-lg focus:outline-none focus:border-[#001F3F]"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Ar</span>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => startTopup("MOBILE_MONEY")}
                                    disabled={pendingMethod !== null || !configured}
                                    className="w-full flex items-center gap-3 px-5 py-4 bg-[#001F3F] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-colors disabled:opacity-40"
                                >
                                    {pendingMethod === "MOBILE_MONEY" ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Smartphone className="w-4 h-4" />
                                    )}
                                    Mobile Money
                                    <span className="ml-auto text-[9px] font-medium normal-case tracking-normal opacity-70">
                                        MVola · Orange · Airtel
                                    </span>
                                </button>

                                <button
                                    onClick={() => startTopup("CARD")}
                                    disabled={pendingMethod !== null || !configured}
                                    className="w-full flex items-center gap-3 px-5 py-4 border border-gray-200 text-[#001F3F] text-xs font-bold uppercase tracking-widest hover:border-[#001F3F] transition-colors disabled:opacity-40"
                                >
                                    {pendingMethod === "CARD" ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="w-4 h-4 text-[#2563EB]" />
                                    )}
                                    Carte bancaire
                                    <span className="ml-auto text-[9px] font-medium normal-case tracking-normal text-gray-400">
                                        Visa · Mastercard · PayPal
                                    </span>
                                </button>
                            </div>

                            <p className="flex items-center justify-center gap-2 text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                                <ShieldCheck className="w-3 h-3" /> Encaissement Vanilla Pay International
                            </p>
                        </div>
                    </div>
                </div>

                {/* Historique */}
                <div className="bg-white border border-gray-100 p-8 md:p-12">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-8">
                        Derniers mouvements
                    </h2>

                    {loadingTx ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <p className="py-12 text-center text-xs text-gray-400 font-light">
                            Aucun mouvement pour le moment.
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {transactions.map((tx) => {
                                const credit = tx.direction === "CREDIT";
                                return (
                                    <li key={tx.id} className="py-4 flex items-center gap-4">
                                        <span
                                            className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                                                credit ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                                            }`}
                                        >
                                            {credit ? (
                                                <ArrowDownLeft className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpRight className="w-4 h-4" />
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold uppercase tracking-wide truncate">
                                                {tx.description || TYPE_LABELS[tx.type] || tx.type}
                                            </p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                                                {TYPE_LABELS[tx.type] ?? tx.type} ·{" "}
                                                {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-bold ${credit ? "text-green-600" : "text-[#050505]"}`}>
                                                {credit ? "+" : "−"}
                                                {Number(tx.amount).toLocaleString("fr-FR")} Ar
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                Solde {Number(tx.balanceAfter).toLocaleString("fr-FR")} Ar
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </main>

            {dialog && (
                <PaymentDialog
                    paymentUrl={dialog.paymentUrl}
                    mode={dialog.mode}
                    pollUrl={dialog.pollUrl}
                    expectedOrigin={dialog.origin}
                    title="Recharge du portefeuille"
                    amount={dialog.amount}
                    onSuccess={async () => {
                        setDialog(null);
                        toast.success("Recharge créditée sur votre portefeuille");
                        await loadWallet();
                        await loadTransactions();
                    }}
                    onFailure={() => {
                        setDialog(null);
                        toast.error("La recharge n'a pas abouti");
                    }}
                    onClose={() => {
                        setDialog(null);
                        void loadWallet();
                        void loadTransactions();
                    }}
                />
            )}
        </div>
    );
}

export default function WalletPage() {
    // useSearchParams impose une frontière de Suspense en rendu statique.
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
            }
        >
            <WalletPageContent />
        </Suspense>
    );
}
