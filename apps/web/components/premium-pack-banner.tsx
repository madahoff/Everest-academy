"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Crown, Infinity as InfinityIcon, Lock, ShieldCheck, Sparkles, X, ArrowRight } from "lucide-react";
import PaymentMethods from "@/components/payment-methods";
import { useAuthModal } from "@/component/auth-modal-provider";
import { formatAmount, type Currency } from "@/lib/pricing";

export interface PremiumOffer {
    /** Devise de tous les montants de cette offre, résolue côté serveur. */
    currency: Currency;
    /** Tarif du pack. `null` : pas de tarif dans cette devise — rien à proposer. */
    price: number | null;
    /** Offre proposée à la vente : réglée depuis la console d'administration. */
    active: boolean;
    catalogueValue: number;
    savings: number;
    /** Modules déjà publiés, ouverts dès l'achat. */
    courseCount: number;
    /** Modules annoncés sur l'année — le programme vendu, parutions à venir comprises. */
    announcedCourseCount: number;
    premiumCourseCount: number;
}

const ARGUMENTS = [
    { icon: Lock, label: "Tout le catalogue débloqué", detail: "Chaque module premium, immédiatement" },
    { icon: InfinityIcon, label: "Accès à vie", detail: "Aucun abonnement, aucun renouvellement" },
    { icon: Sparkles, label: "Modules à venir inclus", detail: "Les prochaines MasterClass s'ajoutent seules" },
];

/**
 * Tête du catalogue : l'offre qui ouvre tous les cours d'un coup.
 *
 * Deux états, jamais les deux à la fois — la proposition d'achat pour un visiteur,
 * et l'accusé d'accès pour un membre, qui doit lire « c'est déjà à vous » en un coup d'œil.
 */
export default function PremiumPackBanner({
    offer,
    isPremium,
    unlockedCount,
}: {
    offer: PremiumOffer;
    isPremium: boolean;
    unlockedCount: number;
}) {
    const router = useRouter();
    const { data: session } = useSession();
    const { openAuth } = useAuthModal();
    const [checkout, setCheckout] = useState(false);

    /** Montant dans la devise du visiteur. */
    const money = (value: number) => formatAmount(value, offer.currency);

    // Offre retirée de la vente, ou sans tarif dans la devise du visiteur : rien à
    // proposer — mais un membre garde son bandeau.
    if (!isPremium && (!offer.active || offer.price === null)) return null;

    if (isPremium) {
        return (
            <section className="bg-[#050505] text-white border border-[#2563EB]/40">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-8 flex flex-col md:flex-row md:items-center gap-6 justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-[#2563EB] flex items-center justify-center shrink-0">
                            <Crown className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#2563EB] mb-1">
                                Pack Premium actif
                            </p>
                            <p className="text-lg font-bold">
                                {unlockedCount} module{unlockedCount > 1 ? "s" : ""} débloqué{unlockedCount > 1 ? "s" : ""} — accès à vie
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/profile"
                        className="text-[10px] font-bold uppercase tracking-widest text-white/70 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        Voir mes formations <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </section>
        );
    }

    // Passé les deux retours ci-dessus, le tarif est nécessairement présent.
    const price = offer.price as number;

    // Le programme annoncé dépasse-t-il ce qui est déjà paru ? Si oui, on vend
    // l'année entière en disant combien de modules sont ouverts aujourd'hui : gonfler
    // le chiffre sans le préciser ferait passer une promesse pour un inventaire.
    const announced = offer.announcedCourseCount;
    const upcoming = announced - offer.courseCount;

    const openCheckout = () => {
        if (!session) {
            openAuth("login");
            return;
        }
        setCheckout(true);
    };

    return (
        <section className="relative bg-[#050505] text-white overflow-hidden">
            {/* Trame géométrique, écho du hero de la page d'accueil */}
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none" aria-hidden>
                <div className="absolute -top-40 -right-20 w-[520px] h-[520px] border border-white rounded-full" />
                <div className="absolute -top-24 -right-4 w-[360px] h-[360px] border border-[#2563EB] rounded-full" />
            </div>
            <div className="absolute top-0 right-0 h-full w-1/3 bg-[#2563EB] opacity-10 skew-x-12 translate-x-24 pointer-events-none" aria-hidden />

            <div className="relative max-w-[1600px] mx-auto px-6 lg:px-12 py-14">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* Argumentaire */}
                    <div className="lg:col-span-7">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="w-2 h-2 bg-[#2563EB]" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#2563EB]">
                                Offre intégrale
                            </span>
                        </div>

                        <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] mb-5">
                            Le Pack Premium.<br />
                            <span className="text-gray-500">Tout le catalogue, une seule fois.</span>
                        </h2>

                        <p className="text-gray-400 font-light leading-relaxed max-w-xl border-l-2 border-[#2563EB] pl-6 mb-10">
                            {upcoming > 0 ? (
                                <>
                                    Un paiement unique couvre les {announced} MasterClass de l'année :
                                    les {offer.courseCount} déjà publiées s'ouvrent immédiatement, et chacune des{" "}
                                    {upcoming} suivantes dès sa parution. Plus de choix à faire cours par cours.
                                </>
                            ) : (
                                <>
                                    Un paiement unique débloque les {announced} MasterClass publiées — et toutes celles
                                    qui viendront s'y ajouter. Plus de choix à faire cours par cours.
                                </>
                            )}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                            {ARGUMENTS.map(({ icon: Icon, label, detail }) => (
                                <div key={label} className="flex gap-4">
                                    <Icon className="w-4 h-4 text-[#2563EB] shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-bold leading-tight">{label}</p>
                                        <p className="text-xs text-gray-500 font-light mt-0.5">{detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bloc prix / règlement */}
                    <div className="lg:col-span-5 bg-[#0B0B0B] border border-gray-800 p-8 lg:p-10">
                        {checkout ? (
                            <>
                                <div className="flex items-start justify-between mb-8">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-2">
                                            Régler le Pack Premium
                                        </p>
                                        <p className="text-3xl font-bold tracking-tight">{money(price)}</p>
                                    </div>
                                    <button
                                        onClick={() => setCheckout(false)}
                                        aria-label="Fermer le paiement"
                                        className="text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <PaymentMethods
                                    endpoint="/api/premium"
                                    amount={price}
                                    currency={offer.currency}
                                    label="Pack Premium"
                                    returnPath="/courses"
                                    loginCallbackUrl="/courses"
                                    dark
                                    onPaid={() => {
                                        // Le catalogue est rendu côté serveur : un refresh suffit à
                                        // rouvrir chaque carte avec son nouvel état d'accès.
                                        setCheckout(false);
                                        router.refresh();
                                    }}
                                />

                                <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest text-center">
                                    Paiement sécurisé · Accès immédiat
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3">
                                    Paiement unique
                                </p>

                                <div className="flex items-end gap-4 mb-2">
                                    <span className="text-5xl font-bold tracking-tighter">{money(price)}</span>
                                    {offer.savings > 0 && (
                                        <span className="text-sm text-gray-600 line-through mb-2">
                                            {money(offer.catalogueValue)}
                                        </span>
                                    )}
                                </div>

                                {offer.savings > 0 && (
                                    <p className="inline-block bg-[#2563EB] px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-8">
                                        Économisez {money(offer.savings)}
                                    </p>
                                )}

                                <ul className="space-y-3 mb-8 border-t border-gray-800 pt-8">
                                    {[
                                        upcoming > 0
                                            ? `${announced} MasterClass sur l'année`
                                            : `${announced} MasterClass débloquées`,
                                        upcoming > 0
                                            ? `${offer.courseCount} déjà ouvertes, ${upcoming} à venir`
                                            : "Mises à jour et nouveaux modules inclus",
                                        "Accès à vie, sans abonnement",
                                    ].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-xs text-gray-300">
                                            <Check className="w-4 h-4 text-[#2563EB] shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={openCheckout}
                                    className="w-full flex items-center justify-center gap-2 px-8 py-5 bg-[#2563EB] text-white text-xs font-bold uppercase tracking-widest border border-[#2563EB] hover:bg-white hover:text-[#050505] hover:border-white transition-all duration-300"
                                >
                                    <Crown className="w-4 h-4" />
                                    Débloquer tout le catalogue
                                </button>

                                <p className="mt-4 text-[10px] text-gray-600 uppercase tracking-widest text-center">
                                    Solde · Mobile Money · Carte bancaire
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
