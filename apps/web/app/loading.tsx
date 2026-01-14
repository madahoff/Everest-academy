"use client";

import Image from "next/image";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#001F3F] border-t-transparent rounded-full animate-spin"></div>
                </div>

                <div className="text-center space-y-2">
                    <Image
                        src="/logo-white.png"
                        alt="Everest Academy"
                        width={150}
                        height={50}
                        className="h-12 w-auto object-contain"
                    />
                    <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold animate-pulse">
                        Chargement de l'expérience...
                    </p>
                </div>
            </div>

            <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
                style={{
                    backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}>
            </div>
        </div>
    );
}
