"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
    ArrowRight,
    CalendarDays,
    Check,
    Clock,
    Loader2,
    Mail,
    MapPin,
    Mic,
    Users,
    AlertTriangle,
} from "lucide-react";
import PaymentMethods from "@/components/payment-methods";
import { useAuthModal } from "@/component/auth-modal-provider";
import { formatSessionDate, monthLabel } from "@/lib/masterclass-month";
import { priceLabel, type MasterclassState } from "@/components/masterclass-spotlight";

const CONFIRMED_STATUSES = ["CONFIRMED", "ATTENDED"];

/**
 * Parcours d'inscription à la prochaine Masterclass.
 *
 * Le règlement est celui du reste du site : `PaymentMethods` appelle
 * `/api/masterclass/register`, qui ouvre une commande ordinaire. Cet écran ne
 * connaît donc ni le solde, ni Vanilla Pay, ni l'octroi de la place — seulement
 * l'issue.
 */
export default function MasterclassRegistration() {
    const { data: session } = useSession();
    const { openAuth } = useAuthModal();

    const [state, setState] = useState<MasterclassState | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkout, setCheckout] = useState(false);
    const [justRegistered, setJustRegistered] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/masterclass", { cache: "no-store" });
            if (!res.ok) throw new Error("unavailable");
            setState((await res.json()) as MasterclassState);
        } catch {
            setState({ masterclass: null, registration: null });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load, session?.user?.id]);

    /** Séance offerte : aucun moyen de paiement à présenter, une seule requête suffit. */
    const claimFreeSeat = async () => {
        setClaiming(true);
        setError(null);
        try {
            const res = await fetch("/api/masterclass/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ returnPath: "/masterclass" }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? "L'inscription n'a pas abouti");
                return;
            }
            toast.success("Inscription confirmée. Un e-mail vous a été envoyé.");
            setJustRegistered(true);
            await load();
        } catch {
            setError("Connexion impossible. Vérifiez votre réseau.");
        } finally {
            setClaiming(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center pt-24">
                <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
            </div>
        );
    }

    const offer = state?.masterclass ?? null;

    // Aucune séance à venir : on le dit franchement plutôt que d'afficher une page vide.
    if (!offer) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] pt-32 pb-24">
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <CalendarDays className="w-12 h-12 mx-auto text-gray-300 mb-6" />
                    <h1 className="text-3xl font-bold tracking-tight mb-4">
                        La prochaine Masterclass n'est pas encore annoncée
                    </h1>
                    <p className="text-gray-500 font-light mb-10">
                        Une nouvelle séance est programmée chaque mois. Revenez d'ici quelques jours, ou parcourez le
                        catalogue en attendant.
                    </p>
                    <Link
                        href="/courses"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-[#001F3F] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-colors"
                    >
                        Voir le catalogue <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        );
    }

    const registration = state?.registration ?? null;
    const registered = registration !== null && CONFIRMED_STATUSES.includes(registration.status);
    const pending = registration?.status === "PENDING" && registration.orderStatus === "PENDING";
    const failed = registration?.status === "PENDING" && registration.orderStatus === "FAILED";
    const unavailable = !offer.free && offer.price === null;

    const facts = [
        { icon: CalendarDays, label: "Date", value: formatSessionDate(offer.scheduledAt) },
        ...(offer.duration ? [{ icon: Clock, label: "Durée", value: offer.duration }] : []),
        { icon: Mic, label: "Formateur", value: offer.instructor },
        ...(offer.location ? [{ icon: MapPin, label: "Lieu", value: offer.location }] : []),
    ];

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] pt-24 pb-24">

            {/* En-tête : la séance */}
            <div className="bg-[#050505] text-white">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <span className="w-2 h-2 bg-[#2563EB]" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#2563EB]">
                            Masterclass · {monthLabel(offer.monthKey)}
                        </span>
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6 max-w-4xl">
                        {offer.title}
                    </h1>
                    <p className="text-gray-400 font-light leading-relaxed max-w-2xl border-l-2 border-[#2563EB] pl-6">
                        {offer.description}
                    </p>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

                    {/* Informations pratiques */}
                    <div className="lg:col-span-7 bg-white border border-gray-200 p-8 lg:p-10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-8">
                            Informations pratiques
                        </p>
                        <dl className="divide-y divide-gray-100">
                            {facts.map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-start gap-4 py-5 first:pt-0">
                                    <Icon className="w-4 h-4 text-[#2563EB] shrink-0 mt-1" />
                                    <div>
                                        <dt className="text-[9px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-1">
                                            {label}
                                        </dt>
                                        <dd className="text-sm font-medium">{value}</dd>
                                    </div>
                                </div>
                            ))}
                            {offer.capacity !== null && (
                                <div className="flex items-start gap-4 py-5">
                                    <Users className="w-4 h-4 text-[#2563EB] shrink-0 mt-1" />
                                    <div>
                                        <dt className="text-[9px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-1">
                                            Places
                                        </dt>
                                        <dd className="text-sm font-medium">
                                            {offer.full
                                                ? "Complet"
                                                : `${offer.seatsLeft} restante${(offer.seatsLeft ?? 0) > 1 ? "s" : ""} sur ${offer.capacity}`}
                                        </dd>
                                    </div>
                                </div>
                            )}
                        </dl>
                    </div>

                    {/* Inscription */}
                    <div className="lg:col-span-5 bg-[#050505] text-white p-8 lg:p-10 border border-gray-800">
                        {registered ? (
                            <>
                                <div className="w-12 h-12 bg-[#2563EB] flex items-center justify-center mb-6">
                                    <Check className="w-5 h-5" />
                                </div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#2563EB] mb-2">
                                    Inscription confirmée
                                </p>
                                <p className="text-2xl font-bold tracking-tight mb-6">Votre place est réservée</p>
                                <p className="flex items-start gap-3 text-sm text-gray-400 font-light">
                                    <Mail className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                                    {justRegistered
                                        ? "Un e-mail de confirmation vient de vous être envoyé, avec la date et les modalités de participation."
                                        : "Un e-mail de confirmation vous a été envoyé, avec la date et les modalités de participation."}
                                </p>
                                <Link
                                    href="/profile"
                                    className="mt-8 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors"
                                >
                                    Voir mon profil <ArrowRight className="w-3 h-3" />
                                </Link>
                            </>
                        ) : offer.full ? (
                            <>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3">
                                    Séance complète
                                </p>
                                <p className="text-2xl font-bold tracking-tight mb-4">Toutes les places sont prises</p>
                                <p className="text-sm text-gray-400 font-light">
                                    Une nouvelle Masterclass est programmée le mois prochain. Écrivez-nous pour être
                                    prévenu de son ouverture.
                                </p>
                            </>
                        ) : unavailable ? (
                            <>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3">
                                    Inscription
                                </p>
                                <p className="text-sm text-gray-400 font-light">
                                    Cette Masterclass n'est pas encore proposée à l'inscription depuis votre pays.
                                    Écrivez-nous pour y participer.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3">
                                    {offer.free ? "Séance offerte" : "Inscription à la séance"}
                                </p>
                                <p className="text-5xl font-bold tracking-tighter mb-8">{priceLabel(offer)}</p>

                                {failed && (
                                    <div className="flex items-start gap-3 p-4 mb-6 border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-200">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        Votre précédent paiement n'a pas abouti. Aucun montant n'a été prélevé — vous
                                        pouvez réessayer ci-dessous.
                                    </div>
                                )}

                                {pending && registration?.paymentUrl && (
                                    <div className="p-4 mb-6 border border-[#2563EB]/40 bg-[#2563EB]/10 text-[11px] text-gray-300">
                                        Un paiement est déjà ouvert pour cette séance.{" "}
                                        <a
                                            href={registration.paymentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-bold text-white underline"
                                        >
                                            Le terminer
                                        </a>
                                        , ou patienter quelques minutes avant de réessayer.
                                    </div>
                                )}

                                {!session ? (
                                    <button
                                        onClick={() => openAuth("login")}
                                        className="w-full flex items-center justify-center gap-2 px-8 py-5 bg-[#2563EB] text-white text-xs font-bold uppercase tracking-widest border border-[#2563EB] hover:bg-white hover:text-[#050505] hover:border-white transition-all"
                                    >
                                        Se connecter pour s'inscrire <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                ) : offer.free ? (
                                    <button
                                        onClick={claimFreeSeat}
                                        disabled={claiming}
                                        className="w-full flex items-center justify-center gap-2 px-8 py-5 bg-[#2563EB] text-white text-xs font-bold uppercase tracking-widest border border-[#2563EB] hover:bg-white hover:text-[#050505] hover:border-white transition-all disabled:opacity-50"
                                    >
                                        {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Réserver ma place
                                    </button>
                                ) : checkout ? (
                                    <PaymentMethods
                                        endpoint="/api/masterclass/register"
                                        amount={offer.price as number}
                                        currency={offer.currency}
                                        label={`Masterclass — ${offer.title}`}
                                        returnPath="/masterclass"
                                        loginCallbackUrl="/masterclass"
                                        dark
                                        onPaid={async () => {
                                            setCheckout(false);
                                            setJustRegistered(true);
                                            await load();
                                        }}
                                    />
                                ) : (
                                    <button
                                        onClick={() => setCheckout(true)}
                                        className="w-full flex items-center justify-center gap-2 px-8 py-5 bg-[#2563EB] text-white text-xs font-bold uppercase tracking-widest border border-[#2563EB] hover:bg-white hover:text-[#050505] hover:border-white transition-all"
                                    >
                                        S'inscrire à la Masterclass <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                {error && (
                                    <p className="mt-4 p-3 border border-red-500/40 bg-red-500/10 text-[11px] text-red-300 text-center">
                                        {error}
                                    </p>
                                )}

                                <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest text-center">
                                    {offer.free
                                        ? "Confirmation immédiate par e-mail"
                                        : "Paiement sécurisé · Confirmation par e-mail"}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
