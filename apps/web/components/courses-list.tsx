"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Search,
    BookOpen,
    Filter,
    X,
    LayoutGrid,
    List as ListIcon,
    ArrowUpDown
} from "lucide-react";
import { StyledCourseCard } from "@/components/styled-course-card"; // Votre composant existant

// --- UI COMPONENTS INTERNES (Style Cohérent) ---

const Button = ({ children, variant = "primary", className = "", onClick, ...props }: any) => {
    const baseStyle = "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-300 ease-out flex items-center justify-center gap-2 rounded-none border";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        outline: "bg-transparent border-gray-300 text-[#050505] hover:border-[#001F3F] hover:text-[#001F3F]",
        ghost: "bg-transparent border-transparent text-gray-400 hover:text-[#001F3F] hover:bg-gray-50",
        active: "bg-[#F3F4F6] text-[#001F3F] border-[#001F3F]"
    };

    return (
        <button
            className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    );
};

// --- COMPOSANT PRINCIPAL ---

export default function CoursesList({ initialCourses }: { initialCourses: any[] }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB]" />}>
            <CoursesListContent initialCourses={initialCourses} />
        </Suspense>
    );
}

function CoursesListContent({ initialCourses }: { initialCourses: any[] }) {
    const searchParams = useSearchParams();

    // --- STATE MANAGEMENT ---
    const [courses, setCourses] = useState(initialCourses);
    const [filteredCourses, setFilteredCourses] = useState(initialCourses);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all"); // 'all', 'free', 'premium'
    const [sortBy, setSortBy] = useState("newest"); // 'newest', 'popular', 'price_asc', 'price_desc'
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // --- INITIALIZATION & SYNC ---
    useEffect(() => {
        const type = searchParams.get("type");
        if (type) setFilterType(type);
        const search = searchParams.get("search");
        if (search) setSearchQuery(search);
    }, [searchParams]);

    // --- FILTERING LOGIC ---
    useEffect(() => {
        let result = [...courses];

        // 1. Search
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.title.toLowerCase().includes(lowerQuery) ||
                c.description.toLowerCase().includes(lowerQuery)
            );
        }

        // 2. Type Filter
        if (filterType === "free") {
            result = result.filter(c => parseFloat(c.price) === 0);
        } else if (filterType === "premium") {
            result = result.filter(c => parseFloat(c.price) > 0);
        }

        // 3. Sorting
        switch (sortBy) {
            case "newest":
                result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
            case "popular":
                result.sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0));
                break;
            case "price_asc":
                result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                break;
            case "price_desc":
                result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                break;
        }

        setFilteredCourses(result);
    }, [courses, searchQuery, filterType, sortBy]);

    const handleReset = () => {
        setSearchQuery("");
        setFilterType("all");
        setSortBy("newest");
    };

    // --- STATS CALCULATION ---
    const stats = {
        total: courses.length,
        free: courses.filter(c => parseFloat(c.price) === 0).length,
        premium: courses.filter(c => parseFloat(c.price) > 0).length,
        hours: courses.reduce((acc, curr) => acc + (curr.duration || 0), 0) // Hypothetical duration
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F] selection:text-white pb-24">

            {/* --- HEADER SECTION: "EXECUTIVE SUMMARY" --- */}
            <div className="bg-white border-b border-gray-200 pt-24 pb-12">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">

                        {/* Title Block */}
                        <div className="lg:col-span-8">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="w-2 h-2 bg-[#2563EB]"></span>
                                <span className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500">
                                    Année Académique 2026
                                </span>
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-bold text-[#050505] tracking-tight mb-6 leading-none">
                                Catalogue <br />
                                <span className="text-[#001F3F]">MasterClass.</span>
                            </h1>
                            <p className="text-lg text-gray-500 max-w-2xl font-light leading-relaxed border-l-2 border-[#2563EB] pl-6">
                                Une bibliothèque de savoirs structurés. Filtrez par spécialité, niveau d'expertise ou accessibilité.
                            </p>
                        </div>

                        {/* Stats Box - Style "Dashboard" */}
                        <div className="lg:col-span-4 bg-[#F9FAFB] border border-gray-200 p-8">
                            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                                <div>
                                    <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Total Modules</div>
                                    <div className="text-3xl font-light text-[#001F3F]">{stats.total}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Open Source</div>
                                    <div className="text-3xl font-light text-[#2563EB]">{stats.free}</div>
                                </div>
                                <div className="col-span-2 border-t border-gray-200 pt-4 flex justify-between items-center">
                                    <span className="text-xs uppercase tracking-widest text-gray-400">Cursus Premium</span>
                                    <span className="font-bold text-[#050505]">{stats.premium} actifs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TOOLBAR: STICKY FILTERS --- */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 py-4 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 flex flex-col lg:flex-row justify-between items-center gap-4">

                    {/* Left: Search & Type */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
                        <div className="relative group w-full sm:w-80">
                            <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#001F3F] transition-colors" />
                            <input
                                placeholder="RECHERCHER UN SUJET..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-b border-gray-300 py-2 pl-8 pr-4 text-sm font-medium focus:outline-none focus:border-[#001F3F] transition-colors rounded-none placeholder:text-gray-300 placeholder:text-xs placeholder:tracking-widest"
                            />
                        </div>

                        <div className="flex items-center gap-4 border-l border-gray-200 pl-6 h-8">
                            <button
                                onClick={() => setFilterType("all")}
                                className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterType === 'all' ? 'text-[#001F3F]' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => setFilterType("free")}
                                className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterType === 'free' ? 'text-[#001F3F]' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Gratuit
                            </button>
                            <button
                                onClick={() => setFilterType("premium")}
                                className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterType === 'premium' ? 'text-[#001F3F]' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Premium
                            </button>
                        </div>
                    </div>

                    {/* Right: Sort & Layout */}
                    <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
                        {(searchQuery || filterType !== 'all') && (
                            <button onClick={handleReset} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 mr-4">
                                <X className="w-3 h-3" /> Reset
                            </button>
                        )}

                        <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-white">
                            <ArrowUpDown className="w-3 h-3 text-gray-400" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-transparent text-xs font-bold uppercase tracking-wider text-[#050505] focus:outline-none cursor-pointer pr-2"
                            >
                                <option value="newest">Plus Récents</option>
                                <option value="popular">Populaires</option>
                                <option value="price_asc">Prix Croissant</option>
                                <option value="price_desc">Prix Décroissant</option>
                            </select>
                        </div>

                        <div className="flex border border-gray-200 bg-white">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#001F3F] text-white" : "text-gray-400 hover:text-[#001F3F]"}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#001F3F] text-white" : "text-gray-400 hover:text-[#001F3F]"}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MAIN GRID --- */}
            <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12">
                {filteredCourses.length > 0 ? (
                    <div className={`grid gap-8 ${viewMode === "grid"
                        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "grid-cols-1"
                        }`}>
                        {filteredCourses.map((course) => (
                            <div key={course.id} className={viewMode === "list" ? "flex gap-6 border border-gray-100 p-4 bg-white items-center" : ""}>
                                {/* En mode liste, on pourrait adapter l'affichage ici, mais pour l'instant on utilise la Card Standard */}
                                <StyledCourseCard
                                    course={course}
                                // Si vous voulez passer une prop pour le mode liste au composant enfant : variant={viewMode}
                                />
                                {viewMode === "list" && (
                                    <div className="hidden md:block flex-1 pl-4 border-l border-gray-100 ml-4">
                                        <p className="text-sm text-gray-500 line-clamp-2">{course.description}</p>
                                        <div className="mt-4 flex gap-4">
                                            <span className="text-xs font-bold bg-gray-100 px-2 py-1 uppercase">{course.duration || "4h 30m"}</span>
                                            <span className="text-xs font-bold bg-gray-100 px-2 py-1 uppercase">{course.level || "Intermédiaire"}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // --- EMPTY STATE ---
                    <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-gray-200 bg-white/50">
                        <div className="bg-gray-100 p-6 rounded-full mb-6">
                            <BookOpen className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-[#050505] mb-2 uppercase tracking-wide">Aucun résultat</h3>
                        <p className="text-gray-500 max-w-md mb-8 font-light">
                            Nous n'avons trouvé aucun module correspondant à "{searchQuery}" avec les filtres actuels.
                        </p>
                        <Button variant="outline" onClick={handleReset}>
                            Réinitialiser le catalogue
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}