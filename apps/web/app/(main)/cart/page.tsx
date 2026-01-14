"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/component/cart-provider";
import { useAuthModal } from "@/component/auth-modal-provider";
import {
    ShoppingCart,
    Minus,
    Plus,
    Trash2,
    ArrowLeft,
    CreditCard,
    Truck,
    ShieldCheck,
    ChevronRight,
    Loader2
} from "lucide-react";

// --- HELPERS ---
const groupCartItems = (items: any[]) => {
    const grouped: any = {};
    items.forEach(item => {
        if (grouped[item.id]) {
            grouped[item.id].quantity += 1;
        } else {
            grouped[item.id] = { ...item, quantity: 1 };
        }
    });
    return Object.values(grouped);
};

// --- COMPOSANTS UI INTERNES ---
const Button = ({ children, variant = "primary", size = "md", className = "", ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 rounded-none border flex items-center justify-center gap-2 disabled:opacity-30";
    const variants = {
        primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
        outline: "bg-transparent border-gray-200 text-[#001F3F] hover:border-[#001F3F]",
        ghost: "bg-transparent border-transparent text-gray-500 hover:text-[#001F3F]",
        checkout: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-[#001F3F]"
    };
    const sizes = {
        sm: "px-3 py-1.5 text-[10px]",
        md: "px-6 py-3 text-xs",
        lg: "px-8 py-4 text-sm"
    };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>{children}</button>;
};

const Card = ({ children, className = "" }: any) => (
    <div className={`bg-white border border-gray-100 rounded-none ${className}`}>{children}</div>
);

// --- COMPOSANT PRINCIPAL ---

export default function Cart() {
    const router = useRouter();
    const { data: session } = useSession();
    const { cart, removeFromCart, addToCart, clearCart, isLoading } = useCart();
    const { openAuth } = useAuthModal();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");

    const cartItems = useMemo(() => groupCartItems(cart), [cart]);
    const subtotal = cart.reduce((sum, item) => sum + Number(item.price), 0);
    const shipping = 0; // Digital goods mostly
    const total = subtotal + shipping;

    const handleCheckout = async () => {
        if (!session) {
            openAuth('login');
            return;
        }

        setIsCheckingOut(true);
        setCheckoutError("");

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === "INSUFFICIENT_FUNDS") {
                    // Redirect to Wallet Topup or show error
                    throw new Error("Solde insuffisant. Veuillez recharger votre portefeuille.");
                }
                throw new Error(data.error || "Erreur lors du paiement");
            }

            // Success
            clearCart();
            router.push('/profile?tab=courses'); // Redirect to generic profile, maybe add success param

        } catch (error: any) {
            setCheckoutError(error.message);
        } finally {
            setIsCheckingOut(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
    }

    if (cart.length === 0) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-gray-100 flex items-center justify-center mb-8">
                    <ShoppingCart className="w-8 h-8 text-gray-300" />
                </div>
                <h1 className="text-2xl font-bold uppercase tracking-tighter mb-4">Votre panier est vide</h1>
                <p className="text-gray-400 font-light mb-8 max-w-xs">Explorez notre collection et sélectionnez vos outils d'excellence.</p>
                <Button onClick={() => router.push('/shop')}>Retour au store</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F]">
            <main className="max-w-[1400px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

                    {/* Liste des articles (8 colonnes) */}
                    <div className="lg:col-span-8">
                        <h2 className="text-xs font-bold uppercase tracking-[0.3em] mb-10 text-gray-400">Articles sélectionnés</h2>

                        <div className="space-y-0 border-t border-gray-100">
                            {cartItems.map((item: any) => (
                                <div key={item.id} className="py-8 border-b border-gray-100 flex flex-col md:flex-row gap-8 items-center group">
                                    {/* Image Placeholder */}
                                    <div className="w-24 h-24 bg-gray-50 flex-shrink-0 flex items-center justify-center text-gray-200 overflow-hidden">
                                        {item.image ? (
                                            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="font-bold text-3xl">{item.title?.charAt(0)}</span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-sm uppercase tracking-wide group-hover:text-[#2563EB] transition-colors">{item.title}</h3>
                                        <p className="text-xs text-gray-400 font-light mt-1 uppercase tracking-tight">{item.type === 'course' ? 'Module de Formation' : 'Produit Physique'}</p>
                                        <div className="mt-4 flex items-center gap-6">
                                            <button onClick={() => removeFromCart(item.id)} className="text-[10px] font-bold uppercase text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                                                <Trash2 className="w-3 h-3" /> Retirer
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quantity (Disabled for courses usually, but handled here) */}
                                    <div className="flex items-center border border-gray-100">
                                        <span className="px-4 py-2 text-xs font-bold">x{item.quantity}</span>
                                    </div>

                                    {/* Price */}
                                    <div className="w-24 text-right">
                                        <span className="text-sm font-bold tracking-tight">{(Number(item.price) * item.quantity).toFixed(2)} Ar</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sommaire & Checkout (4 colonnes) */}
                    <div className="lg:col-span-4 space-y-8">
                        <Card className="p-8 bg-[#050505] text-white">
                            <h2 className="text-xs font-bold uppercase tracking-[0.3em] mb-8 text-gray-500">Récapitulatif</h2>

                            <div className="space-y-4 mb-10">
                                <div className="flex justify-between text-xs font-light">
                                    <span className="text-gray-500">Sous-total</span>
                                    <span className="font-medium">{subtotal.toFixed(2)} Ar</span>
                                </div>
                                <div className="flex justify-between text-xs font-light">
                                    <span className="text-gray-500">Frais</span>
                                    <span className="font-medium">Offerts</span>
                                </div>
                                <div className="pt-4 border-t border-gray-800 flex justify-between items-baseline">
                                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total</span>
                                    <span className="text-3xl font-bold tracking-tighter">{total.toFixed(2)} Ar</span>
                                </div>
                            </div>

                            {checkoutError && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest text-center">
                                    {checkoutError}
                                    {checkoutError.includes("Solde") && (
                                        <button
                                            onClick={() => router.push('/wallet')}
                                            className="block mt-2 underline hover:text-white mx-auto"
                                        >
                                            Recharger le portefeuille
                                        </button>
                                    )}
                                </div>
                            )}

                            <Button
                                variant="checkout"
                                className="w-full py-5 text-sm"
                                onClick={handleCheckout}
                                disabled={isCheckingOut}
                            >
                                {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Payer avec mon Solde</>}
                            </Button>

                            <div className="mt-6 flex flex-col gap-3">
                                <div className="flex items-center gap-3 text-[9px] text-gray-500 uppercase tracking-widest">
                                    <ShieldCheck className="w-3 h-3 text-[#2563EB]" /> Paiement sécurisé par Everest Wallet
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
