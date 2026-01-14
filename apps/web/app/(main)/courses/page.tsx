import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import CoursesList from "@/components/courses-list";

// --- COMPOSANT PRINCIPAL (Server Component) ---

export default async function CoursesPage() {
    // 1. Fetch Real Data from Server
    const courses = await prisma.course.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: {
            sections: { select: { id: true } }
        }
    });

    // 2. Transform/Serialize Decimal fields to plain numbers or strings
    const serializedCourses = courses.map((course: any) => ({
        ...course,
        price: course.price.toString(), // Convert Decimal to string
        createdAt: course.createdAt.toISOString(), // ensure dates are strings (safest for client boundary)
        updatedAt: course.updatedAt.toISOString(),
        sections: course.sections
        // Note: sections are simple objects here {id: string}, so they are fine unless they have decimals.
    }));

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement du catalogue...</div>}>
            <CoursesList initialCourses={serializedCourses} />
        </Suspense>
    );
}
