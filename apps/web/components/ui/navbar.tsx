"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/component/cart-provider";
import { useAuthModal } from "@/component/auth-modal-provider";
import {
    User,
    ShoppingCart,
    Menu,
    X,
    ArrowRight,
} from "lucide-react";

export const Navbar = () => {
    const { data: session } = useSession();
    const { cart } = useCart();
    const { openAuth } = useAuthModal();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    const pathname = usePathname();
    const user = session?.user;

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navigation = [
        { name: "Accueil", href: "/" },
        { name: "Catalogue", href: "/courses" },
        { name: "Événements", href: "/events" },
        { name: "Boutique", href: "/shop" },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 border-b ${scrolled ? "bg-white/95 backdrop-blur-md h-20 border-gray-200 shadow-sm" : "bg-white h-24 border-transparent"
                }`}
        >
            <div className="max-w-[1600px] h-full mx-auto px-6 lg:px-12 flex justify-between items-center">

                <Link href="/" className="group flex items-center">
                    <Image
                        src="/logo-black.png"
                        alt="Everest Academy"
                        width={160}
                        height={50}
                        className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                </Link>

                <div className="hidden lg:flex items-center gap-10">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`group relative text-[10px] font-bold uppercase tracking-[0.25em] py-2 transition-colors ${isActive(item.href) ? "text-[#001F3F]" : "text-gray-400 hover:text-[#050505]"
                                }`}
                        >
                            {item.name}
                            <span className={`absolute bottom-0 left-0 h-[2px] bg-[#2563EB] transition-all duration-300 ${isActive(item.href) ? "w-full" : "w-0 group-hover:w-full"
                                }`}></span>
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-4 lg:gap-8">
                    <Link href="/cart" className="relative p-2 group">
                        <ShoppingCart className="w-5 h-5 text-[#050505] transition-transform group-hover:-translate-y-1" />
                        {cart.length > 0 && (
                            <span className="absolute top-0 right-0 bg-[#001F3F] text-white text-[7px] font-bold w-4 h-4 flex items-center justify-center rounded-none">
                                {cart.length}
                            </span>
                        )}
                    </Link>

                    <div className="hidden lg:block h-8 w-[1px] bg-gray-100"></div>

                    {user ? (
                        <div className="hidden lg:flex items-center gap-6">
                            <Link href="/profile" className="flex items-center gap-4 group">
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#050505]">{user.name}</p>
                                    <p className="text-[8px] font-bold text-[#2563EB] uppercase tracking-widest">{user.role}</p>
                                </div>
                                <div className="w-10 h-10 bg-[#F9FAFB] border border-gray-100 flex items-center justify-center group-hover:border-[#001F3F] transition-colors">
                                    <User className="w-4 h-4 text-[#001F3F]" />
                                </div>
                            </Link>
                            <button
                                onClick={() => signOut()}
                                className="text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-red-600 transition-colors"
                            >
                                Déconnexion
                            </button>
                        </div>
                    ) : (
                        <div className="hidden lg:flex items-center gap-6">
                            <button
                                onClick={() => openAuth('login')}
                                className="text-[10px] font-bold uppercase tracking-widest text-[#050505] hover:opacity-70"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => openAuth('signup')}
                                className="bg-[#001F3F] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-6 py-3 hover:bg-[#2563EB] transition-all flex items-center gap-3"
                            >
                                Join Now <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <button
                        className="lg:hidden w-10 h-10 flex items-center justify-center border border-gray-100"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className={`fixed inset-0 bg-[#050505] z-[110] transition-all duration-500 lg:hidden ${isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}>
                <div className="p-6 flex justify-between items-center border-b border-gray-900">
                    <Image src="/logo-white.png" alt="Everest" width={120} height={40} className="h-10 w-auto" />
                    <button onClick={() => setIsMenuOpen(false)} className="text-white p-2">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                <div className="flex flex-col justify-center h-full px-12 space-y-10">
                    {navigation.map((item, idx) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="text-5xl font-black text-white uppercase tracking-tighter hover:text-[#2563EB] transition-colors"
                            style={{ transitionDelay: `${idx * 50}ms` }}
                        >
                            {item.name}
                        </Link>
                    ))}

                    <div className="pt-10 border-t border-gray-900 flex flex-col gap-6">
                        {!user && (
                            <button
                                onClick={() => { setIsMenuOpen(false); openAuth('signup'); }}
                                className="text-[#2563EB] text-xl font-bold uppercase tracking-widest text-left"
                            >
                                Create Account →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};
