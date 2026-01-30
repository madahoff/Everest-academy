"use client";

import { useEffect, useState } from "react";
import { Timer, ArrowRight } from "lucide-react";

export function CountdownBanner() {
    const [timeLeft, setTimeLeft] = useState({
        hours: 0,
        minutes: 0,
        seconds: 0
    });
    const [isFinished, setIsFinished] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // CIBLE : 31 Janvier 2026 à 18h00
        const targetDate = new Date("2026-01-31T18:00:00");

        const calculateTimeLeft = () => {
            const now = new Date();
            const difference = targetDate.getTime() - now.getTime();

            if (difference > 0) {
                setTimeLeft({
                    hours: Math.floor((difference / (1000 * 60 * 60))),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
                setIsFinished(false);
            } else {
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
                setIsFinished(true);
            }
        };

        // Calcul immédiat
        calculateTimeLeft();

        // Mise à jour chaque seconde
        const timer = setInterval(() => {
            calculateTimeLeft();
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Éviter le flicker d'hydratation
    if (!isMounted) return null;

    return (
        <section className="relative w-full min-h-[85vh] flex flex-col items-center justify-center overflow-hidden bg-[#050505] text-white border-b border-gray-900 py-20 lg:py-0">

            {/* --- BACKGROUND DESIGN --- */}
            {/* Grille subtile en fond */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>

            {/* Halo lumineux central bleu marine */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#001F3F] opacity-20 blur-[120px] rounded-full pointer-events-none"></div>

            {/* --- CONTENU --- */}
            <div className="relative z-10 container mx-auto px-6 text-center">

                {isFinished ? (
                    // ÉTAT : TERMINÉ (BIENVENU)
                    <div className="animate-in fade-in zoom-in duration-1000 ease-out flex flex-col items-center">
                        <span className="inline-block py-1 px-3 border border-[#2563EB] rounded-full bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
                            L'attente est terminée
                        </span>
                        <h2 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white mb-6 leading-none">
                            BIENVENUE
                        </h2>
                        <p className="text-gray-400 text-sm md:text-lg uppercase tracking-widest font-light max-w-2xl mx-auto">
                            Next Voice commence maintenant
                        </p>
                        {/* <div className="mt-10">
                            <button className="group relative px-8 py-4 bg-white text-[#050505] text-xs font-bold uppercase tracking-widest hover:bg-[#2563EB] hover:text-white transition-all duration-300">
                                Accéder au Programme
                                <ArrowRight className="inline-block w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div> */}
                    </div>
                ) : (
                    // ÉTAT : COMPTE À REBOURS EN COURS
                    <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Label supérieur */}
                        <div className="flex items-center gap-3 mb-10 opacity-80">
                            <div className="p-2 bg-[#2563EB]/20 rounded-full">
                                <Timer className="w-5 h-5 text-[#2563EB] animate-pulse" />
                            </div>
                            <span className="font-bold uppercase tracking-[0.3em] text-xs md:text-sm text-gray-300">
                                Lancement Officiel
                            </span>
                        </div>

                        {/* Chiffres Géants */}
                        <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6 md:gap-12 font-mono text-white max-w-full px-2">

                            {/* HEURES */}
                            <div className="flex flex-col items-center group">
                                <div className="relative bg-[#0a0a0a] border border-gray-800 p-4 sm:p-6 md:p-10 min-w-[70px] sm:min-w-[100px] md:min-w-[180px] flex items-center justify-center shadow-2xl backdrop-blur-sm">
                                    <span className="text-3xl sm:text-5xl md:text-8xl font-bold tracking-tighter tabular-nums group-hover:text-[#2563EB] transition-colors duration-500">
                                        {String(timeLeft.hours).padStart(2, '0')}
                                    </span>
                                    {/* Petit accent décoratif */}
                                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <span className="mt-4 text-[8px] sm:text-[10px] md:text-xs uppercase font-sans font-bold text-gray-500 tracking-[0.2em]">Heures</span>
                            </div>

                            <span className="hidden sm:block text-2xl sm:text-4xl md:text-7xl text-gray-700 font-light mt-4 md:mt-8 animate-pulse">:</span>

                            {/* MINUTES */}
                            <div className="flex flex-col items-center group">
                                <div className="relative bg-[#0a0a0a] border border-gray-800 p-4 sm:p-6 md:p-10 min-w-[70px] sm:min-w-[100px] md:min-w-[180px] flex items-center justify-center shadow-2xl backdrop-blur-sm">
                                    <span className="text-3xl sm:text-5xl md:text-8xl font-bold tracking-tighter tabular-nums group-hover:text-[#2563EB] transition-colors duration-500">
                                        {String(timeLeft.minutes).padStart(2, '0')}
                                    </span>
                                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <span className="mt-4 text-[8px] sm:text-[10px] md:text-xs uppercase font-sans font-bold text-gray-500 tracking-[0.2em]">Minutes</span>
                            </div>

                            <span className="hidden sm:block text-2xl sm:text-4xl md:text-7xl text-gray-700 font-light mt-4 md:mt-8 animate-pulse">:</span>

                            {/* SECONDES */}
                            <div className="flex flex-col items-center group">
                                <div className="relative bg-[#0a0a0a] border border-gray-800 p-4 sm:p-6 md:p-10 min-w-[70px] sm:min-w-[100px] md:min-w-[180px] flex items-center justify-center shadow-2xl backdrop-blur-sm">
                                    <span className="text-3xl sm:text-5xl md:text-8xl font-bold tracking-tighter tabular-nums text-[#2563EB]">
                                        {String(timeLeft.seconds).padStart(2, '0')}
                                    </span>
                                    {/* Bordure active permanente pour les secondes */}
                                    <div className="absolute inset-0 border border-[#2563EB]/30"></div>
                                </div>
                                <span className="mt-4 text-[8px] sm:text-[10px] md:text-xs uppercase font-sans font-bold text-gray-500 tracking-[0.2em]">Secondes</span>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}