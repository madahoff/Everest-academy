"use client"

import { Video } from "lucide-react"

interface VideoPlayerProps {
    src: string | null
    title?: string
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
    if (!src) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                <Video className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Contenu vidéo indisponible</p>
            </div>
        )
    }

    const formatVideoUrl = (url: string) => {
        if (url.includes('youtube.com/watch?v=')) {
            return url.replace('watch?v=', 'embed/')
        }
        if (url.includes('youtu.be/')) {
            return url.replace('youtu.be/', 'youtube.com/embed/')
        }
        return url
    }

    const isNativeVideo = src.match(/\.(mp4|webm|mov)$/i) || src.includes('/uploads/')

    if (isNativeVideo) {
        return (
            <video
                src={src}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                playsInline
                preload="auto"
                className="w-full h-full object-contain bg-black"
            />
        )
    }

    return (
        <iframe
            src={formatVideoUrl(src)}
            title={title || "Video"}
            className="w-full h-full grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
            allowFullScreen
        />
    )
}
