"use client";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { ScrollHint } from "@/components/ui/scroll-hint";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
            {/* Monté ici plutôt que page par page : une seule instance, un seul comportement. */}
            <ScrollHint />
        </div>
    );
}
