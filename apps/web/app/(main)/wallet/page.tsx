"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Wallet, CreditCard, ArrowRight, History, Plus, TrendingUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function WalletPage() {
    const { data: session, update } = useSession(); // update needed to refresh session data if balance is there
    const router = useRouter();
    const [amount, setAmount] = useState("100");
    const [loading, setLoading] = useState(false);

    const handleTopUp = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            if (res.ok) {
                // Refresh page/session
                await update();
                router.refresh();
                toast.success("Portefeuille rechargé avec succès !");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505]">
            <main className="max-w-4xl mx-auto px-6 py-20">
                <div className="bg-white border border-gray-100 p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#001F3F]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-[#001F3F] text-white flex items-center justify-center">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold uppercase tracking-tighter">Mon Portefeuille</h1>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Everest Secure Vault</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* Balance Card */}
                            <div className="bg-[#050505] text-white p-8 flex flex-col justify-between h-64">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Solde Actuel</span>
                                    <div className="text-5xl font-bold mt-2 tracking-tight">
                                        0.00 Ar
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                                    <TrendingUp className="w-4 h-4" /> +100% prêt à investir
                                </div>
                            </div>

                            {/* Topup Form */}
                            <div className="space-y-6">
                                <h2 className="text-sm font-bold uppercase tracking-widest">Recharger le compte</h2>

                                <div className="grid grid-cols-3 gap-4">
                                    {["50", "100", "500"].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setAmount(val)}
                                            className={`py-3 text-sm font-bold border transition-all ${amount === val ? "bg-[#001F3F] text-white border-[#001F3F]" : "bg-transparent text-gray-500 border-gray-200 hover:border-[#001F3F]"}`}
                                        >
                                            {val} Ar
                                        </button>
                                    ))}
                                </div>

                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-gray-50 border-b-2 border-gray-200 py-4 px-4 font-bold text-lg focus:outline-none focus:border-[#001F3F]"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">EUR</span>
                                </div>

                                <button
                                    onClick={handleTopUp}
                                    disabled={loading}
                                    className="w-full bg-[#2563EB] text-white py-4 font-bold uppercase tracking-widest hover:bg-[#001F3F] transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? "Traitement..." : <>Confirmer le Dépôt <ArrowRight className="w-4 h-4" /></>}
                                </button>

                                <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 uppercase font-bold">
                                    <ShieldCheck className="w-3 h-3" /> Transaction simulée (Dev Mode)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
