"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Mic, Check, Loader2 } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { formatSessionDate, monthLabel } from "@/lib/masterclass-month";
import { formatAmount, type Currency } from "@/lib/pricing";

export interface MasterclassOfferView {
    id: string;
    monthKey: string;
    title: string;
    description: string;
    instructor: string;
    scheduledAt: string;
    duration: string | null;
    location: string | null;
    coverImage: string | null;
    presentationVideo: string | null;
    currency: Currency;
    price: number | null;
    free: boolean;
    capacity: number | null;
    seatsLeft: number | null;
    confirmedCount: number;
    full: boolean;
}

export interface MasterclassRegistrationView {
    id: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";
    amount: number;
    currency: string;
    registeredAt: string;
    orderId: string | null;
    orderStatus: string | null;
    pollUrl: string | null;
    paymentUrl: string | null;
}

export interface MasterclassState {
    masterclass: MasterclassOfferView | null;
    registration: MasterclassRegistrationView | null;
    /** Le visiteur détient le Pack Premium : sa place est comprise dans son pack. */
    isPremium: boolean;
}

/**
 * Charge la prochaine Masterclass. Un seul point d'entrée pour les trois écrans qui
 * l'affichent — ils annoncent forcément la même séance.
 */
export function useNextMasterclass() {
    const [state, setState] = useState<MasterclassState | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/masterclass", { cache: "no-store" });
                if (!res.ok) throw new Error("unavailable");
                const data = (await res.json()) as MasterclassState;
                if (!cancelled) setState(data);
            } catch {
                // Section purement promotionnelle : en cas d'échec elle disparaît,
                // elle ne montre jamais une erreur au milieu de la page d'accueil.
                if (!cancelled) setState({ masterclass: null, registration: null, isPremium: false });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return { state, loading };
}

/** Tarif affiché : gratuité, montant, ou absence de tarif dans la devise du visiteur. */
export function priceLabel(offer: MasterclassOfferView): string {
    if (offer.free) return "Offerte";
    if (offer.price === null) return "Sur demande";
    return formatAmount(offer.price, offer.currency);
}

const CONFIRMED_STATUSES = ["CONFIRMED", "ATTENDED"];

/**
 * Bloc « prochaine Masterclass », posé sur l'accueil et en tête du catalogue.
 *
 * Il ne règle rien lui-même : il annonce, et envoie vers `/masterclass` où se trouve
 * le parcours d'inscription. Deux écrans qui encaisseraient chacun de leur côté
 * seraient deux occasions de diverger.
 */
export default function MasterclassSpotlight({ variant = "light" }: { variant?: "light" | "dark" }) {
    const { state, loading } = useNextMasterclass();

    if (loading) {
        return (
            <section className={variant === "dark" ? "bg-[#050505] py-16" : "bg-white py-16"}>
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
                        Prochaine Masterclass…
                    </span>
                </div>
            </section>
        );
    }

    const offer = state?.masterclass;
    if (!offer) return null;

    const registration = state?.registration ?? null;
    const registered = registration !== null && CONFIRMED_STATUSES.includes(registration.status);
    const pending = registration?.status === "PENDING" && registration.orderStatus === "PENDING";

    const dark = variant === "dark";
    const shell = dark ? "bg-[#050505] text-white" : "bg-white text-[#050505] border-y border-gray-200";
    const muted = dark ? "text-gray-400" : "text-gray-500";

    // Le lieu n'est pas annoncé sur la vitrine : il est communiqué à l'inscrit, dans
    // l'e-mail de confirmation.
    const facts = [
        { icon: CalendarDays, label: formatSessionDate(offer.scheduledAt) },
        ...(offer.duration ? [{ icon: Clock, label: offer.duration }] : []),
        { icon: Mic, label: offer.instructor },
    ];

    return (
        <section className={`relative overflow-hidden ${shell}`}>
            {/* Trame géométrique, écho du hero et du bandeau Premium */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden>
                <div className="absolute -top-32 -right-16 w-[480px] h-[480px] border border-current rounded-full" />
                <div className="absolute -top-16 right-8 w-[320px] h-[320px] border border-[#2563EB] rounded-full" />
            </div>

            <div className="relative max-w-[1600px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    <div className="lg:col-span-7">
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <span className="w-2 h-2 bg-[#2563EB]" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#2563EB]">
                                Prochaine Masterclass
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${muted}`}>
                                {monthLabel(offer.monthKey)}
                            </span>
                        </div>

                        <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] mb-5">
                            {offer.title}
                        </h2>

                        <p className={`font-light leading-relaxed max-w-2xl border-l-2 border-[#2563EB] pl-6 mb-8 ${muted}`}>
                            {offer.description}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                            {facts.map(({ icon: Icon, label }) => (
                                <div key={label} className="flex items-start gap-3">
                                    <Icon className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                                    <span className="text-sm font-medium leading-snug">{label}</span>
                                </div>
                            ))}
                        </div>

                        {/*
                         * Vidéo de présentation, quand elle existe. Elle prend place dans la
                         * colonne éditoriale et non à côté du bouton : elle explique la séance,
                         * elle ne dispute pas sa place à l'inscription.
                         *
                         * `aspect-video` + lecteur en absolu : sans cela, une vidéo verticale
                         * imposerait sa hauteur naturelle et disloquerait la section.
                         */}
                        {offer.presentationVideo && (
                            <div className="mt-10 relative aspect-video w-full max-w-2xl overflow-hidden border border-gray-800/20 bg-black">
                                <div className="absolute inset-0">
                                    <VideoPlayer src={offer.presentationVideo} title={offer.title} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bloc tarif / inscription */}
                    <div
                        className={`lg:col-span-5 p-8 lg:p-10 border ${dark ? "bg-[#0B0B0B] border-gray-800" : "bg-[#F9FAFB] border-gray-200"
                            }`}
                    >
                        <p className={`text-[10px] font-bold uppercase tracking-[0.3em] mb-3 ${muted}`}>
                            {state?.isPremium
                                ? "Comprise dans votre Pack Premium"
                                : offer.free
                                    ? "Séance offerte"
                                    : "Inscription à la séance"}
                        </p>

                        <div className="flex items-end gap-3 mb-6">
                            <span className="text-5xl font-bold tracking-tighter">
                                {state?.isPremium ? "Incluse" : priceLabel(offer)}
                            </span>
                        </div>

                        {offer.full && (
                            <p className={`text-xs mb-6 font-bold uppercase tracking-widest ${muted}`}>Complet</p>
                        )}

                        {registered ? (
                            <div className="flex items-center gap-3 px-5 py-4 border border-[#2563EB] bg-[#2563EB]/10">
                                <Check className="w-4 h-4 text-[#2563EB] shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-widest">
                                    {state?.isPremium
                                        ? "Inscrit via votre Pack Premium"
                                        : "Vous êtes inscrit à cette séance"}
                                </span>
                            </div>
                        ) : (
                            <Link
                                href="/masterclass"
                                className="w-full flex items-center justify-center gap-2 px-8 py-5 bg-[#2563EB] text-white text-xs font-bold uppercase tracking-widest border border-[#2563EB] hover:bg-white hover:text-[#050505] hover:border-white transition-all duration-300"
                            >
                                {pending ? "Terminer mon inscription" : "S'inscrire à la Masterclass"}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        )}

                        <p className={`mt-4 text-[10px] uppercase tracking-widest text-center ${muted}`}>
                            {offer.free ? "Confirmation par e-mail" : "Solde · Mobile Money · Carte bancaire"}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
