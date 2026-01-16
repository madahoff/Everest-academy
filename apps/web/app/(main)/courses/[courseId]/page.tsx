import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Force dynamic rendering to avoid database access at build time
export const dynamic = 'force-dynamic';
import {
    Star,
    Users,
    Clock,
    ChevronRight,
    Play
} from "lucide-react";
import CourseTabs from "@/components/course-tabs";
import CourseSidebar from "@/components/course-sidebar";

export default async function CourseDetail({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = await params
    const session = await getServerSession(authOptions);

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            sections: {
                orderBy: { order: 'asc' },
                include: {
                    questions: { select: { id: true } },
                    // @ts-ignore
                    ratings: { select: { rating: true } }
                }
            }
        }
    });

    if (!course) {
        notFound();
    }

    let totalRatings = 0;
    let sumRatings = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (course as any).sections.forEach((section: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        section.ratings?.forEach((r: any) => {
            sumRatings += r.rating;
            totalRatings++;
        });
    });

    const averageRating = totalRatings > 0 ? (sumRatings / totalRatings).toFixed(1) : "N/A";

    const serializedCourse = {
        ...course,
        price: course.price.toString(),
        createdAt: course.createdAt.toISOString(),
        updatedAt: course.updatedAt.toISOString(),
        sections: (course as any).sections.map((section: any) => ({
            ...section,
            createdAt: section.createdAt.toISOString(),
            updatedAt: section.updatedAt.toISOString(),
        }))
    };

    let isPurchased = false;
    let isFavorited = false;

    if (session?.user?.id) {
        const purchase = await prisma.purchase.findFirst({
            where: {
                userId: session.user.id,
                courseId: courseId
            }
        });
        if (purchase) isPurchased = true;

        const favorite = await prisma.favorite.findUnique({
            where: {
                userId_courseId: {
                    userId: session.user.id,
                    courseId: courseId
                }
            }
        });
        if (favorite) isFavorited = true;

        if (session.user.role === 'ADMIN') isPurchased = true;
    }

    return (
        <div className="min-h-screen bg-white font-sans text-[#050505] selection:bg-[#001F3F] selection:text-white">

            <div className="relative h-[70vh] flex items-center justify-center overflow-hidden bg-[#050505]">
                {course.heroImage && (
                    <>
                        <img
                            src={course.heroImage}
                            alt={course.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-50"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-[#001F3F]/80 via-[#001F3F]/60 to-[#050505]" />
                    </>
                )}

                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-[0.3em] border border-white/20">
                            Formation Premium
                        </span>
                        <span className="px-4 py-2 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-[0.3em]">
                            Niveau Intermédiaire
                        </span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black text-white uppercase tracking-tighter mb-8 leading-[0.85] drop-shadow-2xl">
                        {course.title}
                    </h1>

                    <p className="text-xl md:text-2xl text-white/90 font-light max-w-3xl mx-auto mb-12 leading-relaxed">
                        {course.description.slice(0, 150)}...
                    </p>

                    <div className="flex items-center justify-center gap-8 mb-12">
                        <div className="flex items-center gap-2">
                            <Star className="w-6 h-6 fill-[#2563EB] text-[#2563EB]" />
                            <span className="text-2xl font-bold text-white">{averageRating}</span>
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div className="flex items-center gap-3 text-white/80">
                            <Users className="w-5 h-5" />
                            <span className="text-lg font-bold">{course.salesCount} Inscrits</span>
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div className="flex items-center gap-3 text-white/80">
                            <Clock className="w-5 h-5" />
                            <span className="text-lg font-bold">{course.duration}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6">
                        {isPurchased ? (
                            <Link href={`/courses/${courseId}/${course.sections?.[0]?.id || ''}`} className="px-12 py-5 bg-[#2563EB] text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-[#050505] transition-all border-2 border-[#2563EB] flex items-center gap-3">
                                <Play className="w-5 h-5" /> Continuer la formation
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="#inscription"
                                    className="px-12 py-5 bg-white text-[#050505] text-sm font-bold uppercase tracking-[0.2em] hover:bg-[#2563EB] hover:text-white transition-all border-2 border-white"
                                >
                                    S'inscrire maintenant
                                </Link>
                                <Link
                                    href="#details"
                                    className="px-12 py-5 bg-transparent text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all border-2 border-white/30"
                                >
                                    En savoir plus
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-[1400px] mx-auto px-6 py-16" id="details">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    <div className="lg:col-span-8">
                        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-12">
                            <Link href="/courses" className="hover:text-[#2563EB]">Formations</Link>
                            <ChevronRight className="w-3 h-3" />
                            <span className="text-[#050505]">{course.title}</span>
                        </nav>

                        <CourseTabs course={serializedCourse} isPurchased={isPurchased} />
                    </div>

                    <div className="lg:col-span-4" id="inscription">
                        <CourseSidebar course={serializedCourse} isPurchased={isPurchased} isFavorited={isFavorited} isFree={parseFloat(course.price.toString()) === 0} />
                    </div>
                </div>
            </main>
        </div>
    );
}
