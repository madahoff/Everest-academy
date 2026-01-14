"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";

interface SectionRatingProps {
    sectionId: string;
    courseId: string;
}

export function SectionRating({ sectionId, courseId }: SectionRatingProps) {
    const [userRating, setUserRating] = useState<number>(0);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [averageRating, setAverageRating] = useState<number>(0);
    const [totalRatings, setTotalRatings] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch current rating on mount
    useEffect(() => {
        fetchRating();
    }, [sectionId]);

    const fetchRating = async () => {
        try {
            const res = await fetch(`/api/sections/${sectionId}/rating`);
            if (res.ok) {
                const data = await res.json();
                setUserRating(data.userRating || 0);
                setAverageRating(data.averageRating || 0);
                setTotalRatings(data.totalRatings || 0);
                setHasRated(!!data.userRating);
            }
        } catch (err) {
            console.error("Failed to fetch rating:", err);
        }
    };

    const submitRating = async (rating: number) => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`/api/sections/${sectionId}/rating`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur lors de la soumission");
            }

            const data = await res.json();
            setUserRating(rating);
            setAverageRating(data.averageRating);
            setTotalRatings(data.totalRatings);
            setHasRated(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayRating = hoverRating || userRating;

    return (
        <div className="bg-white border border-gray-100 p-6 mt-8">
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4 text-center">
                Notez cette section
            </h3>

            {/* Star Rating UI */}
            <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        onClick={() => submitRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        disabled={isSubmitting}
                        className={`p-1 transition-all transform hover:scale-110 ${isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                            }`}
                    >
                        <Star
                            className={`w-8 h-8 transition-colors ${star <= displayRating
                                    ? "fill-[#2563EB] text-[#2563EB]"
                                    : "text-gray-300 hover:text-[#2563EB]/50"
                                }`}
                        />
                    </button>
                ))}
            </div>

            {/* Feedback */}
            {hasRated && (
                <p className="text-center text-sm text-green-600 font-medium mb-2">
                    Merci pour votre note !
                </p>
            )}

            {error && (
                <p className="text-center text-sm text-red-500 mb-2">
                    {error}
                </p>
            )}

            {/* Average Rating Display */}
            {totalRatings > 0 && (
                <div className="text-center text-xs text-gray-400 mt-4 pt-4 border-t border-gray-50">
                    <span className="font-bold text-[#050505]">{averageRating.toFixed(1)}</span>
                    <span> / 5</span>
                    <span className="mx-2">·</span>
                    <span>{totalRatings} avis</span>
                </div>
            )}
        </div>
    );
}
