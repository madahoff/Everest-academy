"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { BookOpen, Star, ArrowRight } from "lucide-react"
import { useAuthModal } from "@/component/auth-modal-provider"

const Badge = ({ children, variant = "default" }: any) => {
    const styles = variant === "premium"
        ? "bg-[#050505] text-white border border-[#050505]"
        : "bg-[#F3F4F6] text-[#001F3F] border border-[#E5E7EB]";
    return (
        <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-none ${styles}`}>
            {children}
        </span>
    );
};

export const StyledCourseCard = ({ course }: any) => {
    const { data: session } = useSession()
    const { openAuth } = useAuthModal()
    const isFree = parseFloat(course.price) === 0;

    const handleClick = (e: React.MouseEvent) => {
        if (!session) {
            e.preventDefault()
            openAuth('login')
        }
    }

    return (
        <Link href={`/courses/${course.id}`} onClick={handleClick}>
            <div className="group relative bg-white border border-gray-200 hover:border-[#001F3F] transition-all duration-500 hover:shadow-2xl flex flex-col h-full rounded-none cursor-pointer">
                <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
                    {course.cardImage ? (
                        <img
                            src={course.cardImage}
                            alt={course.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter grayscale group-hover:grayscale-0"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <BookOpen className="w-12 h-12 text-gray-400" />
                        </div>
                    )}
                    <div className="absolute top-0 left-0 p-4 w-full flex justify-between items-start">
                        <Badge variant={!isFree ? "premium" : "default"}>
                            {isFree ? "Gratuit" : "Premium"}
                        </Badge>
                    </div>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cours Magistral</span>
                        <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#001F3F] text-[#001F3F]" />
                            <span className="text-xs font-bold text-[#001F3F]">4.8</span>
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-[#050505] mb-3 leading-snug group-hover:text-[#2563EB] transition-colors">
                        {course.title}
                    </h3>
                    <p className="text-gray-500 text-sm mb-6 line-clamp-2 font-light leading-relaxed">
                        {course.description}
                    </p>
                    <div className="mt-auto pt-6 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Investissement</span>
                            <span className="text-lg font-bold text-[#001F3F]">
                                {isFree ? "Inclus" : `${parseFloat(course.price).toFixed(2)} Ar`}
                            </span>
                        </div>
                        <button className="text-xs font-bold uppercase tracking-widest text-[#001F3F] hover:text-[#2563EB] transition-colors flex items-center gap-2">
                            Accéder <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </Link>
    );
}
