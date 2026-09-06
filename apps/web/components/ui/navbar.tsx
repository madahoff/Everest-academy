"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/component/cart-provider";
import { useAuthModal } from "@/component/auth-modal-provider";
import {
    User,
    ShoppingCart,
    Menu,
    X,
    ArrowRight,
    Sparkles,
    LogOut,
} from "lucide-react";

/**
 * Échelle d'empilement du site — à respecter partout ailleurs :
 *
 *   z-40/z-50  barres sticky internes aux pages (filtres, sous-navigations)
 *   z-[90]     cette barre de navigation
 *   z-[95]     le menu plein écran mobile (doit couvrir la barre)
 *   z-[100]    écrans de chargement, toasts, dialogue de paiement
 *   z-[200]    modale d'authentification
 *
 * Le menu mobile est rendu en frère du <nav> et non à l'intérieur : imbriqué,
 * son z-index restait prisonnier du contexte d'empilement créé par la barre
 * (position fixed + z-index + backdrop-blur), ce qui le faisait passer sous
 * les éléments des pages au lieu de les recouvrir.
 */

/**
 * Le rôle est stocké en anglais côté base (enum Prisma) : on ne l'affiche jamais
 * brut dans la barre de navigation, qui est entièrement francophone.
 */
const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Administrateur",
    INSTRUCTOR: "Formateur",
    STUDENT: "Étudiant",
};

export const Navbar = () => {
    const { data: session } = useSession();
    const { cart } = useCart();
    const { openAuth } = useAuthModal();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    const pathname = usePathname();
    const user = session?.user;

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        // Au montage, la page peut déjà être défilée (rechargement, ancre) : sans
        // cet appel la barre garderait sa hauteur haute et masquerait le contenu.
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Le menu couvre tout l'écran : laisser la page défiler derrière lui donne
    // l'impression que deux contenus se superposent au moindre geste.
    useEffect(() => {
        if (!isMenuOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!isMenuOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsMenuOpen(false);
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isMenuOpen]);

    // Retour arrière du navigateur inclus : le menu ne doit jamais survivre à un
    // changement de page.
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    const navigation = [
        { name: "Accueil", href: "/" },
        { name: "Catalogue", href: "/courses" },
        { name: "Masterclass", href: "/masterclass" },
        // { name: "Événements", href: "/events" },
        { name: "Boutique", href: "/shop" },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-[90] transition-all duration-500 border-b ${scrolled ? "bg-white/95 backdrop-blur-md h-20 border-gray-200 shadow-sm" : "bg-white h-24 border-transparent"
                    }`}
            >
                <div className="max-w-[1600px] h-full mx-auto px-6 lg:px-12 flex justify-between items-center">

                    <Link href="/" className="group flex items-center">
                        <Image
                            src="/logo-black.png"
                            alt="Everest Academy"
                            width={160}
                            height={50}
                            className="h-10 sm:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                    </Link>

                    <div className="hidden lg:flex items-center gap-10">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group relative text-[10px] font-bold uppercase tracking-[0.25em] py-2 transition-colors ${isActive(item.href) ? "text-[#001F3F]" : "text-gray-400 hover:text-[#050505]"
                                    }`}
                            >
                                {item.name}
                                <span className={`absolute bottom-0 left-0 h-[2px] bg-[#2563EB] transition-all duration-300 ${isActive(item.href) ? "w-full" : "w-0 group-hover:w-full"
                                    }`}></span>
                            </Link>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 lg:gap-8">

                        {/*
                         * CTA permanent : c'est le chemin le plus court vers l'inscription,
                         * accessible depuis toutes les pages sans avoir à chercher.
                         */}
                        <Link
                            href="/masterclass"
                            className="hidden xl:flex items-center gap-2 bg-[#2563EB] text-white text-[9px] font-bold uppercase tracking-[0.2em] px-5 py-3 border border-[#2563EB] hover:bg-[#001F3F] hover:border-[#001F3F] transition-all"
                        >
                            <Sparkles className="w-3 h-3" />
                            S'inscrire à la prochaine Masterclass
                        </Link>

                        {/* Version courte : sous 1280px, l'intitulé complet casserait la barre. */}
                        <Link
                            href="/masterclass"
                            className="hidden sm:flex xl:hidden items-center gap-2 bg-[#2563EB] text-white text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-3 border border-[#2563EB] hover:bg-[#001F3F] hover:border-[#001F3F] transition-all"
                        >
                            <Sparkles className="w-3 h-3" />
                            Masterclass
                        </Link>

                        <Link href="/cart" className="relative p-2 group" aria-label="Panier">
                            <ShoppingCart className="w-5 h-5 text-[#050505] transition-transform group-hover:-translate-y-1" />
                            {cart.length > 0 && (
                                <span className="absolute top-0 right-0 bg-[#001F3F] text-white text-[7px] font-bold w-4 h-4 flex items-center justify-center rounded-none">
                                    {cart.length}
                                </span>
                            )}
                        </Link>

                        <div className="hidden lg:block h-8 w-[1px] bg-gray-100"></div>

                        {user ? (
                            <div className="hidden lg:flex items-center gap-6">
                                <Link href="/profile" className="flex items-center gap-4 group">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#050505]">{user.name}</p>
                                        <p className="text-[8px] font-bold text-[#2563EB] uppercase tracking-widest">{ROLE_LABELS[user.role] ?? user.role}</p>
                                    </div>
                                    <div className="w-10 h-10 bg-[#F9FAFB] border border-gray-100 flex items-center justify-center group-hover:border-[#001F3F] transition-colors">
                                        <User className="w-4 h-4 text-[#001F3F]" />
                                    </div>
                                </Link>
                                <button
                                    onClick={() => signOut()}
                                    className="text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-red-600 transition-colors"
                                >
                                    Déconnexion
                                </button>
                            </div>
                        ) : (
                            <div className="hidden lg:flex items-center gap-6">
                                <button
                                    onClick={() => openAuth('login')}
                                    className="text-[10px] font-bold uppercase tracking-widest text-[#050505] hover:opacity-70"
                                >
                                    Connexion
                                </button>
                                <button
                                    onClick={() => openAuth('signup')}
                                    className="bg-[#001F3F] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-6 py-3 hover:bg-[#2563EB] transition-all flex items-center gap-3"
                                >
                                    Rejoindre <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <button
                            className="lg:hidden w-10 h-10 flex items-center justify-center border border-gray-100"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                            aria-expanded={isMenuOpen}
                            aria-controls="menu-mobile"
                        >
                            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </nav>

            {/*
             * 100dvh plutôt que inset-0 : sur mobile la barre d'URL fait varier la
             * hauteur du viewport, et le bas du menu finissait sous elle.
             * `invisible` à la fermeture sort le panneau de l'arbre d'accessibilité
             * et garantit qu'aucun de ses enfants ne capte le pointeur.
             */}
            <div
                id="menu-mobile"
                aria-hidden={!isMenuOpen}
                className={`fixed inset-x-0 top-0 h-[100dvh] z-[95] flex flex-col bg-[#050505] transition-opacity duration-300 lg:hidden ${isMenuOpen ? "opacity-100 pointer-events-auto" : "invisible opacity-0 pointer-events-none"
                    }`}
            >
                <div className="flex-none p-6 flex justify-between items-center border-b border-gray-900">
                    <Image src="/logo-white.png" alt="Everest" width={120} height={40} className="h-10 w-auto" />
                    <button onClick={() => setIsMenuOpen(false)} className="text-white p-2" aria-label="Fermer le menu">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                {/*
                 * L'ancien `h-full` se calculait sur toute la hauteur du panneau alors
                 * que l'en-tête en occupait déjà une partie : le contenu débordait par
                 * le haut et venait se superposer au logo. Ici la zone défilante prend
                 * la hauteur restante, et `min-h-full` ne centre les liens que lorsqu'ils
                 * tiennent réellement dans l'écran.
                 */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-8 sm:px-12 py-10">
                    <div className="min-h-full flex flex-col justify-center gap-8">
                        {navigation.map((item, idx) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsMenuOpen(false)}
                                className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter leading-none hover:text-[#2563EB] transition-colors"
                                style={{ transitionDelay: `${idx * 50}ms` }}
                            >
                                {item.name}
                            </Link>
                        ))}

                        <div className="pt-8 mt-2 border-t border-gray-900 flex flex-col gap-6">
                            <Link
                                href="/masterclass"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center justify-center gap-2 bg-[#2563EB] text-white text-[11px] font-bold uppercase tracking-[0.2em] text-center px-6 py-5"
                            >
                                S'inscrire à la prochaine Masterclass <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </Link>

                            {/*
                             * La version bureau (masquée en dessous de `lg`) réservait déjà
                             * connexion/déconnexion au menu horizontal : sous cette largeur,
                             * ni l'une ni l'autre n'étaient jamais accessibles.
                             */}
                            {user ? (
                                <div className="flex flex-col gap-5">
                                    <Link
                                        href="/profile"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-4 group"
                                    >
                                        <div className="w-12 h-12 shrink-0 bg-white/5 border border-gray-800 flex items-center justify-center group-hover:border-[#2563EB] transition-colors">
                                            <User className="w-5 h-5 text-[#2563EB]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest text-white">{user.name}</p>
                                            <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest">{ROLE_LABELS[user.role] ?? user.role}</p>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); signOut(); }}
                                        className="flex items-center justify-center gap-2 border border-gray-800 text-gray-400 text-xs font-bold uppercase tracking-widest px-6 py-4 hover:border-red-500 hover:text-red-500 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" /> Déconnexion
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={() => { setIsMenuOpen(false); openAuth('login'); }}
                                        className="flex items-center justify-center gap-2 border border-gray-700 text-white text-xs font-bold uppercase tracking-widest px-6 py-5 hover:border-white transition-colors"
                                    >
                                        Connexion
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); openAuth('signup'); }}
                                        className="text-[#2563EB] text-lg sm:text-xl font-bold uppercase tracking-widest text-left"
                                    >
                                        Créer un compte →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
