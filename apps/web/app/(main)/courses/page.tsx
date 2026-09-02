import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth.config";
import { getCourseAccess, getPremiumOffer } from "@/lib/premium";
import CoursesList from "@/components/courses-list";

// Force dynamic rendering to avoid database access at build time
export const dynamic = 'force-dynamic';

// --- COMPOSANT PRINCIPAL (Server Component) ---

export default async function CoursesPage() {
    const session = await getServerSession(authOptions);

    // 1. Fetch Real Data from Server with ratings and enrollment count
    const [courses, access, premiumOffer] = await Promise.all([
        prisma.course.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            include: {
                sections: {
                    // Ordonnées : la première section est celle où reprendre la formation.
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        ratings: { select: { rating: true } }
                    }
                },
                accessCodes: {
                    where: { used: true },
                    select: { id: true }
                },
                purchases: {
                    select: { id: true }
                }
            }
        }),
        getCourseAccess(session?.user?.id),
        getPremiumOffer(),
    ]);

    // 2. Transform/Serialize Decimal fields and calculate average rating + enrollment count
    const ownedIds = new Set(access.ownedCourseIds);

    const serializedCourses = courses.map((course: any) => {
        // Calculate average rating from all section ratings
        const allRatings = course.sections.flatMap((s: any) => s.ratings.map((r: any) => r.rating));
        const averageRating = allRatings.length > 0
            ? (allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length).toFixed(1)
            : null;

        // Count enrollments (used access codes + direct purchases)
        const enrollmentCount = (course.accessCodes?.length || 0) + (course.purchases?.length || 0);

        return {
            ...course,
            price: course.price.toString(),
            createdAt: course.createdAt.toISOString(),
            updatedAt: course.updatedAt.toISOString(),
            sections: course.sections.map((s: any) => ({ id: s.id })),
            sectionCount: course.sections.length,
            // Où reprendre : évite un aller-retour par la fiche du cours quand l'accès est acquis.
            firstSectionId: course.sections[0]?.id ?? null,
            averageRating,
            enrollmentCount,
            // Accès déjà acquis : achat unitaire, code d'accès, inscription gratuite… ou Pack Premium.
            hasAccess: access.isPremium || access.isAdmin || ownedIds.has(course.id),
            // …et par quel titre, pour le dire clairement sur la carte.
            accessSource: ownedIds.has(course.id)
                ? "owned"
                : access.isPremium
                    ? "premium"
                    : access.isAdmin
                        ? "admin"
                        : null,
        };
    });

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement du catalogue...</div>}>
            <CoursesList
                initialCourses={serializedCourses}
                isPremium={access.isPremium}
                premiumOffer={premiumOffer}
            />
        </Suspense>
    );
}
