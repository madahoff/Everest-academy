import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
    ArrowLeft,
    Clock,
    Video,
    ChevronRight,
} from "lucide-react";
import { QuizSection } from "@/components/quiz-section";
import { SectionRating } from "@/components/section-rating";
import { CourseNavigation } from "@/components/course-navigation";

// --- COMPOSANT PRINCIPAL (Server Component) ---

export default async function SectionPage({ params }: { params: Promise<{ courseId: string, pathId: string }> }) {
    const { courseId, pathId } = await params;

    // 1. Fetch Section Data with Questions
    const section = await prisma.section.findUnique({
        where: { id: pathId },
        include: {
            questions: {
                orderBy: { order: 'asc' },
                include: {
                    answers: {
                        orderBy: { order: 'asc' }
                    }
                }
            },
            course: {
                include: {
                    sections: {
                        orderBy: { order: 'asc' },
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            video: true,
                            duration: true
                        }
                    }
                }
            }
        }
    });

    if (!section || section.courseId !== courseId) {
        notFound();
    }

    // Navigation logic
    const currentIndex = section.course.sections.findIndex((s: { id: string }) => s.id === section.id);
    const prevSection = section.course.sections[currentIndex - 1];
    const nextSection = section.course.sections[currentIndex + 1];

    // Video URL Formatting (Simple helper for Youtube/Vimeo)
    const formatVideoUrl = (url: string) => {
        if (url.includes('youtube.com/watch?v=')) {
            return url.replace('watch?v=', 'embed/');
        }
        if (url.includes('youtu.be/')) {
            return url.replace('youtu.be/', 'youtube.com/embed/');
        }
        return url;
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F] selection:text-white">

            {/* Header Minimalist */}
            <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-20 z-50 transition-all duration-300 shadow-sm">
                <Link
                    href={`/courses/${courseId}`}
                    className="group flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#001F3F] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au cursus
                </Link>
                <div className="text-sm font-bold tracking-tighter uppercase italic text-[#001F3F]">
                    {section.course.title}
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Colonne Gauche : Vidéo et Contenu */}
                    <div className="lg:col-span-8">
                        <header className="mb-10">
                            <div className="flex items-center gap-4 mb-4">
                                <span className="px-3 py-1 bg-[#050505] text-white text-[9px] font-bold uppercase tracking-[0.2em]">LEÇON {currentIndex + 1}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> {section.duration || "15 min"} ESTIMÉ
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6 leading-[0.9] text-[#050505]">
                                {section.title}
                            </h1>
                        </header>

                        {/* Lecteur Vidéo */}
                        <div className="relative bg-[#050505] aspect-video mb-12 group overflow-hidden border-0 shadow-2xl rounded-none">
                            {section.video ? (
                                <iframe
                                    src={formatVideoUrl(section.video)}
                                    title={section.title}
                                    className="w-full h-full grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                                    <Video className="w-12 h-12 mb-4 opacity-50" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Contenu vidéo indisponible</p>
                                </div>
                            )}
                        </div>

                        {/* Description / Summary */}
                        <div className="bg-white p-12 border border-blue-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#2563EB]"></div>
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[#001F3F] mb-10 flex items-center gap-4">
                                Objectifs & Contenu <span className="h-[2px] w-12 bg-[#2563EB]"></span>
                            </h2>
                            <div
                                className="
                                    rich-text text-gray-600 font-normal leading-relaxed
                                "
                                dangerouslySetInnerHTML={{ __html: section.summary || section.description || "Aucune description disponible." }}
                            />
                        </div>

                        {/* QCM Section */}
                        {section.questions && section.questions.length > 0 && (
                            <div className="mt-12">
                                <QuizSection questions={section.questions} />
                            </div>
                        )}

                        {/* Section Rating */}
                        <div className="mt-12">
                            <SectionRating sectionId={section.id} courseId={courseId} />
                        </div>

                        {/* Navigation entre sections footer */}
                        <div className="flex justify-between items-center mt-12 pt-12 border-t border-gray-200">
                            {prevSection ? (
                                <Link href={`/courses/${courseId}/${prevSection.id}`} className="group p-4 border border-transparent hover:border-gray-100 transition-all">
                                    <span className="text-[9px] font-bold uppercase text-gray-300 block mb-2">Leçon Précédente</span>
                                    <span className="flex items-center gap-3 text-sm font-bold group-hover:text-[#2563EB] transition-colors">
                                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> {prevSection.title}
                                    </span>
                                </Link>
                            ) : <div />}

                            {nextSection ? (
                                <Link href={`/courses/${courseId}/${nextSection.id}`} className="group text-right p-4 border border-transparent hover:border-gray-100 transition-all">
                                    <span className="text-[9px] font-bold uppercase text-gray-300 block mb-2">Leçon Suivante</span>
                                    <span className="flex items-center gap-3 text-sm font-bold group-hover:text-[#2563EB] transition-colors">
                                        {nextSection.title} <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </Link>
                            ) : <div />}
                        </div>
                    </div>

                    {/* Colonne Droite : Syllabus Rapide (Client Component) */}
                    <div className="lg:col-span-4 space-y-12">
                        <CourseNavigation
                            courseId={courseId}
                            currentSectionId={section.id}
                            sections={section.course.sections}
                        />
                    </div>

                </div>
            </main>

            {/* Footer Navigation & Ressources */}
            <footer className="bg-white border-t border-gray-100 mt-20">
                <div className="max-w-[1400px] mx-auto px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                        {/* Navigation Progression */}
                        <div className="col-span-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">Votre Progression</h4>
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-4xl font-black text-[#001F3F]">{Math.round(((currentIndex + 1) / section.course.sections.length) * 100)}%</span>
                                <span className="text-xs font-bold text-gray-400 pb-2 uppercase tracking-wider">Complété</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-[#2563EB] h-full transition-all duration-1000 ease-out"
                                    style={{ width: `${((currentIndex + 1) / section.course.sections.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
