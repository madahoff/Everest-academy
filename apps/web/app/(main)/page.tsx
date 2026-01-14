"use client";

import Link from "next/link";
import { useState } from "react";
import {
    Mic,
    Feather,
    Volume2,
    Users,
    ArrowRight,
    Hourglass,
    Quote,
    AlignLeft,
    BrainCircuit,
    Check,
    Loader2
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAuthModal } from "@/component/auth-modal-provider";

// --- UI COMPONENTS (Style conservé) ---

const Button = ({ children, variant = "primary", size = "md", className = "", disabled, ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 ease-out flex items-center justify-center gap-2 rounded-none border disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        accent: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-white hover:text-[#2563EB]",
        outline: "bg-transparent border-gray-300 text-[#050505] hover:bg-[#050505] hover:text-white hover:border-[#050505]",
        outlineDark: "bg-transparent border-gray-700 text-white hover:bg-white hover:text-[#050505]",
        ghost: "bg-transparent border-transparent text-gray-500 hover:text-[#001F3F]"
    };
    const sizes = { sm: "px-4 py-2 text-[10px]", md: "px-6 py-3 text-xs", lg: "px-8 py-4 text-sm" };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

const Separator = () => (
    <div className="flex items-center gap-4 my-8 opacity-50">
        <div className="h-[1px] w-12 bg-[#2563EB]"></div>
        <div className="h-[1px] flex-1 bg-gray-200"></div>
    </div>
);

// --- SECTIONS ---

export default function OratoryComingSoon() {
    // --- AUTH LOGIC ---
    const { data: session } = useSession();
    const { openAuth } = useAuthModal();

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        // Open Auth Dialog on Signup tab
        openAuth('signup');
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F] selection:text-white overflow-x-hidden">

            {/* --- SECTION 1: HERO IMMERSIF --- */}
            <section className="relative min-h-screen flex flex-col justify-center bg-[#050505] text-white border-b border-gray-800">
                {/* Background abstrait "Onde sonore" */}
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-gray-700 rounded-full animate-[spin_60s_linear_infinite]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-gray-800 rounded-full animate-[spin_40s_linear_infinite_reverse]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-[#2563EB]/30 rounded-full"></div>
                </div>

                <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-12 w-full pt-20">
                    <div className="flex flex-col md:flex-row gap-12 items-end justify-between">
                        <div className="max-w-4xl">
                            <div className="flex items-center gap-3 mb-8 animate-in fade-in slide-in-from-left-5 duration-700">
                                <span className="w-2 h-2 bg-[#2563EB]"></span>
                                <span className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">
                                    Académie de Rhétorique
                                </span>
                            </div>

                            <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-[0.85] mb-8">
                                LE POUVOIR <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-400 to-gray-800">
                                    DU SILENCE.
                                </span>
                            </h1>

                            <p className="text-lg text-gray-400 max-w-2xl font-light leading-relaxed border-l-2 border-[#2563EB] pl-6 mb-12">
                                La parole est une architecture. Nous vous apprenons à la bâtir.
                                Une formation d'élite pour ceux qui doivent convaincre, diriger et inspirer.
                                <br /><br />
                               
                            </p>

                            {/* Formulaire Hero */}
                            {/* <div className="max-w-md">
                                {status === "success" ? (
                                    <div className="p-4 border border-[#2563EB] bg-[#2563EB]/10 flex items-center gap-3">
                                        <Check className="w-5 h-5 text-[#2563EB]" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-white">Vous êtes sur la liste</span>
                                    </div>
                                ) : (
                                    <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-0 w-full">
                                        <input
                                            type="email"
                                            required
                                            placeholder="VOTRE ADRESSE EMAIL"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="flex-grow bg-white/5 border border-gray-700 border-r-0 text-white px-6 py-4 text-sm focus:outline-none focus:border-[#2563EB] transition-colors placeholder:text-gray-600 placeholder:tracking-widest"
                                        />
                                        <Button variant="accent" size="lg" className="sm:w-auto w-full" disabled={status === "loading"}>
                                            {status === "loading" ? <Loader2 className="animate-spin" /> : "REJOINDRE LA LISTE"}
                                        </Button>
                                    </form>
                                )}
                                <p className="text-[10px] text-gray-600 mt-4 uppercase tracking-wider">
                                    * Places limitées pour la première cohorte.
                                </p>
                            </div> */}
                        </div>

                        {/* Compteur Abstrait */}
                        <div className="hidden lg:block mb-4">
                            <div className="text-right">
                                <div className="text-6xl font-bold text-[#2563EB]">03</div>
                                <div className="text-xs uppercase tracking-[0.4em] text-gray-500 mt-2">Modules Fondateurs</div>
                            </div>
                            <div className="h-32 w-[1px] bg-gray-800 ml-auto mt-8 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-[#2563EB] animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- SECTION 2: LE MANIFESTE (Philosophie) --- */}
            <section className="py-24 lg:py-32 bg-white relative">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <span className="text-[#001F3F] text-xs font-bold uppercase tracking-[0.3em] mb-4 block">Notre Philosophie</span>
                            <h2 className="text-4xl lg:text-6xl font-bold text-[#050505] mb-8 leading-tight tracking-tight">
                                CE N'EST PAS <br />
                                DU THÉÂTRE. <br />
                                C'EST DE LA <br />
                                <span className="text-[#2563EB]">STRATÉGIE.</span>
                            </h2>
                            <div className="space-y-6 text-gray-600 font-light leading-relaxed text-lg">
                                <p>
                                    L'éloquence moderne ne se joue pas sur les trémolos de la voix, mais sur la structure de la pensée.
                                    Dans un monde saturé de bruit, celui qui maîtrise le silence et la précision du verbe détient le pouvoir.
                                </p>
                                <p>
                                    Everest déconstruit la rhétorique classique pour l'adapter aux enjeux contemporains :
                                    négociation, leadership, gestion de crise et présence médiatique.
                                </p>
                            </div>
                            <div className="mt-12">
                                <Button variant="outline" size="lg">
                                    Découvrir le Syllabus
                                </Button>
                            </div>
                        </div>

                        {/* Grille visuelle conceptuelle */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#F3F4F6] p-8 aspect-square flex flex-col justify-between group hover:bg-[#001F3F] transition-colors duration-500">
                                <BrainCircuit className="w-8 h-8 text-[#001F3F] group-hover:text-white" />
                                <span className="text-xs font-bold uppercase tracking-widest text-[#050505] group-hover:text-white">Logos / Logique</span>
                            </div>
                            <div className="bg-[#050505] p-8 aspect-square flex flex-col justify-between group">
                                <div className="text-white text-4xl font-serif italic">"</div>
                                <span className="text-xs font-bold uppercase tracking-widest text-white">Pathos / Émotion</span>
                            </div>
                            <div className="bg-white border border-gray-200 p-8 aspect-square flex flex-col justify-between group hover:border-[#001F3F] transition-colors">
                                <AlignLeft className="w-8 h-8 text-gray-400 group-hover:text-[#001F3F]" />
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-[#001F3F]">Taxis / Structure</span>
                            </div>
                            <div className="bg-[#2563EB] p-8 aspect-square flex flex-col justify-between">
                                <Mic className="w-8 h-8 text-white" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white">Actio / Performance</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- SECTION 3: CURSUS PREVIEW (Teaser) --- */}
            <section className="py-24 bg-[#050505] text-white border-t border-gray-900">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
                    <div className="flex justify-between items-end mb-16 border-b border-gray-800 pb-8">
                        <div>
                            <h3 className="text-3xl font-bold mb-2">Programme de Formation</h3>
                            <p className="text-gray-500 text-sm uppercase tracking-widest">Aperçu des modules en production</p>
                        </div>
                        <Hourglass className="w-6 h-6 text-[#2563EB] animate-pulse" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-gray-800">
                        {[
                            { title: "Architecture du Discours", desc: "Construire un argumentaire infaillible.", icon: AlignLeft, time: "4 Semaines" },
                            { title: "Gestion du Stress & Voix", desc: "Transformer l'adrénaline en charisme.", icon: Volume2, time: "3 Semaines" },
                            { title: "Rhétorique de Crise", desc: "Répondre quand tout s'effondre.", icon: Mic, time: "Masterclass" }
                        ].map((item, idx) => (
                            <div key={idx} className="group relative p-10 border-r border-b border-gray-800 hover:bg-[#0a0a0a] transition-colors">
                                <Link href="/courses" className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight className="w-5 h-5 text-[#2563EB]" />
                                </Link>
                                <div className="mb-8 p-3 bg-white/5 w-fit rounded-none">
                                    <item.icon className="w-6 h-6 text-gray-300" />
                                </div>
                                <h4 className="text-xl font-bold mb-3 group-hover:text-[#2563EB] transition-colors">{item.title}</h4>
                                <p className="text-gray-500 text-sm leading-relaxed mb-6">{item.desc}</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-[2px] w-full bg-gray-800 max-w-[50px] group-hover:bg-[#2563EB] transition-colors"></div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{item.time}</span>
                                </div>

                                {/* Overlay "Bientôt" */}
                                <div className="absolute bottom-6 right-6">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700 bg-gray-900 px-2 py-1 border border-gray-800">
                                        En cours de conception
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- SECTION 4: SOCIAL PROOF / QUOTE --- */}
            <section className="py-24 bg-[#F3F4F6] border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <Quote className="w-12 h-12 text-[#001F3F] mx-auto mb-8 opacity-20" />
                    <h3 className="text-2xl md:text-4xl font-serif italic text-[#050505] leading-relaxed mb-8">
                        "La rhétorique est l'art de gouverner les esprits des hommes."
                    </h3>
                    <div className="flex flex-col items-center">
                        <div className="h-[1px] w-20 bg-[#001F3F] mb-4"></div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Platon</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Philosophe & Bâtisseur</span>
                    </div>
                </div>
            </section>

            {/* --- SECTION 5: FINAL CTA --- */}
            <section className="py-32 bg-[#001F3F] text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">VOTRE VOIX MÉRITE D'ÊTRE ENTENDUE.</h2>
                    <p className="text-gray-300 mb-12 font-light text-lg">
                        Ne laissez pas vos idées se perdre dans le bruit. Rejoignez la liste d'attente et recevez en avant-première notre guide PDF :
                        <span className="text-white font-medium italic"> "Les 5 Piliers de l'Argumentation".</span>
                    </p>
                    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto py-10">
                        {!session ? (
                            <>
                                <div className="w-full group">
                                    <form 
                                        onSubmit={handleJoin} 
                                        className="flex flex-col sm:flex-row gap-0 w-full bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 p-1.5 transition-all duration-300 focus-within:shadow-[0_20px_50px_rgba(37,99,235,0.15)] focus-within:border-blue-100"
                                    >
                                        <input
                                            type="email"
                                            placeholder="VOTRE EMAIL PROFESSIONNEL"
                                            className="flex-grow bg-transparent text-[#050505] px-6 py-5 text-[11px] font-bold uppercase tracking-[0.15em] focus:outline-none placeholder:text-gray-300"
                                            required
                                        />
                                        <button className="relative overflow-hidden bg-[#050505] text-white px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 hover:bg-blue-600 active:scale-[0.98] whitespace-nowrap shadow-lg">
                                            <span className="relative z-10">S'inscrire maintenant</span>
                                        </button>
                                    </form>
                                </div>
                                
                                <div className="flex items-center gap-4 opacity-40">
                                    <div className="h-[1px] w-8 bg-gray-400"></div>
                                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em] font-medium">
                                        Pas de spam. Uniquement de l'excellence.
                                    </p>
                                    <div className="h-[1px] w-8 bg-gray-400"></div>
                                </div>
                            </>
                        ) : (
                            <div className="relative group overflow-hidden p-10 border border-gray-100 bg-white shadow-2xl text-center max-w-md">
                                {/* Accent décoratif */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-20 bg-blue-600"></div>
                                
                             
                                <p className="text-[#050505] text-xl font-serif italic mb-2">
                                    Bienvenue
                                </p>
                                <p className="text-gray-400 text-[11px] uppercase tracking-widest font-light">
                                    Votre voyage vers l'excellence a commencé.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="bg-white py-12 border-t border-gray-200">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-[#001F3F]">
                        <div className="w-4 h-4 bg-[#001F3F]" />
                        Everest
                    </div>
                    <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        <a href="#" className="hover:text-[#001F3F] transition-colors">Instagram</a>
                        <a href="#" className="hover:text-[#001F3F] transition-colors">LinkedIn</a>
                        <a href="#" className="hover:text-[#001F3F] transition-colors">Contact</a>
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">© 2026. Tous droits réservés.</p>
                </div>
            </footer>

        </div>
    );
}