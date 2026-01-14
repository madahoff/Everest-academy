 "use client";

// import { useState, useEffect, Suspense } from "react";
// import { useSearchParams } from "next/navigation";
// import {
//     Search,
//     Calendar,
//     MapPin,
//     Filter,
//     X,
//     LayoutGrid,
//     List as ListIcon,
//     ArrowUpDown,
//     Clock
// } from "lucide-react";

// // --- UI COMPONENTS INTERNES (Style Cohérent) ---

// const Button = ({ children, variant = "primary", className = "", onClick, ...props }: any) => {
//     const baseStyle = "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-300 ease-out flex items-center justify-center gap-2 rounded-none border";
//     const variants = {
//         primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
//         outline: "bg-transparent border-gray-300 text-[#050505] hover:border-[#001F3F] hover:text-[#001F3F]",
//         ghost: "bg-transparent border-transparent text-gray-400 hover:text-[#001F3F] hover:bg-gray-50",
//         active: "bg-[#F3F4F6] text-[#001F3F] border-[#001F3F]"
//     };

//     return (
//         <button
//             className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
//             onClick={onClick}
//             {...props}
//         >
//             {children}
//         </button>
//     );
// };

// // --- COMPOSANT PRINCIPAL ---

// export default function EventsList({ initialEvents }: { initialEvents: any[] }) {
//     return (
//         <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB]" />}>
//             <EventsListContent initialEvents={initialEvents} />
//         </Suspense>
//     );
// }

// function EventsListContent({ initialEvents }: { initialEvents: any[] }) {
//     const searchParams = useSearchParams();

//     // --- STATE MANAGEMENT ---
//     const [events, setEvents] = useState(initialEvents);
//     const [filteredEvents, setFilteredEvents] = useState(initialEvents);
//     const [searchQuery, setSearchQuery] = useState("");
//     const [filterType, setFilterType] = useState("all"); // 'all', 'upcoming', 'past'
//     const [sortBy, setSortBy] = useState("date_asc"); // 'date_asc', 'date_desc'
//     const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

//     // --- INITIALIZATION & SYNC ---
//     useEffect(() => {
//         const type = searchParams.get("type");
//         if (type) setFilterType(type);
//         const search = searchParams.get("search");
//         if (search) setSearchQuery(search);
//     }, [searchParams]);

//     // --- FILTERING LOGIC ---
//     useEffect(() => {
//         let result = [...events];
//         const now = new Date();

//         // 1. Search
//         if (searchQuery) {
//             const lowerQuery = searchQuery.toLowerCase();
//             result = result.filter(e =>
//                 e.title.toLowerCase().includes(lowerQuery) ||
//                 e.description.toLowerCase().includes(lowerQuery) ||
//                 e.location.toLowerCase().includes(lowerQuery)
//             );
//         }

//         // 2. Type Filter (Date based)
//         if (filterType === "upcoming") {
//             result = result.filter(e => new Date(e.date) >= now);
//         } else if (filterType === "past") {
//             result = result.filter(e => new Date(e.date) < now);
//         }

//         // 3. Sorting
//         switch (sortBy) {
//             case "date_asc":
//                 result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
//                 break;
//             case "date_desc":
//                 result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
//                 break;
//         }

//         setFilteredEvents(result);
//     }, [events, searchQuery, filterType, sortBy]);

//     const handleReset = () => {
//         setSearchQuery("");
//         setFilterType("all");
//         setSortBy("date_asc");
//     };

//     // --- STATS CALCULATION ---
//     const stats = {
//         total: events.length,
//         upcoming: events.filter(e => new Date(e.date) >= new Date()).length,
//         past: events.filter(e => new Date(e.date) < new Date()).length,
//     };

//     return (
//         <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F] selection:text-white pb-24">

//             {/* --- HEADER SECTION: "EXECUTIVE SUMMARY" --- */}
//             <div className="bg-white border-b border-gray-200 pt-24 pb-12">
//                 <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
//                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">

//                         {/* Title Block */}
//                         <div className="lg:col-span-8">
//                             <div className="flex items-center gap-3 mb-6">
//                                 <span className="w-2 h-2 bg-[#2563EB]"></span>
//                                 <span className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500">
//                                     Agenda & Rencontres
//                                 </span>
//                             </div>
//                             <h1 className="text-5xl lg:text-7xl font-bold text-[#050505] tracking-tight mb-6 leading-none">
//                                 Événements <br />
//                                 <span className="text-[#001F3F]">Everest.</span>
//                             </h1>
//                             <p className="text-lg text-gray-500 max-w-2xl font-light leading-relaxed border-l-2 border-[#2563EB] pl-6">
//                                 Rejoignez notre communauté lors de conférences, ateliers et webinaires exclusifs.
//                             </p>
//                         </div>

//                         {/* Stats Box - Style "Dashboard" */}
//                         <div className="lg:col-span-4 bg-[#F9FAFB] border border-gray-200 p-8">
//                             <div className="grid grid-cols-2 gap-y-6 gap-x-8">
//                                 <div>
//                                     <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Total Événements</div>
//                                     <div className="text-3xl font-light text-[#001F3F]">{stats.total}</div>
//                                 </div>
//                                 <div>
//                                     <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">À Venir</div>
//                                     <div className="text-3xl font-light text-[#2563EB]">{stats.upcoming}</div>
//                                 </div>
//                                 <div className="col-span-2 border-t border-gray-200 pt-4 flex justify-between items-center">
//                                     <span className="text-xs uppercase tracking-widest text-gray-400">Passés</span>
//                                     <span className="font-bold text-[#050505]">{stats.past} archivés</span>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* --- TOOLBAR: STICKY FILTERS --- */}
//             <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 py-4 shadow-sm">
//                 <div className="max-w-[1600px] mx-auto px-6 lg:px-12 flex flex-col lg:flex-row justify-between items-center gap-4">

//                     {/* Left: Search & Type */}
//                     <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
//                         <div className="relative group w-full sm:w-80">
//                             <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#001F3F] transition-colors" />
//                             <input
//                                 placeholder="RECHERCHER UN ÉVÉNEMENT..."
//                                 value={searchQuery}
//                                 onChange={(e) => setSearchQuery(e.target.value)}
//                                 className="w-full bg-transparent border-b border-gray-300 py-2 pl-8 pr-4 text-sm font-medium focus:outline-none focus:border-[#001F3F] transition-colors rounded-none placeholder:text-gray-300 placeholder:text-xs placeholder:tracking-widest"
//                             />
//                         </div>

//                         <div className="flex items-center gap-4 border-l border-gray-200 pl-6 h-8">
//                             <button
//                                 onClick={() => setFilterType("all")}
//                                 className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterType === 'all' ? 'text-[#001F3F]' : 'text-gray-400 hover:text-gray-600'}`}
//                             >
//                                 Tous
//                             </button>
//                             <button
//                                 onClick={() => setFilterType("upcoming")}
//                                 className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterType === 'upcoming' ? 'text-[#001F3F]' : 'text-gray-400 hover:text-gray-600'}`}
//                             >
//                                 À Venir
//                             </button>
//                             <button
//                                 onClick={() => setFilterType("past")}
//                                 className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterType === 'past' ? 'text-[#001F3F]' : 'text-gray-400 hover:text-gray-600'}`}
//                             >
//                                 Passés
//                             </button>
//                         </div>
//                     </div>

//                     {/* Right: Sort & Layout */}
//                     <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
//                         {(searchQuery || filterType !== 'all') && (
//                             <button onClick={handleReset} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 mr-4">
//                                 <X className="w-3 h-3" /> Reset
//                             </button>
//                         )}

//                         <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-white">
//                             <ArrowUpDown className="w-3 h-3 text-gray-400" />
//                             <select
//                                 value={sortBy}
//                                 onChange={(e) => setSortBy(e.target.value)}
//                                 className="bg-transparent text-xs font-bold uppercase tracking-wider text-[#050505] focus:outline-none cursor-pointer pr-2"
//                             >
//                                 <option value="date_asc">Date Croissante</option>
//                                 <option value="date_desc">Date Décroissante</option>
//                             </select>
//                         </div>

//                         <div className="flex border border-gray-200 bg-white">
//                             <button
//                                 onClick={() => setViewMode("grid")}
//                                 className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#001F3F] text-white" : "text-gray-400 hover:text-[#001F3F]"}`}
//                             >
//                                 <LayoutGrid className="w-4 h-4" />
//                             </button>
//                             <button
//                                 onClick={() => setViewMode("list")}
//                                 className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#001F3F] text-white" : "text-gray-400 hover:text-[#001F3F]"}`}
//                             >
//                                 <ListIcon className="w-4 h-4" />
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* --- MAIN GRID --- */}
//             <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12">
//                 {filteredEvents.length > 0 ? (
//                     <div className={`grid gap-8 ${viewMode === "grid"
//                         ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
//                         : "grid-cols-1"
//                         }`}>
//                         {filteredEvents.map((event) => (
//                             <div key={event.id} className="group border border-gray-100 bg-white hover:border-[#001F3F] transition-all duration-300">
//                                 {/* CARD IMAGE */}
//                                 <div className={`relative overflow-hidden ${viewMode === "list" ? "w-64 h-40 shrink-0" : "aspect-[16/9]"}`}>
//                                     {viewMode === "list" && (
//                                         <div className="absolute inset-0 bg-gray-100 flex flex-row">
//                                             {/* Image placeholder */}
//                                             <div className="w-full h-full bg-gray-200"></div>
//                                         </div>
//                                     )}
//                                     {viewMode === "grid" && (
//                                         <div className="w-full h-full bg-gray-200"></div>
//                                     )}
//                                     {/* DATE BADGE */}
//                                     <div className="absolute top-4 left-4 bg-white px-3 py-2 text-center shadow-lg border border-gray-100">
//                                         <div className="text-[10px] font-black uppercase text-gray-400">{new Date(event.date).toLocaleDateString('fr-FR', { month: 'short' })}</div>
//                                         <div className="text-lg font-bold text-[#001F3F] leading-none">{new Date(event.date).getDate()}</div>
//                                     </div>
//                                 </div>

//                                 {/* CARD CONTENT */}
//                                 <div className={viewMode === "list" ? "p-6 flex-1 flex flex-col justify-between" : "p-6"}>
//                                     <div>
//                                         <div className="flex items-center gap-2 mb-3">
//                                             <span className="w-1.5 h-1.5 bg-[#2563EB]"></span>
//                                             <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
//                                                 {event.category}
//                                             </span>
//                                         </div>
//                                         <h3 className="text-xl font-bold text-[#050505] mb-2 group-hover:text-[#2563EB] transition-colors line-clamp-2">
//                                             {event.title}
//                                         </h3>
//                                         <p className="text-sm text-gray-500 line-clamp-3 mb-4 font-light leading-relaxed">
//                                             {event.description}
//                                         </p>
//                                     </div>

//                                     <div className="space-y-3 pt-4 border-t border-gray-50">
//                                         <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
//                                             <Clock className="w-3 h-3 text-[#2563EB]" />
//                                             {new Date(event.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
//                                         </div>
//                                         <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
//                                             <MapPin className="w-3 h-3 text-[#2563EB]" />
//                                             {event.location}
//                                         </div>
//                                     </div>
//                                 </div>
//                                 {viewMode === "list" && (
//                                     <div className="hidden">
//                                         {/* Adjusted structure for list view if needed, but current flex works */}
//                                     </div>
//                                 )}
//                             </div>
//                         ))}
//                         {/* List view generic container style was simple above, but can be improved if needed. */}
//                     </div>
//                 ) : (
//                     // --- EMPTY STATE ---
//                     <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-gray-200 bg-white/50">
//                         <div className="bg-gray-100 p-6 rounded-full mb-6">
//                             <Calendar className="w-10 h-10 text-gray-400" />
//                         </div>
//                         <h3 className="text-xl font-bold text-[#050505] mb-2 uppercase tracking-wide">Aucun événement</h3>
//                         <p className="text-gray-500 max-w-md mb-8 font-light">
//                             Aucun événement ne correspond à votre recherche pour le moment.
//                         </p>
//                         <Button variant="outline" onClick={handleReset}>
//                             Voir tous les événements
//                         </Button>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }

import { useState } from "react";
import {
    ArrowRight,
    Hammer,
    Construction,
    Check,
    Loader2
} from "lucide-react";

// --- RÉUTILISATION DU STYLE DES BOUTONS (Même Design System) ---
const Button = ({ children, variant = "primary", size = "md", className = "", disabled, ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 ease-out flex items-center justify-center gap-2 rounded-none border disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-white hover:text-[#2563EB]", // Accent Blue pour le CTA principal ici
        outline: "bg-transparent border-gray-700 text-white hover:bg-white hover:text-[#050505]",
        ghost: "bg-transparent border-transparent text-gray-500 hover:text-white"
    };
    const sizes = { sm: "px-4 py-2 text-[10px]", md: "px-6 py-3 text-xs", lg: "px-8 py-4 text-sm" };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

export default function ComingSoon() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");
        // Simulation d'appel API
        setTimeout(() => {
            setStatus("success");
            setEmail("");
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#2563EB] selection:text-white flex flex-col relative overflow-hidden">

            {/* Background Grids/Decoration */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>

            {/* Top Bar */}
            <div className="relative z-10 w-full p-6 lg:p-12 flex justify-between items-center border-b border-gray-900">
                <div className="flex items-center gap-2 text-[#2563EB]">
                    <Construction className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-[0.3em]">Zone en Travaux</span>
                </div>
                <div className="hidden md:block text-xs font-bold uppercase tracking-widest text-gray-600">
                    Est. 2026
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 flex-grow flex flex-col justify-center items-center px-6 lg:px-12 text-center">

                {/* Icon principal */}
                <div className="mb-8 p-6 border border-gray-800 bg-gray-900/50 backdrop-blur-sm rotate-3 hover:rotate-0 transition-transform duration-500">
                    <Hammer className="w-12 h-12 text-white" />
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6">
                    NOUS FORGEONS <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">L'AVENIR.</span>
                </h1>

                <p className="max-w-xl text-gray-400 text-sm md:text-base leading-relaxed mb-12 font-light">
                    Cette page est actuellement en cours de construction. Nous assemblons les meilleurs outils pour bâtisseurs. Soyez le premier averti lors du lancement.
                </p>

                {/* Newsletter Form */}
                <div className="w-full max-w-md">
                    {status === "success" ? (
                        <div className="p-4 border border-[#2563EB] bg-[#2563EB]/10 flex items-center justify-center gap-3 animate-in fade-in zoom-in">
                            <Check className="w-5 h-5 text-[#2563EB]" />
                            <span className="text-sm font-bold uppercase tracking-widest text-[#2563EB]">Inscription validée</span>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="relative group w-full">
                                <input
                                    type="email"
                                    placeholder="VOTRE ADRESSE EMAIL"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-transparent border-b border-gray-700 py-4 px-2 text-sm font-bold text-white focus:outline-none focus:border-[#2563EB] transition-colors rounded-none placeholder:text-gray-600 placeholder:text-xs placeholder:tracking-[0.2em] text-center md:text-left"
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full md:w-auto"
                                disabled={status === "loading"}
                            >
                                {status === "loading" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        ME PRÉVENIR <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                {/* Technical details / Progress bar decoration */}
                <div className="mt-16 w-full max-w-xs">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                        <span>Progression</span>
                        <span>85%</span>
                    </div>
                    <div className="h-1 w-full bg-gray-900 rounded-none overflow-hidden">
                        <div className="h-full bg-[#2563EB] w-[85%] relative">
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] skew-x-12 translate-x-[-100%]"></div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 p-6 lg:p-12 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                    © 2026 Builders Inc. Tous droits réservés.
                </p>
                <div className="flex gap-6">
                    {["Twitter", "Instagram", "LinkedIn"].map((social) => (
                        <a key={social} href="#" className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                            {social}
                        </a>
                    ))}
                </div>
            </footer>
        </div>
    );
}
