"use client";

import Link from "next/link";
import Image from "next/image";
import {
    Facebook,
    Twitter,
    Instagram,
    Linkedin,
    Youtube,
    Mail,
    Phone,
    MapPin,
    ArrowRight,
    GraduationCap,
    BookOpen,
    Award,
    Users
} from "lucide-react";

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    const quickLinks = [
        { name: "Accueil", href: "/" },
        { name: "Catalogue", href: "/courses" },
        { name: "Événements", href: "/events" },
        { name: "Boutique", href: "/shop" },
    ];

    const resources = [
        { name: "Guide d'apprentissage", href: "#" },
        { name: "FAQ", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Support", href: "#" },
    ];

    const legal = [
        { name: "Conditions générales", href: "#" },
        { name: "Politique de confidentialité", href: "#" },
        { name: "Mentions légales", href: "#" },
    ];

    const socialLinks = [
        { name: "Facebook", icon: Facebook, href: "#" },
        { name: "Twitter", icon: Twitter, href: "#" },
        { name: "Instagram", icon: Instagram, href: "#" },
        { name: "LinkedIn", icon: Linkedin, href: "#" },
        { name: "YouTube", icon: Youtube, href: "#" },
    ];

    const stats = [
        { icon: GraduationCap, value: "10K+", label: "Étudiants" },
        { icon: BookOpen, value: "200+", label: "Formations" },
        { icon: Award, value: "50+", label: "Certifications" },
        { icon: Users, value: "30+", label: "Experts" },
    ];

    return (
        <footer className="relative bg-[#050505] text-white overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-96 h-96 bg-[#2563EB]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#001F3F]/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            </div>



            {/* Main Footer Content */}
            <div className="relative max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">

                    {/* Brand Section */}
                    <div className="lg:col-span-4 space-y-6">
                        <Link href="/" className="group inline-flex items-center gap-3">
                            <Image
                                src="/logo-white.png"
                                alt="Everest Academy"
                                width={180}
                                height={60}
                                className="h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                        </Link>

                        <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                            Plateforme d'élite pour l'excellence académique. Rejoignez une communauté
                            de passionnés et développez vos compétences avec nos formations de qualité.
                        </p>

                        {/* Newsletter */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-300">
                                Newsletter
                            </h4>
                            <div className="flex">
                                <input
                                    type="email"
                                    placeholder="Votre email"
                                    className="flex-1 bg-gray-900/50 border border-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#2563EB] transition-colors"
                                />
                                <button className="bg-[#2563EB] hover:bg-[#001F3F] px-5 py-3 transition-colors duration-300">
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="lg:col-span-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-300 mb-6">
                            Navigation
                        </h4>
                        <ul className="space-y-4">
                            {quickLinks.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="group flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <span className="w-0 group-hover:w-4 h-[1px] bg-[#2563EB] transition-all duration-300"></span>
                                        <span className="text-sm">{link.name}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="lg:col-span-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-300 mb-6">
                            Ressources
                        </h4>
                        <ul className="space-y-4">
                            {resources.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="group flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <span className="w-0 group-hover:w-4 h-[1px] bg-[#2563EB] transition-all duration-300"></span>
                                        <span className="text-sm">{link.name}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="lg:col-span-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-300 mb-6">
                            Contact
                        </h4>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-gray-900 border border-gray-800 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-4 h-4 text-[#2563EB]" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Antananarivo, Madagascar</p>
                                    <p className="text-xs text-gray-600">Analakely</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-gray-900 border border-gray-800 flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-4 h-4 text-[#2563EB]" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">contact@everest-academy.mg</p>
                                    <p className="text-xs text-gray-600">Support 24/7</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-gray-900 border border-gray-800 flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-4 h-4 text-[#2563EB]" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">+261 34 00 000 00</p>
                                    <p className="text-xs text-gray-600">Lun - Ven, 9h - 18h</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="relative border-t border-gray-800/50">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">

                        {/* Copyright */}
                        <div className="text-center lg:text-left">
                            <p className="text-xs text-gray-500">
                                © {currentYear} <span className="text-[#2563EB] font-bold">Everest Academy</span>.
                                Tous droits réservés.
                            </p>
                        </div>

                        {/* Legal Links */}
                        <div className="flex flex-wrap items-center justify-center gap-6">
                            {legal.map((link, index) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-3">
                            {socialLinks.map((social) => (
                                <Link
                                    key={social.name}
                                    href={social.href}
                                    className="w-10 h-10 bg-gray-900 border border-gray-800 flex items-center justify-center hover:bg-[#2563EB] hover:border-[#2563EB] transition-all duration-300 group"
                                    aria-label={social.name}
                                >
                                    <social.icon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Animated Bottom Line */}
            <div className="h-1 bg-gradient-to-r from-[#001F3F] via-[#2563EB] to-[#001F3F] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
        </footer>
    );
};
