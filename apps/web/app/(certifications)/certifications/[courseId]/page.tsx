"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
    Award,
    Download,
    Share2,
    ArrowLeft,
    ShieldCheck,
    ExternalLink,
    Copy
} from "lucide-react";

// --- COMPOSANTS UI INTERNES ---

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-[0.2em] transition-all duration-300 rounded-none border flex items-center justify-center gap-2";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        outline: "bg-transparent border-gray-200 text-[#001F3F] hover:border-[#001F3F]",
        premium: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#001F3F]",
        dark: "bg-[#050505] text-white border-[#050505] hover:bg-white hover:text-[#050505]"
    };
    const sizes = {
        sm: "px-4 py-2 text-[9px]",
        md: "px-6 py-3 text-[10px]",
        lg: "px-8 py-4 text-xs"
    };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>{children}</button>;
};

// --- COMPOSANT PRINCIPAL ---

export default function Certification() {
    const params = useParams();
    const courseId = params?.courseId;
    const router = useRouter();

    const course = {
        title: "Développement React Avancé",
        instructor: "Prof. Sarah Johnson",
        completionDate: "15 JANVIER 2026",
        duration: "64 HEURES",
        certificateId: "EP-2026-X892-BFS",
        skills: ["Architecture React", "TypeScript Pro", "State Orchestration"]
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#2563EB] selection:text-white">
            {/* Navbar Minimaliste */}
            <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
                <button
                    onClick={() => router.push('/profile')}
                    className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#001F3F] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour au profil
                </button>
                <Image
                    src="/logo-white.png"
                    alt="Everest Academy"
                    width={120}
                    height={40}
                    className="h-10 w-auto object-contain"
                />
                <div className="w-8 h-8 bg-[#001F3F]"></div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-16">

                {/* Hero Section : Célébration sobre */}
                <div className="text-center mb-20">
                    <div className="inline-flex mb-8 relative">
                        <div className="w-20 h-20 bg-[#050505] flex items-center justify-center relative z-10">
                            <Award className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute -inset-2 border border-gray-100 animate-pulse"></div>
                    </div>
                    <h1 className="text-5xl font-bold tracking-tighter uppercase mb-4">Succès académique</h1>
                    <p className="text-gray-400 font-light tracking-[0.2em] uppercase text-xs">Votre expertise est désormais certifiée par Everest-Pro.</p>
                </div>

                {/* Le Certificat : "The Masterpiece" */}
                <div className="bg-white border-[1px] border-gray-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden mb-16">
                    {/* Filigrane discret */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] font-black text-gray-50/50 select-none pointer-events-none tracking-tighter italic">
                        EVEREST
                    </div>

                    <div className="p-16 md:p-24 relative z-10 border-[16px] border-white outline outline-1 outline-gray-100">
                        <div className="text-center">
                            <div className="flex justify-center mb-10">
                                <div className="w-12 h-1 bg-[#050505]"></div>
                            </div>

                            <h2 className="text-[10px] font-bold tracking-[0.5em] uppercase text-gray-400 mb-12 italic">
                                Diploma of Advanced Achievement
                            </h2>

                            <p className="text-xs font-light uppercase tracking-widest text-gray-500 mb-6">Attribué officiellement à</p>

                            {/* Le Nom : Serif pour le prestige */}
                            <h3 className="text-6xl md:text-7xl font-serif italic tracking-tight text-[#001F3F] mb-12">
                                Jean Dupont
                            </h3>

                            <div className="max-w-xl mx-auto mb-16">
                                <p className="text-sm font-light text-gray-500 leading-loose">
                                    Pour avoir démontré une maîtrise exceptionnelle des concepts avancés lors du cursus
                                    <span className="block font-bold text-[#050505] uppercase tracking-tighter text-2xl mt-4">
                                        {course.title}
                                    </span>
                                </p>
                            </div>

                            {/* Specs Technique */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-y border-gray-50 py-12 mb-16">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Instructeur</p>
                                    <p className="text-xs font-bold uppercase">{course.instructor}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Date d'émission</p>
                                    <p className="text-xs font-bold uppercase">{course.completionDate}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Identifiant</p>
                                    <p className="text-[10px] font-mono font-medium text-gray-400">{course.certificateId}</p>
                                </div>
                            </div>

                            {/* Skills Badge Style Luxe */}
                            <div className="flex flex-wrap justify-center gap-3 mb-12">
                                {course.skills.map((skill, i) => (
                                    <span key={i} className="px-4 py-1.5 bg-gray-50 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                                        {skill}
                                    </span>
                                ))}
                            </div>

                            <div className="flex justify-between items-end pt-10">
                                <div className="text-left">
                                    <ShieldCheck className="w-8 h-8 text-[#2563EB] mb-4" />
                                    <p className="text-[9px] font-bold uppercase tracking-tighter text-gray-300">Authenticité vérifiée via <br /> Blockchain Protocol</p>
                                </div>
                                <div className="text-right">
                                    <div className="w-32 h-1 bg-[#050505] ml-auto mb-4"></div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Everest Board of Directors</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions de partage */}
                <div className="flex flex-col md:flex-row justify-center gap-4 mb-20">
                    <Button variant="premium" size="lg" className="md:min-w-[280px]">
                        <Download className="w-4 h-4" /> Exporter en PDF (HD)
                    </Button>
                    <Button variant="outline" size="lg">
                        <Share2 className="w-4 h-4" /> LinkedIn
                    </Button>
                    <Button variant="outline" size="lg">
                        <Copy className="w-4 h-4" /> Copier l'URL
                    </Button>
                </div>

                {/* Section Next Steps : Contrasté */}
                <div className="bg-[#050505] p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <h4 className="text-white text-xl font-bold uppercase tracking-tighter mb-2">Prêt pour l'étape suivante ?</h4>
                        <p className="text-gray-500 text-xs uppercase tracking-widest">En tant que certifié, bénéficiez de -20% sur les Masters.</p>
                    </div>
                    <Button variant="dark" className="border-white text-white hover:bg-white hover:text-[#050505]">
                        Voir le catalogue Master <ExternalLink className="w-3 h-3 ml-2" />
                    </Button>
                </div>

            </main>

            <footer className="py-12 text-center text-[9px] font-bold uppercase tracking-[0.5em] text-gray-300 border-t border-gray-100">
                Everest Certification Authority • Non-Transferable Document
            </footer>
        </div>
    );
}
