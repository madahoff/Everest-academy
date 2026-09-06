"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

/** Marge de tolérance : sous ce seuil, la page ne « défile » pas vraiment. */
const SCROLLABLE_THRESHOLD = 160;

/** Au-delà, l'utilisateur a compris — l'indicateur n'a plus de raison d'être. */
const HIDE_AFTER = 80;

/**
 * Petite flèche invitant à défiler, montée une seule fois dans le layout et donc
 * présente sur toutes les pages.
 *
 * Elle disparaît dès le premier défilement et ne s'affiche jamais sur une page
 * qui tient déjà dans l'écran : un indicateur qui ment est pire que pas
 * d'indicateur du tout. Le contenu arrivant souvent après le premier rendu
 * (données distantes, images), la hauteur est réobservée et pas seulement lue au
 * montage.
 *
 * z-[85] : sous la barre de navigation (90) et sous le menu mobile (95), qui
 * doivent tous deux la recouvrir.
 */
export const ScrollHint = () => {
    const [canScroll, setCanScroll] = useState(false);
    const [atTop, setAtTop] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        const measure = () => {
            setCanScroll(
                document.documentElement.scrollHeight - window.innerHeight >
                SCROLLABLE_THRESHOLD,
            );
        };
        const handleScroll = () => setAtTop(window.scrollY < HIDE_AFTER);

        measure();
        handleScroll();

        const observer = new ResizeObserver(measure);
        observer.observe(document.body);
        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", measure);

        return () => {
            observer.disconnect();
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", measure);
        };
    }, [pathname]);

    // Presque un écran, pas un écran entier : garder une bande du contenu
    // précédent visible évite la sensation de saut.
    const scrollDown = useCallback(() => {
        window.scrollTo({ top: window.innerHeight * 0.85, behavior: "smooth" });
    }, []);

    const visible = canScroll && atTop;

    return (
        <button
            type="button"
            onClick={scrollDown}
            aria-label="Faire défiler vers le bas"
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[85] flex flex-col items-center gap-1.5 border border-gray-200 bg-white/90 px-4 py-2.5 text-[#001F3F] shadow-lg backdrop-blur-md transition-all duration-500 hover:border-[#2563EB] hover:text-[#2563EB] ${visible ? "opacity-100" : "pointer-events-none invisible translate-y-2 opacity-0"
                }`}
        >
            <span className="text-[8px] font-bold uppercase tracking-[0.25em]">
                Défiler
            </span>
            <ChevronDown className="h-4 w-4 animate-bounce motion-reduce:animate-none" />
        </button>
    );
};
