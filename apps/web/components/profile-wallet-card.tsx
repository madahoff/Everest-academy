"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    Loader2,
    RefreshCw,
    AlertTriangle,
    Plus,
} from "lucide-react";
import { TRANSACTION_TYPE_LABELS } from "@/lib/wallet-labels";

interface Transaction {
    id: string;
    direction: "CREDIT" | "DEBIT";
    type: string;
    amount: string;
    balanceAfter: string;
    description: string | null;
    createdAt: string;
}

/**
 * Portefeuille de l'utilisateur, affiché dans son profil.
 *
 * `initialBalance` vient du miroir `users.walletBalance` rendu côté serveur : il
 * évite une carte vide au premier paint, mais n'a aucune autorité — dès que
 * `/api/wallet` répond, c'est le solde du Wallet API qui s'affiche.
 */
export default function ProfileWalletCard({
    initialBalance,
    initialCurrency = "MGA",
}: {
    initialBalance: number;
    initialCurrency?: string;
}) {
    const [balance, setBalance] = useState<number>(initialBalance);
    const [currency, setCurrency] = useState(initialCurrency);
    const [configured, setConfigured] = useState(true);
    const [walletStatus, setWalletStatus] = useState<"ACTIVE" | "FROZEN">("ACTIVE");
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [walletRes, txRes] = await Promise.all([
                fetch("/api/wallet", { cache: "no-store" }),
                fetch("/api/wallet/transactions?limit=4", { cache: "no-store" }),
            ]);

            if (walletRes.ok) {
                const data = await walletRes.json();
                setConfigured(data.configured !== false);
                if (typeof data.balance === "number") setBalance(data.balance);
                setCurrency(data.currency ?? "MGA");
                setWalletStatus(data.status ?? "ACTIVE");
            }

            if (txRes.ok) {
                const data = await txRes.json();
                setTransactions(Array.isArray(data.data) ? data.data : []);
            }
        } catch {
            // Le solde miroir reste affiché : le profil ne doit pas casser si le
            // service de paiement est momentanément injoignable.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <div className="bg-white border border-gray-100">
            <div className="flex items-center gap-3 p-6 border-b border-gray-100">
                <div className="w-9 h-9 bg-[#001F3F] text-white flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold uppercase tracking-widest">Mon Portefeuille</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] mt-1">wallet.h</p>
                </div>
                <button
                    onClick={() => void refresh()}
                    aria-label="Actualiser le portefeuille"
                    className="p-2 text-gray-300 hover:text-[#001F3F] transition-colors"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Solde */}
            <div className="bg-[#050505] text-white p-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Solde disponible
                </span>
                <div className="text-3xl font-bold mt-2 tracking-tight">
                    {balance.toLocaleString("fr-FR")} {currency}
                </div>
                <p className="text-[10px] text-gray-500 font-medium mt-3 leading-relaxed">
                    Votre portefeuille wallet.h, utilisable immédiatement pour acheter une formation.
                </p>
            </div>

            {!configured && (
                <div className="flex items-start gap-3 p-4 m-6 mb-0 border border-amber-200 bg-amber-50 text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-medium">
                        Le portefeuille wallet.h n&apos;est pas encore configuré sur cette instance.
                    </p>
                </div>
            )}

            {walletStatus === "FROZEN" && (
                <div className="flex items-start gap-3 p-4 m-6 mb-0 border border-red-200 bg-red-50 text-red-700">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-medium">
                        Portefeuille gelé : les paiements au solde sont refusés. Les recharges restent possibles.
                    </p>
                </div>
            )}

            {/* Derniers mouvements */}
            <div className="p-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                    Derniers mouvements
                </h4>

                {loading && transactions.length === 0 ? (
                    <div className="py-6 flex justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                    </div>
                ) : transactions.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-gray-400 font-light">
                        Aucun mouvement pour le moment.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {transactions.map((tx) => {
                            const credit = tx.direction === "CREDIT";
                            return (
                                <li key={tx.id} className="py-3 flex items-center gap-3">
                                    <span
                                        className={`w-7 h-7 flex items-center justify-center shrink-0 ${
                                            credit ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                                        }`}
                                    >
                                        {credit ? (
                                            <ArrowDownLeft className="w-3.5 h-3.5" />
                                        ) : (
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        )}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-wide truncate">
                                            {tx.description || TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                                            {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                                                day: "2-digit",
                                                month: "short",
                                            })}
                                        </p>
                                    </div>
                                    <p
                                        className={`text-xs font-bold shrink-0 ${
                                            credit ? "text-green-600" : "text-[#050505]"
                                        }`}
                                    >
                                        {credit ? "+" : "−"}
                                        {Number(tx.amount).toLocaleString("fr-FR")} Ar
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <a href="/wallet" className="block mt-6">
                    <button className="w-full font-bold uppercase tracking-widest transition-all duration-300 rounded-none border flex items-center justify-center gap-2 px-6 py-3 text-xs bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#001F3F] hover:border-[#001F3F]">
                        <Plus className="w-4 h-4" /> Recharger mon wallet.h
                    </button>
                </a>
            </div>
        </div>
    );
}
