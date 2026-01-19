import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import CoursesList from "@/components/courses-list";

// Force dynamic rendering to avoid database access at build time
export const dynamic = 'force-dynamic';

// --- COMPOSANT PRINCIPAL (Server Component) ---

export default async function CoursesPage() {
    // 1. Fetch Real Data from Server with ratings and enrollment count
    const courses = await prisma.course.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: {
            sections: {
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
    });

    // 2. Transform/Serialize Decimal fields and calculate average rating + enrollment count
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
            averageRating,
            enrollmentCount
        };
    });

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement du catalogue...</div>}>
            <CoursesList initialCourses={serializedCourses} />
        </Suspense>
    );
}
