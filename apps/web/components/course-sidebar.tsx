"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Play, Heart, Share2, Award, Layers, Info, CheckCircle, X, Volume2, VolumeX, Ticket, Loader2, ChevronDown, ChevronUp, Sparkles, PlayCircle, Lock, Trophy, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const Button = ({ children, variant = "primary", size = "md", className = "", onClick, disabled, ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 rounded-none border flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        outline: "bg-transparent border-gray-200 text-[#001F3F] hover:border-[#001F3F]",
        premium: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#001F3F]",
        ghost: "border-transparent text-gray-500 hover:text-[#001F3F]"
    };
    const sizes = {
        sm: "px-4 py-2 text-[10px]",
        md: "px-6 py-3 text-xs",
        lg: "px-8 py-4 text-sm"
    };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} onClick={onClick} disabled={disabled} {...props}>{children}</button>;
};

// Helper to convert video URLs to embeddable format
function getEmbedUrl(url: string): string | null {
    if (!url) return null;

    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&mute=1`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1`;
    }

    // Direct video file
    if (url.match(/\.(mp4|webm|mov)$/i) || url.includes('/uploads/')) {
        return url; // Will use native video player
    }

    return null;
}

function isDirectVideo(url: string): boolean {
    return url.match(/\.(mp4|webm|mov)$/i) !== null || url.includes('/uploads/');
}

export default function CourseSidebar({ course, isPurchased, isFavorited = false, isFree = false }: { course: any, isPurchased: boolean, isFavorited?: boolean, isFree?: boolean }) {
    const router = useRouter();
    const { data: session } = useSession();
    const [loading, setLoading] = useState(false);
    const [isLiked, setIsLiked] = useState(isFavorited);
    const [showVideo, setShowVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    const handleToggleFavorite = async () => {
        if (!session) {
            router.push(`/auth/login?callbackUrl=/courses/${course.id}`);
            return;
        }

        const previousState = isLiked;
        setIsLiked(!previousState); // Optimistic update
        setFavoriteLoading(true);

        try {
            const res = await fetch(`/api/courses/${course.id}/favorite`, {
                method: "POST"
            });

            if (!res.ok) {
                throw new Error("Failed to toggle favorite");
            }

            const data = await res.json();
            setIsLiked(data.isFavorited);
            toast.success(data.isFavorited ? "Ajouté aux favoris" : "Retiré des favoris");
            router.refresh(); // Refresh to update profile page if open
        } catch (error) {
            setIsLiked(previousState); // Revert on error
            toast.error("Erreur lors de la mise à jour des favoris");
        } finally {
            setFavoriteLoading(false);
        }
    };

    // Access code state
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [accessCode, setAccessCode] = useState("");
    const [codeLoading, setCodeLoading] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeSuccess, setCodeSuccess] = useState(false);

    const handleRedeemCode = async () => {
        if (!session) {
            router.push(`/auth/login?callbackUrl=/courses/${course.id}`);
            return;
        }

        if (!accessCode.trim()) {
            setCodeError("Veuillez entrer un code d'accès");
            return;
        }

        setCodeLoading(true);
        setCodeError(null);

        try {
            const res = await fetch("/api/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: accessCode.trim() })
            });

            const data = await res.json();

            if (!res.ok) {
                setCodeError(data.error || "Code invalide");
            } else {
                setCodeSuccess(true);
                // Refresh the page after success to update isPurchased status
                setTimeout(() => {
                    router.refresh();
                }, 1500);
            }
        } catch (err) {
            setCodeError("Erreur de connexion");
        } finally {
            setCodeLoading(false);
        }
    };

    const handleBuy = async () => {
        if (!session) {
            router.push(`/auth/login?callbackUrl=/courses/${course.id}`);
            return;
        }

        setLoading(true);
        setTimeout(() => {
            toast.info("Redirection vers le paiement (Module Shop à implémenter)");
            setLoading(false);
        }, 1000);
    };

    // State for free enrollment
    const [enrollLoading, setEnrollLoading] = useState(false);

    const handleFreeEnroll = async () => {
        if (!session) {
            router.push(`/auth/login?callbackUrl=/courses/${course.id}`);
            return;
        }

        setEnrollLoading(true);

        try {
            const res = await fetch(`/api/courses/${course.id}/enroll`, {
                method: "POST"
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "Erreur lors de l'inscription");
                return;
            }

            toast.success("Inscription réussie !");

            // Redirect to first section
            if (data.firstSectionId) {
                router.push(`/courses/${course.id}/${data.firstSectionId}`);
            } else {
                router.refresh();
            }
        } catch (error) {
            toast.error("Erreur de connexion");
        } finally {
            setEnrollLoading(false);
        }
    };

    const embedUrl = course.welcomeVideo ? getEmbedUrl(course.welcomeVideo) : null;
    const isNativeVideo = course.welcomeVideo ? isDirectVideo(course.welcomeVideo) : false;

    return (
        <div className="sticky top-32 border border-gray-100 bg-white p-8 shadow-2xl shadow-gray-100">


            {/* Price and CTA */}
            <div className="text-center mb-8">
                {isFree ? (
                    <>
                        <p className="text-5xl font-black text-[#2563EB] tracking-tighter">Gratuit</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">Accès à vie · Certificat inclus</p>
                    </>
                ) : (
                    <>
                        <p className="text-5xl font-black text-[#001F3F] tracking-tighter">{parseFloat(course.price).toLocaleString('fr-FR')} Ar</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">Accès à vie · Certificat inclus</p>
                    </>
                )}
            </div>

            {isPurchased ? (
                <Button variant="premium" size="lg" className="w-full mb-4" onClick={() => router.push(`/courses/${course.id}/${course.sections?.[0]?.id || ''}`)}>
                    <Play className="w-4 h-4 fill-current" /> Continuer la formation
                </Button>
            ) : isFree ? (
                <Button variant="premium" size="lg" className="w-full mb-4" onClick={handleFreeEnroll} disabled={enrollLoading}>
                    {enrollLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Inscription...</>
                    ) : (
                        <><Sparkles className="w-4 h-4" /> Commencer gratuitement</>
                    )}
                </Button>
            ) : (
                <>
                    {/* Access Code Section */}
                    <div className="mb-4">
                        <button
                            onClick={() => setShowCodeInput(!showCodeInput)}
                            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#2563EB] transition-colors"
                        >
                            <Ticket className="w-3 h-3" />
                            Utiliser un code d'accès
                            {showCodeInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showCodeInput && (
                            <div className="mt-3 p-4 bg-gray-50 border border-gray-100 space-y-3">
                                {codeSuccess ? (
                                    <div className="flex items-center justify-center gap-2 py-3 text-green-600">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="text-xs font-bold">Accès activé ! Redirection...</span>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            value={accessCode}
                                            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                            placeholder="EVEREST-XXXX-XXXX"
                                            className="w-full h-10 px-3 text-center text-sm font-mono font-bold tracking-wider border border-gray-200 focus:border-[#2563EB] focus:outline-none transition-colors bg-white"
                                            maxLength={17}
                                            disabled={codeLoading}
                                        />
                                        {codeError && (
                                            <p className="text-xs text-red-500 text-center">{codeError}</p>
                                        )}
                                        <button
                                            onClick={handleRedeemCode}
                                            disabled={codeLoading || !accessCode.trim()}
                                            className="w-full h-10 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#001F3F] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {codeLoading ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Validation...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-3 h-3" /> Activer
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="flex gap-2 mb-8">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleToggleFavorite} disabled={favoriteLoading}>
                    <Heart className={`w-3 h-3 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} /> Favoris
                </Button>
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#001F3F]">Ce que vous obtiendrez</p>
                <ul className="space-y-3">
                    {["Accès à vie aux mises à jour", "Communauté d'apprenants", "Support dédié"].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs text-gray-600">
                            <CheckCircle className="w-4 h-4 text-[#2563EB]" />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
