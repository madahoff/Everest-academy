"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowRight, BookOpen, Check, Clock, Crown, Layers, Lock, Play, Star, Users } from "lucide-react"
import { useAuthModal } from "@/component/auth-modal-provider"

const LEVEL_LABELS: Record<string, string> = {
    BEGINNER: "Débutant",
    INTERMEDIATE: "Intermédiaire",
    ADVANCED: "Avancé",
    EXPERT: "Expert",
};

const Badge = ({ children, variant = "default" }: any) => {
    const styles: Record<string, string> = {
        default: "bg-[#F3F4F6] text-[#001F3F] border border-[#E5E7EB]",
        premium: "bg-[#050505] text-white border border-[#050505]",
        unlocked: "bg-[#2563EB] text-white border border-[#2563EB]",
        free: "bg-white text-[#2563EB] border border-[#2563EB]",
    };
    return (
        <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-none inline-flex items-center gap-1.5 ${styles[variant]}`}>
            {children}
        </span>
    );
};

/**
 * Carte du catalogue.
 *
 * Le premier signal lu doit être « puis-je l'ouvrir ? ». Un cours déjà accessible
 * sort donc du gris : image en couleur, filet bleu, et une action qui emmène
 * directement à la première section plutôt qu'à la page de vente.
 */
export const StyledCourseCard = ({ course, variant = "grid" }: { course: any; variant?: "grid" | "list" }) => {
    const { data: session } = useSession()
    const { openAuth } = useAuthModal()

    const price = parseFloat(course.price);
    const isFree = price === 0;
    const hasAccess = Boolean(course.hasAccess);
    const viaPremium = hasAccess && course.accessSource === "premium";
    const viaAdmin = hasAccess && course.accessSource === "admin";

    // Accès acquis : on reprend là où le cours commence, sans détour par la fiche.
    const href = hasAccess && course.firstSectionId
        ? `/courses/${course.id}/${course.firstSectionId}`
        : `/courses/${course.id}`;

    const handleClick = (e: React.MouseEvent) => {
        if (!session) {
            e.preventDefault()
            openAuth('login')
        }
    }

    const accessBadge = hasAccess ? (
        <Badge variant="unlocked">
            {viaPremium || viaAdmin ? <Crown className="w-3 h-3" /> : <Check className="w-3 h-3" />}
            {viaPremium ? "Inclus Premium" : viaAdmin ? "Accès admin" : "Débloqué"}
        </Badge>
    ) : isFree ? (
        <Badge variant="free">Gratuit</Badge>
    ) : (
        <Badge variant="premium"><Lock className="w-3 h-3" /> Premium</Badge>
    );

    const meta = (
        <>
            {course.duration && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <Clock className="w-3 h-3" /> {course.duration}
                </span>
            )}
            {course.sectionCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <Layers className="w-3 h-3" /> {course.sectionCount} module{course.sectionCount > 1 ? "s" : ""}
                </span>
            )}
            {course.level && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <Users className="w-3 h-3" /> {LEVEL_LABELS[course.level] ?? course.level}
                </span>
            )}
        </>
    );

    const priceBlock = hasAccess ? (
        <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Votre accès</span>
            <span className="text-lg font-bold text-[#2563EB]">Débloqué</span>
        </div>
    ) : (
        <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Investissement</span>
            <span className="text-lg font-bold text-[#001F3F]">
                {isFree ? "Gratuit" : `${price.toLocaleString("fr-FR")} Ar`}
            </span>
        </div>
    );

    const cta = (
        <span className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${hasAccess ? "text-[#2563EB]" : "text-[#001F3F] group-hover:text-[#2563EB]"}`}>
            {hasAccess ? (
                <><Play className="w-3 h-3 fill-current" /> Continuer</>
            ) : isFree ? (
                <>Commencer <ArrowRight className="w-3 h-3" /></>
            ) : (
                <>Découvrir <ArrowRight className="w-3 h-3" /></>
            )}
        </span>
    );

    const thumbnail = (rounded: string) => (
        <div className={`relative overflow-hidden bg-gray-100 ${rounded}`}>
            {course.cardImage ? (
                <img
                    src={course.cardImage}
                    alt={course.title}
                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${hasAccess ? "" : "filter grayscale group-hover:grayscale-0"}`}
                />
            ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-gray-400" />
                </div>
            )}
            {/* Voile de verrouillage : l'inaccessible doit se voir sans être lu. */}
            {!hasAccess && !isFree && (
                <div className="absolute inset-0 bg-[#050505]/10 group-hover:bg-transparent transition-colors" />
            )}
            <div className="absolute top-0 left-0 p-4 w-full flex justify-between items-start gap-2">
                {accessBadge}
            </div>
        </div>
    );

    // --- Variante liste : une ligne dense, lisible en balayage vertical ---
    if (variant === "list") {
        return (
            <Link href={href} onClick={handleClick} className="block">
                <article className={`group relative bg-white border transition-all duration-300 hover:shadow-xl flex flex-col sm:flex-row gap-0 sm:gap-8 ${hasAccess ? "border-[#2563EB]/40" : "border-gray-200 hover:border-[#001F3F]"}`}>
                    {hasAccess && <span className="absolute left-0 top-0 h-full w-1 bg-[#2563EB]" aria-hidden />}

                    <div className="sm:w-72 shrink-0 aspect-[16/9] sm:aspect-auto sm:h-auto">
                        {thumbnail("h-full")}
                    </div>

                    <div className="flex-1 p-6 sm:py-8 sm:pr-8 sm:pl-0 flex flex-col">
                        <div className="flex items-start justify-between gap-6 mb-3">
                            <h3 className="text-xl font-bold text-[#050505] leading-snug group-hover:text-[#2563EB] transition-colors">
                                {course.title}
                            </h3>
                            <span className="flex items-center gap-1 shrink-0">
                                <Star className="w-3 h-3 fill-[#001F3F] text-[#001F3F]" />
                                <span className="text-xs font-bold text-[#001F3F]">{course.averageRating ?? "N/A"}</span>
                            </span>
                        </div>

                        <p className="text-gray-500 text-sm font-light leading-relaxed line-clamp-2 mb-5">
                            {course.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">{meta}</div>

                        <div className="mt-auto pt-5 border-t border-gray-100 flex items-center justify-between gap-6">
                            {priceBlock}
                            {cta}
                        </div>
                    </div>
                </article>
            </Link>
        );
    }

    // --- Variante grille (par défaut) ---
    return (
        <Link href={href} onClick={handleClick} className="block h-full">
            <article className={`group relative bg-white border transition-all duration-500 hover:shadow-2xl flex flex-col h-full cursor-pointer ${hasAccess ? "border-[#2563EB]/40" : "border-gray-200 hover:border-[#001F3F]"}`}>
                {hasAccess && <span className="absolute left-0 top-0 h-1 w-full bg-[#2563EB] z-10" aria-hidden />}

                <div className="aspect-[16/9]">{thumbnail("h-full")}</div>

                <div className="p-8 flex flex-col flex-grow">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cours Magistral</span>
                        <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#001F3F] text-[#001F3F]" />
                            <span className="text-xs font-bold text-[#001F3F]">{course.averageRating ?? "N/A"}</span>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold text-[#050505] mb-3 leading-snug group-hover:text-[#2563EB] transition-colors">
                        {course.title}
                    </h3>

                    <p className="text-gray-500 text-sm mb-5 line-clamp-2 font-light leading-relaxed">
                        {course.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-6">{meta}</div>

                    <div className="mt-auto pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
                        {priceBlock}
                        {cta}
                    </div>
                </div>
            </article>
        </Link>
    );
}
