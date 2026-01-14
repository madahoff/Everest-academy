"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, Video, CheckCircle, Clock } from "lucide-react"

interface Section {
    id: string
    title: string
    description: string
    video: string | null
    duration: string | null
}

interface CourseNavigationProps {
    courseId: string
    currentSectionId: string
    sections: Section[]
}

export function CourseNavigation({ courseId, currentSectionId, sections }: CourseNavigationProps) {
    // State to track expanded sections. By default, all are expanded or just the current one?
    // User asked: "par défaut déroullé" (expanded by default)
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {}
        sections.forEach(s => initial[s.id] = true)
        return initial
    })

    const toggleSection = (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
    }

    // Scroll spy logic could go here to auto-highlight, but since this is a sidebar navigation for a specific page (which loads one section at a time),
    // the "active" state is determined by the URL (currentSectionId). 
    // If the user meant a single page with ALL sections, that's different.
    // Based on the file structure `[pathId]/page.tsx`, it seems to be one page per section.
    // So "scroll tracking" might mean tracking position within the CURRENT section's content? 
    // Or maybe the side bar IS the navigation for the whole course and they want to see progress?

    // The user said: "que quand on scrolle ça va avancer suivant le rôle"
    // This usually implies a single-page view where scrolling updates the active link. 
    // BUT the current architecture is multi-page (one route per section). 
    // I will implement the collapsible sidebar first. 
    // For single-page scroll tracking in a multi-page app, it doesn't apply unless we load all content.
    // However, maybe they mean scrolling INSIDE the sidebar? Or maybe the sidebar should sticky properly.

    // Let's implement the sticky sidebar with collapsible details as requested.

    return (
        <div className="bg-white border border-gray-100 sticky top-42 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#050505]">
                    Structure du cours
                </h3>
            </div>

            <div className="max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                {sections.map((section, index) => {
                    const isActive = section.id === currentSectionId
                    const isExpanded = expandedSections[section.id]

                    return (
                        <div key={section.id} className={`border-b border-gray-50 last:border-none group ${isActive ? 'bg-[#F9FAFB]' : ''}`}>
                            <div
                                className={`
                                    flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-gray-50
                                    ${isActive ? 'border-l-4 border-[#2563EB]' : 'border-l-4 border-transparent'}
                                `}
                            >
                                <div className="pt-1">
                                    <span className={`text-[10px] font-bold block ${isActive ? 'text-[#2563EB]' : 'text-gray-300'}`}>
                                        {(index + 1).toString().padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <Link href={`/courses/${courseId}/${section.id}`} className="block flex-1">
                                            <h4 className={`text-xs font-bold leading-relaxed ${isActive ? 'text-[#050505]' : 'text-gray-500 group-hover:text-[#050505]'}`}>
                                                {section.title}
                                            </h4>
                                        </Link>
                                        <button
                                            onClick={(e) => toggleSection(section.id, e)}
                                            className="text-gray-400 hover:text-[#2563EB] transition-colors p-1"
                                        >
                                            <ChevronDown
                                                className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </button>
                                    </div>

                                    <div
                                        className={`
                                            grid transition-all duration-300 ease-in-out
                                            ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}
                                        `}
                                    >
                                        <div className="overflow-hidden">
                                            {/* Détails déroulants */}
                                            <div className="space-y-3">
                                                {section.description && (
                                                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed line-clamp-2">
                                                        {section.description.substring(0, 80)}...
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-3">
                                                    {section.video && (
                                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-[9px] font-bold uppercase tracking-wider text-gray-500">
                                                            <Video className="w-3 h-3" />
                                                            <span>Vidéo</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
                                                        <Clock className="w-3 h-3" />
                                                        <span>15 min</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
