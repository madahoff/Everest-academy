"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Video, CheckCircle, Lock, Play, Clock, BookOpen, FileText, X, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";

// Helper to convert video URLs to embeddable format
function getEmbedUrl(url: string): string | null {
    if (!url) return null;

    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&mute=0&rel=0`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }

    // Direct video file
    if (url.match(/\.(mp4|webm|mov)$/i) || url.includes('/uploads/')) {
        return url;
    }

    return null;
}

function isDirectVideo(url: string): boolean {
    return url.match(/\.(mp4|webm|mov)$/i) !== null || url.includes('/uploads/');
}

export default function CourseTabs({ course, isPurchased }: { course: any, isPurchased: boolean }) {
    const [activeTab, setActiveTab] = useState("curriculum");
    const [expandedSections, setExpandedSections] = useState<string[]>([course.sections?.[0]?.id]);
    const [currentVideo, setCurrentVideo] = useState<{ title: string; url: string; sectionId: string } | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const playVideo = (section: any) => {
        if (section.video && isPurchased) {
            setCurrentVideo({
                title: section.title,
                url: section.video,
                sectionId: section.id
            });
        }
    };

    const embedUrl = currentVideo ? getEmbedUrl(currentVideo.url) : null;
    const isNativeVideo = currentVideo?.url ? isDirectVideo(currentVideo.url) : false;

    // Calculate total duration (mock for now)
    const totalSections = course.sections?.length || 0;
    const totalQuestions = course.sections?.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0) || 0;

    return (
        <div className="space-y-8">
            {/* Large Video Player Area - Coursera Style */}
            <div className="aspect-video bg-[#0a0a0a] relative overflow-hidden  shadow-2xl">
                {currentVideo && embedUrl ? (
                    // Active Video Player
                    <div className="absolute inset-0">
                        {isNativeVideo ? (
                            <video
                                src={embedUrl}
                                autoPlay
                                controls
                                muted={isMuted}
                                playsInline
                                preload="auto"
                                className="w-full h-full object-contain bg-black"
                            />
                        ) : (
                            <iframe
                                src={embedUrl}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                            />
                        )}

                        {/* Video Info Bar */}
                        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-white/60 uppercase tracking-widest mb-1">En lecture</p>
                                    <h3 className="text-white font-bold">{currentVideo.title}</h3>
                                </div>
                                <button
                                    onClick={() => setCurrentVideo(null)}
                                    className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : course.welcomeVideo ? (
                    // Welcome Video Preview
                    <>
                        {course.heroImage && (
                            <img
                                src={course.heroImage}
                                alt={course.title}
                                className="absolute inset-0 w-full h-full object-cover opacity-40"
                            />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <button
                                onClick={() => setCurrentVideo({
                                    title: "Présentation du cours",
                                    url: course.welcomeVideo,
                                    sectionId: "intro"
                                })}
                                className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-2xl group mb-6"
                            >
                                <Play className="w-8 h-8 text-[#001F3F] fill-[#001F3F] ml-1 group-hover:text-[#2563EB] group-hover:fill-[#2563EB] transition-colors" />
                            </button>
                            <p className="text-white/80 text-sm font-medium">Regarder la présentation</p>
                            <p className="text-white/50 text-xs mt-1">Découvrez ce que vous allez apprendre</p>
                        </div>
                    </>
                ) : (
                    // No Video Placeholder
                    <div className="absolute inset-0 flex items-center justify-center">
                        {course.heroImage ? (
                            <img
                                src={course.heroImage}
                                alt={course.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-center">
                                <Video className="w-16 h-16 text-white/20 mx-auto mb-4" />
                                <p className="text-white/40 text-sm">Sélectionnez une leçon pour commencer</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Course Stats Bar */}
            <div className="flex items-center gap-8 py-4 border-y border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <BookOpen className="w-4 h-4 text-[#2563EB]" />
                    <span><strong className="text-[#050505]">{totalSections}</strong> modules</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FileText className="w-4 h-4 text-[#2563EB]" />
                    <span><strong className="text-[#050505]">{totalQuestions}</strong> questions</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4 text-[#2563EB]" />
                    <span><strong className="text-[#050505]">{course.duration || "Variable"}</strong></span>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-8 border-b border-gray-100">
                {['curriculum', 'overview'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-4 text-sm font-semibold transition-all relative ${activeTab === tab
                            ? 'text-[#050505]'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {tab === 'curriculum' ? 'Contenu du cours' : 'À propos'}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2563EB]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'curriculum' && (
                    <div className="space-y-3">
                        {course.sections.map((section: any, i: number) => {
                            const isExpanded = expandedSections.includes(section.id);
                            const isCurrentlyPlaying = currentVideo?.sectionId === section.id;

                            return (
                                <div
                                    key={section.id}
                                    className={`border  overflow-hidden transition-all ${isCurrentlyPlaying
                                        ? 'border-[#2563EB] bg-blue-50/30'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            {section.cardImage ? (
                                                <div className="w-12 h-12 rounded-sm overflow-hidden shrink-0 border border-gray-100">
                                                    <img src={section.cardImage} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            ) : (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrentlyPlaying
                                                    ? 'bg-[#2563EB] text-white'
                                                    : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {i + 1}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-semibold text-[#050505]">{section.title}</h3>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {section.video && "1 vidéo"}
                                                    {section.video && section.questions?.length > 0 && " · "}
                                                    {section.questions?.length > 0 && `${section.questions.length} questions`}
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Section Content */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-gray-100">
                                            {section.description && (
                                                <p className="text-sm text-gray-500 py-3 border-b border-gray-50">
                                                    {section.description}
                                                </p>
                                            )}

                                            {/* Video Lesson */}
                                            {section.video && (
                                                <div
                                                    className={`flex items-center justify-between py-3 px-3 -mx-3  cursor-pointer transition-colors ${isCurrentlyPlaying
                                                        ? 'bg-[#2563EB]/10'
                                                        : 'hover:bg-gray-50'
                                                        }`}
                                                    onClick={() => playVideo(section)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10  flex items-center justify-center ${isCurrentlyPlaying
                                                            ? 'bg-[#2563EB]'
                                                            : 'bg-gray-100'
                                                            }`}>
                                                            {isCurrentlyPlaying ? (
                                                                <div className="flex gap-0.5">
                                                                    <div className="w-1 h-4 bg-white animate-pulse" />
                                                                    <div className="w-1 h-4 bg-white animate-pulse delay-75" />
                                                                    <div className="w-1 h-4 bg-white animate-pulse delay-150" />
                                                                </div>
                                                            ) : (
                                                                <Play className={`w-4 h-4 ${isPurchased ? 'text-[#001F3F]' : 'text-gray-400'}`} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-medium ${isCurrentlyPlaying ? 'text-[#2563EB]' : 'text-[#050505]'}`}>
                                                                Leçon vidéo
                                                            </p>
                                                            <p className="text-xs text-gray-400">Vidéo de cours</p>
                                                        </div>
                                                    </div>

                                                    {isPurchased ? (
                                                        isCurrentlyPlaying ? (
                                                            <span className="text-xs font-semibold text-[#2563EB] uppercase">En cours</span>
                                                        ) : (
                                                            <span className="text-xs font-medium text-gray-400 hover:text-[#2563EB]">Lire</span>
                                                        )
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-gray-300">
                                                            <Lock className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quiz */}
                                            {section.questions?.length > 0 && (
                                                <div className="flex items-center justify-between py-3 px-3 -mx-3  hover:bg-gray-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10  bg-green-50 flex items-center justify-center">
                                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-[#050505]">Quiz d'évaluation</p>
                                                            <p className="text-xs text-gray-400">{section.questions.length} questions</p>
                                                        </div>
                                                    </div>
                                                    {isPurchased ? (
                                                        <Link
                                                            href={`/courses/${course.id}/${section.id}`}
                                                            className="text-xs font-medium text-gray-400 hover:text-[#2563EB]"
                                                        >
                                                            Commencer
                                                        </Link>
                                                    ) : (
                                                        <Lock className="w-4 h-4 text-gray-300" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {course.sections.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Aucun contenu disponible pour le moment.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'overview' && (
                    <div className="prose prose-gray max-w-none">
                        <h3 className="text-lg font-bold text-[#050505] mb-4">À propos de ce cours</h3>
                        <p className="text-gray-600 leading-relaxed">{course.description}</p>

                        <h4 className="text-sm font-bold text-[#050505] mt-8 mb-4">Ce que vous apprendrez</h4>
                        <ul className="space-y-2">
                            {course.sections.slice(0, 5).map((section: any) => (
                                <li key={section.id} className="flex items-start gap-2 text-gray-600">
                                    <CheckCircle className="w-4 h-4 text-[#2563EB] mt-0.5 flex-shrink-0" />
                                    {section.title}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
