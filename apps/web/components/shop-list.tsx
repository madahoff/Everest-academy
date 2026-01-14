// "use client";

// import { useState } from "react";
// import {
//     Search,
//     Plus,
//     Minus,
//     Package,
//     Check,
//     Star,
//     ArrowRight
// } from "lucide-react";
// import { useCart } from "@/component/cart-provider";

// // --- COMPOSANTS UI INTERNES ---

// const Button = ({ children, variant = "primary", size = "md", className = "", disabled, ...props }: any) => {
//     const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 ease-out flex items-center justify-center gap-2 rounded-none border disabled:opacity-50 disabled:cursor-not-allowed";
//     const variants = {
//         primary: "bg-[#001F3F] text-white border-[#001F3F] hover:bg-white hover:text-[#001F3F]",
//         outline: "bg-transparent border-[#001F3F] text-[#001F3F] hover:bg-[#001F3F] hover:text-white",
//         ghost: "bg-transparent border-transparent text-gray-500 hover:text-[#001F3F]",
//         destructive: "bg-red-600 text-white border-red-600 hover:bg-white hover:text-red-600"
//     };
//     const sizes = { sm: "px-4 py-2 text-[10px]", md: "px-6 py-3 text-xs", lg: "px-8 py-4 text-sm" };
//     return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} disabled={disabled} {...props}>{children}</button>;
// };

// const Badge = ({ children, variant = "default", className = "" }: any) => {
//     const styles = variant === "destructive" ? "bg-red-600 text-white" : variant === "secondary" ? "bg-[#2563EB] text-white" : "bg-[#050505] text-white";
//     return <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-none ${styles} ${className}`}>{children}</span>;
// };

// // --- CARTE PRODUIT ---
// const StyledProductCard = ({ product, onAddToCart }: any) => {
//     return (
//         <div className="group relative bg-white border border-gray-100 flex flex-col h-full rounded-none transition-all duration-500 hover:border-[#001F3F] hover:shadow-xl">
//             <div className="relative aspect-square overflow-hidden bg-[#F3F4F6]">
//                 <div className="w-full h-full flex items-center justify-center bg-gray-50 group-hover:bg-white transition-colors duration-700">
//                     {product.image ? (
//                         <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
//                     ) : (
//                         <div className="text-9xl font-bold text-[#F3F4F6] group-hover:text-gray-100 transition-colors select-none">
//                             {product.name.charAt(0)}
//                         </div>
//                     )}
//                 </div>
//                 <div className="absolute top-0 left-0 p-4 w-full flex justify-between items-start z-10">
//                     {product.badge && <Badge variant={product.badge === "Promotion" ? "destructive" : "secondary"}>{product.badge}</Badge>}
//                 </div>
//                 {!product.inStock && (
//                     <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-20 flex items-center justify-center">
//                         <div className="border-2 border-[#050505] px-4 py-2 text-[#050505] font-bold uppercase tracking-widest text-xs transform -rotate-12">Rupture de Stock</div>
//                     </div>
//                 )}
//             </div>

//             <div className="p-6 flex flex-col flex-grow bg-white z-10">
//                 <div className="flex justify-between items-start mb-2">
//                     <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{product.category}</span>
//                     <div className="flex items-center gap-1">
//                         <Star className="w-3 h-3 fill-[#001F3F] text-[#001F3F]" />
//                         <span className="text-xs font-bold text-[#001F3F]">4.8</span>
//                     </div>
//                 </div>
//                 <h3 className="text-lg font-bold text-[#050505] mb-2 leading-tight group-hover:text-[#2563EB] transition-colors">{product.name}</h3>
//                 <p className="text-gray-500 text-xs mb-6 line-clamp-2 font-light leading-relaxed">{product.description}</p>

//                 <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
//                     <span className="text-xl font-bold text-[#001F3F]">{product.price.toFixed(2)} Ar</span>
//                     <Button size="sm" variant="outline" disabled={!product.inStock} onClick={() => onAddToCart(product)} className="hover:bg-[#001F3F] hover:text-white group-hover:border-[#001F3F]">
//                         <Plus className="w-4 h-4" />
//                     </Button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// // --- CLIENT COMPONENT ---
// export default function ShopList({ initialItems }: { initialItems: any[] }) {
//     const { cart, addToCart } = useCart();
//     const [items, setItems] = useState(initialItems);
//     const [filteredItems, setFilteredItems] = useState(initialItems);
//     const [searchTerm, setSearchTerm] = useState("");
//     const [selectedCategory, setSelectedCategory] = useState("all");
//     const [isCartOpen, setIsCartOpen] = useState(false);
//     const [notification, setNotification] = useState<string | null>(null);

//     const categories = [
//         { value: "all", label: "Tout Voir" },
//         { value: "course", label: "Formations" },
//         { value: "product", label: "Merch" }
//     ];

//     const handleSearch = (term: string) => {
//         setSearchTerm(term);
//         filterItems(term, selectedCategory);
//     };

//     const handleCategoryChange = (category: string) => {
//         setSelectedCategory(category);
//         filterItems(searchTerm, category);
//     };

//     const filterItems = (search: string, category: string) => {
//         let filtered = items;
//         if (search) {
//             filtered = filtered.filter(item =>
//                 item.name.toLowerCase().includes(search.toLowerCase()) ||
//                 item.description.toLowerCase().includes(search.toLowerCase())
//             );
//         }
//         if (category !== "all") {
//             filtered = filtered.filter(item => item.type === category); // Adjust logic if course category is complex
//         }
//         setFilteredItems(filtered);
//     };

//     const handleAddToCart = (item: any) => {
//         addToCart({
//             id: item.id,
//             title: item.name,
//             price: item.price,
//             image: item.image,
//             type: item.type as 'course' | 'product'
//         })
//         setNotification(`${item.name} ajouté au panier`);
//         setTimeout(() => setNotification(null), 3000);
//         setIsCartOpen(true);
//     };

//     return (
//         <div className="min-h-screen bg-[#F9FAFB] text-[#050505] font-sans selection:bg-[#001F3F] selection:text-white relative">
//             {notification && (
//                 <div className="fixed bottom-8 right-8 z-50 bg-[#001F3F] text-white px-6 py-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in">
//                     <Check className="w-5 h-5 text-[#2563EB]" />
//                     <span className="text-sm font-medium tracking-wide">{notification}</span>
//                 </div>
//             )}

//             {/* Hero Section */}
//             <div className="bg-[#050505] text-white py-20 px-6 lg:px-12 border-b border-gray-800">
//                 <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-end gap-12">
//                     <div>
//                         <span className="text-[#2563EB] text-xs font-bold uppercase tracking-[0.3em] mb-4 block">Boutique Officielle</span>
//                         <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-none mb-6">OUTILS POUR <br />BATISSEURS.</h1>
//                     </div>
//                 </div>
//             </div>

//             <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12">
//                 {/* Filters */}
//                 <div className="sticky top-20 z-30 bg-[#F9FAFB]/95 backdrop-blur-sm py-6 mb-12 border-b border-gray-200">
//                     <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
//                         <div className="flex flex-wrap gap-8">
//                             {categories.map((cat) => (
//                                 <button
//                                     key={cat.value}
//                                     onClick={() => handleCategoryChange(cat.value)}
//                                     className={`text-xs font-bold uppercase tracking-widest pb-1 transition-all ${selectedCategory === cat.value ? "text-[#001F3F] border-b-2 border-[#001F3F]" : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"}`}
//                                 >
//                                     {cat.label}
//                                 </button>
//                             ))}
//                         </div>
//                         <div className="relative w-full lg:w-80 group">
//                             <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#001F3F] transition-colors" />
//                             <input placeholder="RECHERCHER..." value={searchTerm} onChange={(e) => handleSearch(e.target.value)} className="w-full bg-transparent border-b border-gray-300 py-2 pl-8 pr-4 text-sm font-medium focus:outline-none focus:border-[#001F3F] transition-colors rounded-none placeholder:text-gray-300 placeholder:text-xs placeholder:tracking-widest" />
//                         </div>
//                     </div>
//                 </div>

//                 {/* Grid */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
//                     {filteredItems.map((item) => (
//                         <StyledProductCard key={item.id} product={item} onAddToCart={handleAddToCart} />
//                     ))}
//                 </div>
//             </div>

//             {/* Mini Cart Sidebar Overlay */}
//             {isCartOpen && (
//                 <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 border-l border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out font-sans">
//                     <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#050505] text-white">
//                         <span className="text-sm font-bold uppercase tracking-widest">Votre Panier ({cart.length})</span>
//                         <button onClick={() => setIsCartOpen(false)} className="hover:text-gray-300"><Minus className="w-5 h-5" /></button>
//                     </div>
//                     <div className="flex-grow overflow-y-auto p-6 space-y-6">
//                         {cart.length === 0 ? (
//                             <div className="text-center text-gray-400 mt-10 font-light text-sm">Votre panier est vide.</div>
//                         ) : (
//                             cart.map((item, idx) => (
//                                 <div key={idx} className="flex gap-4 items-center border-b border-gray-50 pb-4">
//                                     <div className="w-12 h-12 bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs">
//                                         {item.title.charAt(0)}
//                                     </div>
//                                     <div>
//                                         <div className="text-xs font-bold text-[#050505] uppercase line-clamp-1">{item.title}</div>
//                                         <div className="text-xs text-gray-500">{parseFloat(item.price).toFixed(2)} Ar</div>
//                                     </div>
//                                 </div>
//                             ))
//                         )}
//                     </div>
//                     <div className="p-6 border-t border-gray-100 bg-gray-50 from-gray-50 to-white">
//                         <div className="flex justify-between items-center mb-4 text-lg font-bold text-[#001F3F]">
//                             <span>Total</span>
//                             <span>{cart.reduce((acc, item) => acc + parseFloat(item.price), 0).toFixed(2)} Ar</span>
//                         </div>
//                         <Button className="w-full py-4 bg-[#2563EB] border-[#2563EB] hover:bg-[#001F3F]">Procéder au paiement</Button>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// }

"use client";

import { useState } from "react";
import {
    ArrowRight,
    Hammer,
    Construction,
    Check,
    Loader2
} from "lucide-react";

// --- RÉUTILISATION DU STYLE DES BOUTONS (Même Design System) ---
const Button = ({ children, variant = "primary", size = "md", className = "", disabled, ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 ease-out flex items-center justify-center gap-2 rounded-none border disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-[#2563EB] text-white border-[#2563EB] hover:bg-white hover:text-[#2563EB]", // Accent Blue pour le CTA principal ici
        outline: "bg-transparent border-gray-700 text-white hover:bg-white hover:text-[#050505]",
        ghost: "bg-transparent border-transparent text-gray-500 hover:text-white"
    };
    const sizes = { sm: "px-4 py-2 text-[10px]", md: "px-6 py-3 text-xs", lg: "px-8 py-4 text-sm" };
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

export default function ComingSoon() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");
        // Simulation d'appel API
        setTimeout(() => {
            setStatus("success");
            setEmail("");
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#2563EB] selection:text-white flex flex-col relative overflow-hidden">

            {/* Background Grids/Decoration */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>

            {/* Top Bar */}
            <div className="relative z-10 w-full p-6 lg:p-12 flex justify-between items-center border-b border-gray-900">
                <div className="flex items-center gap-2 text-[#2563EB]">
                    <Construction className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-[0.3em]">Zone en Travaux</span>
                </div>
                <div className="hidden md:block text-xs font-bold uppercase tracking-widest text-gray-600">
                    Est. 2026
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 flex-grow flex flex-col justify-center items-center px-6 lg:px-12 text-center">

                {/* Icon principal */}
                <div className="mb-8 p-6 border border-gray-800 bg-gray-900/50 backdrop-blur-sm rotate-3 hover:rotate-0 transition-transform duration-500">
                    <Hammer className="w-12 h-12 text-white" />
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6">
                    NOUS FORGEONS <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">L'AVENIR.</span>
                </h1>

                <p className="max-w-xl text-gray-400 text-sm md:text-base leading-relaxed mb-12 font-light">
                    Cette page est actuellement en cours de construction. Nous assemblons les meilleurs outils pour bâtisseurs. Soyez le premier averti lors du lancement.
                </p>

                {/* Newsletter Form */}
                <div className="w-full max-w-md">
                    {status === "success" ? (
                        <div className="p-4 border border-[#2563EB] bg-[#2563EB]/10 flex items-center justify-center gap-3 animate-in fade-in zoom-in">
                            <Check className="w-5 h-5 text-[#2563EB]" />
                            <span className="text-sm font-bold uppercase tracking-widest text-[#2563EB]">Inscription validée</span>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="relative group w-full">
                                <input
                                    type="email"
                                    placeholder="VOTRE ADRESSE EMAIL"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-transparent border-b border-gray-700 py-4 px-2 text-sm font-bold text-white focus:outline-none focus:border-[#2563EB] transition-colors rounded-none placeholder:text-gray-600 placeholder:text-xs placeholder:tracking-[0.2em] text-center md:text-left"
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full md:w-auto"
                                disabled={status === "loading"}
                            >
                                {status === "loading" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        ME PRÉVENIR <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                {/* Technical details / Progress bar decoration */}
                <div className="mt-16 w-full max-w-xs">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                        <span>Progression</span>
                        <span>85%</span>
                    </div>
                    <div className="h-1 w-full bg-gray-900 rounded-none overflow-hidden">
                        <div className="h-full bg-[#2563EB] w-[85%] relative">
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite] skew-x-12 translate-x-[-100%]"></div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 p-6 lg:p-12 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                    © 2026 Builders Inc. Tous droits réservés.
                </p>
                <div className="flex gap-6">
                    {["Twitter", "Instagram", "LinkedIn"].map((social) => (
                        <a key={social} href="#" className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                            {social}
                        </a>
                    ))}
                </div>
            </footer>
        </div>
    );
}
