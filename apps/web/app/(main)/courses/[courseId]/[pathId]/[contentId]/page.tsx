"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    Heart,
    MessageCircle,
    CheckCircle,
    Send,
    Clock,
    Layers,
    ChevronRight
} from "lucide-react";

// --- COMPOSANTS UI INTERNES ---

const Button = ({ children, variant = "primary", size = "md", className = "", disabled, ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 rounded-none border flex items-center justify-center gap-2 disabled:opacity-30";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        outline: "bg-transparent border-gray-200 text-[#001F3F] hover:border-[#001F3F]",
        ghost: "bg-transparent border-transparent text-gray-500 hover:text-[#001F3F]",
        premium: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#001F3F]",
        dark: "bg-[#050505] text-white border-[#050505] hover:bg-white hover:text-[#050505]"
    };
    const sizes = {
        sm: "px-4 py-2 text-[10px]",
        md: "px-6 py-3 text-xs",
        lg: "px-8 py-4 text-sm"
    };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

const Badge = ({ children }: any) => (
    <span className="px-3 py-1 bg-[#050505] text-white text-[9px] font-bold uppercase tracking-[0.2em] rounded-none">
        {children}
    </span>
);

// --- COMPOSANT PRINCIPAL ---

export default function Content() {
    const params = useParams();
    const courseId = params?.courseId;
    const pathId = params?.pathId;
    const contentId = params?.contentId; // although not used in the mock
    const router = useRouter();

    const [content] = useState({
        title: "Introduction à React",
        type: "video",
        duration: "15 min",
        videoUrl: "https://www.youtube.com/embed/dGcsHMXbSOA",
        description: "Exploration des concepts fondamentaux : Virtual DOM, Components et l'écosystème moderne de React.",
        likes: 24,
        comments: [
            { id: "1", user: "Marie Dubois", text: "Excellente introduction ! Très clair.", date: "2H" },
            { id: "2", user: "Thomas Martin", text: "Le concept du Virtual DOM est enfin limpide.", date: "1J" }
        ]
    });

    const [isLiked, setIsLiked] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [newComment, setNewComment] = useState("");

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F] selection:text-white">

            {/* Header Navigation : Barre de progression ultra-fine */}
            <div className="fixed top-0 left-0 w-full h-1 bg-gray-100 z-[60]">
                <div className="h-full bg-[#2563EB] w-1/2 transition-all duration-1000"></div>
            </div>

            <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-1 z-50">
                <button
                    onClick={() => router.push(`/courses/${courseId}/${pathId}`)}
                    className="group flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#001F3F] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au module
                </button>
                <div className="hidden md:flex items-center gap-8">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-400">
                        <Layers className="w-3 h-3" /> Module 01 / Section 04
                    </div>
                </div>
                <div className="w-8 h-8 bg-[#001F3F]"></div>
            </nav>

            <main className="max-w-[1600px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Main Stage (8 colonnes) */}
                    <div className="lg:col-span-8">

                        {/* Titre et Meta */}
                        <div className="mb-10">
                            <div className="flex items-center gap-4 mb-4">
                                <Badge>{content.type}</Badge>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                    <Clock className="w-3 h-3" /> {content.duration}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-6 leading-none">
                                {content.title}
                            </h1>
                            <p className="text-lg font-light text-gray-500 max-w-3xl leading-relaxed">
                                {content.description}
                            </p>
                        </div>

                        {/* Lecteur Vidéo / Zone de contenu */}
                        <div className="relative bg-[#050505] aspect-video mb-8 group overflow-hidden border-8 border-white shadow-2xl">
                            <iframe
                                src={content.videoUrl}
                                title={content.title}
                                className="w-full h-full grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                                allowFullScreen
                            />
                        </div>

                        {/* Barre d'interaction */}
                        <div className="flex flex-wrap items-center justify-between gap-6 border-y border-gray-100 py-6 mb-12">
                            <div className="flex items-center gap-8">
                                <button
                                    onClick={() => setIsLiked(!isLiked)}
                                    className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-[#001F3F]'}`}
                                >
                                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} /> {content.likes + (isLiked ? 1 : 0)}
                                </button>
                                <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-[#001F3F]">
                                    <MessageCircle className="w-4 h-4" /> {content.comments.length}
                                </button>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    variant={isCompleted ? "outline" : "dark"}
                                    onClick={() => setIsCompleted(true)}
                                    disabled={isCompleted}
                                    className="min-w-[200px]"
                                >
                                    {isCompleted ? <><CheckCircle className="w-4 h-4 text-green-500" /> Complété</> : "Valider cette étape"}
                                </Button>
                            </div>
                        </div>

                        {/* Section Commentaires : Style Minimaliste */}
                        <section className="max-w-2xl">
                            <h3 className="text-xs font-bold uppercase tracking-[0.3em] mb-8">Discussions</h3>

                            <div className="flex gap-4 mb-12">
                                <div className="w-10 h-10 bg-gray-100 flex-shrink-0"></div>
                                <div className="flex-1 relative">
                                    <textarea
                                        placeholder="AJOUTER UNE NOTE..."
                                        className="w-full bg-transparent border-b border-gray-200 py-2 focus:outline-none focus:border-[#001F3F] text-xs font-medium placeholder:text-gray-300 resize-none"
                                        rows={1}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                    />
                                    <button className="absolute right-0 bottom-2 text-[#2563EB] hover:text-[#001F3F]">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {content.comments.map((comm) => (
                                    <div key={comm.id} className="flex gap-6 group">
                                        <div className="w-8 h-8 bg-gray-50 flex-shrink-0 text-[10px] font-bold flex items-center justify-center text-gray-300">
                                            {comm.user.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wide">{comm.user}</span>
                                                <span className="text-[9px] text-gray-300 uppercase">{comm.date}</span>
                                            </div>
                                            <p className="text-sm text-gray-500 font-light leading-relaxed">{comm.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Navigation (4 colonnes) */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Progression Sidebar */}
                        <div className="bg-white border border-gray-100 p-8">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-6 italic">Statut du parcours</h3>
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-3xl font-bold tracking-tighter">50%</span>
                                <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest pb-1">02/04 Étapes</span>
                            </div>
                            <div className="h-1 bg-gray-50 w-full mb-8">
                                <div className="h-full bg-[#2563EB] w-1/2"></div>
                            </div>

                            <div className="space-y-4">
                                <Button variant="outline" className="w-full justify-between group">
                                    <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" /> Précédent
                                </Button>
                                <Button variant="primary" className="w-full justify-between group">
                                    Suivant <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </div>
                        </div>

                        {/* Ressources / Sidebar Aditionnelle */}
                        <div className="p-8 border border-dashed border-gray-200">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#050505] mb-6">Documents joints</h3>
                            <ul className="space-y-4">
                                {['Cheat-sheet-React.pdf', 'Notes-de-cours.md'].map((doc, i) => (
                                    <li key={i} className="flex items-center justify-between group cursor-pointer">
                                        <span className="text-xs text-gray-400 group-hover:text-[#2563EB] transition-colors">{doc}</span>
                                        <ChevronRight className="w-3 h-3 text-gray-200" />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>
            </main>

            {/* Footer minimaliste */}
            <footer className="py-12 border-t border-gray-100 mt-20 px-8 flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.4em] text-gray-300">
                <span>Everest  Academy</span>
                <span>© 2026</span>
            </footer>
        </div>
    );
}
