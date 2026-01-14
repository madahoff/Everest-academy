"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

// Inline UI components to match profile page style strictly
const Button = ({ children, variant = "primary", size = "md", className = "", disabled, ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 rounded-none border flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        outline: "bg-transparent border-gray-200 text-[#001F3F] hover:border-[#001F3F]",
        destructive: "bg-transparent border-red-200 text-red-600 hover:bg-red-600 hover:text-white",
        premium: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#001F3F]"
    };
    const sizes = {
        sm: "px-4 py-2 text-[10px]",
        md: "px-6 py-3 text-xs",
        lg: "px-8 py-4 text-sm"
    };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

const Card = ({ children, className = "" }: any) => (
    <div className={`bg-white border border-gray-100 rounded-none ${className}`}>{children}</div>
);

export default function DeleteAccountSection() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm("ATTENTION : Cette action est irréversible. Êtes-vous sûr de vouloir supprimer votre compte définitivement ?")) {
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/profile/delete", {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Erreur lors de la suppression");
            }

            // Sign out and redirect to home
            await signOut({ callbackUrl: "/" });
        } catch (error) {
            console.error("Delete error:", error);
            alert("Une erreur est survenue lors de la suppression du compte.");
            setIsLoading(false);
        }
    };

    return (
        <Card className="p-8 border-red-100 bg-red-50/30">
            <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Zone Critique</h3>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-6">
                La suppression de votre compte est irréversible.
            </p>
            <Button
                variant="destructive"
                className="w-full"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
            >
                {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    <Trash2 className="w-3 h-3" />
                )}
                {isLoading ? "Suppression..." : "Supprimer le profil"}
            </Button>
        </Card>
    );
}
