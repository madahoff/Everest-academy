"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    Search,
    Package,
    MoreHorizontal,
    Archive,
    Edit3,
    Layers,
    ArrowUpRight,
    Loader2
} from "lucide-react"
import { ProductFormDialog } from "@/components/dialogs/product-form-dialog"

// --- TYPES ---
interface ProductData {
    id: string
    name: string
    category: string
    price: string | number
    stock: number
    status: "IN_STOCK" | "OUT_OF_STOCK"
    createdAt: string
}

// --- COMPOSANTS UI INTERNES ---

const StockBadge = ({ status, stock }: { status: string, stock: number }) => {
    const isOut = status === "OUT_OF_STOCK" || stock === 0;
    return (
        <div className="flex flex-col gap-1">
            <span className={`text-[9px] font-black uppercase tracking-widest ${isOut ? "text-red-500" : "text-[#2563EB]"}`}>
                {isOut ? "Rupture de stock" : "Disponible"}
            </span>
            <span className="text-[10px] font-mono text-gray-400">QTY: {stock}</span>
        </div>
    );
};

// --- COMPOSANT PRINCIPAL ---

export default function ProductsPage() {
    const queryClient = useQueryClient()

    const { data: products = [], isLoading, error } = useQuery<ProductData[]>({
        queryKey: ["products"],
        queryFn: async () => {
            const res = await fetch("/api/products")
            if (!res.ok) throw new Error("Failed to fetch products")
            return res.json()
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete product")
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] })
        }
    })

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["products"] })
    }

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Êtes-vous sûr de vouloir archiver "${name}" ?`)) {
            deleteMutation.mutate(id)
        }
    }

    const formatPrice = (price: string | number) => {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price
        return `${numPrice.toFixed(2)}  Ar`
    }

    // Calculate stats
    const totalValue = products.reduce((sum, p) => {
        const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price
        return sum + (price * p.stock)
    }, 0)
    const outOfStockCount = products.filter(p => p.status === 'OUT_OF_STOCK').length

    return (
        <div className="flex-1 font-sans text-[#050505]">

            {/* Header : Style "Boutique Inventory" */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16 pb-10 border-b-2 border-[#050505]">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300 mb-3">
                        <Layers className="w-3 h-3" /> Retail & Merchandising
                    </div>
                    <h2 className="text-6xl font-black tracking-tighter uppercase leading-none">
                        Gestion <span className="text-[#2563EB]">Produits</span>
                    </h2>
                </div>
                <ProductFormDialog onSuccess={handleRefresh} />
            </div>

            {/* Barre de Recherche & Filtres */}
            <div className="flex flex-col md:flex-row gap-4 mb-10">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#2563EB] transition-colors" />
                    <input
                        type="text"
                        placeholder="RECHERCHER UN SKU OU NOM..."
                        className="w-full bg-gray-50 border-b border-gray-100 px-12 py-4 text-[10px] font-bold tracking-widest outline-none focus:border-[#050505] transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    {["Tous", "Livres", "Digital", "Merch"].map((cat) => (
                        <button key={cat} className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest border border-gray-100 hover:border-[#050505] transition-all">
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="text-center py-20">
                    <p className="text-red-500 text-sm font-bold">Erreur lors du chargement des produits</p>
                    <button onClick={handleRefresh} className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#2563EB] hover:underline">
                        Réessayer
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && products.length === 0 && (
                <div className="text-center py-20 border border-dashed border-gray-200">
                    <Package className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 text-sm font-bold mb-4">Aucun produit dans l'inventaire</p>
                    <div className="flex justify-center">
                        <ProductFormDialog onSuccess={handleRefresh} />
                    </div>
                </div>
            )}

            {/* Grille de Produits (Tableau Minimaliste) */}
            {!isLoading && !error && products.length > 0 && (
                <div className="border border-gray-100">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest text-gray-400 w-24">Aperçu</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest text-gray-400 text-left">Désignation</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest text-gray-400 text-left">Catégorie</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest text-gray-400 text-left">Statut / Stock</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest text-gray-400 text-left">Prix HT</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Gestion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {products.map((product) => (
                                <tr key={product.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="p-6">
                                        <div className="w-16 h-16 bg-gray-100 flex items-center justify-center border border-gray-200 group-hover:border-[#2563EB] transition-colors overflow-hidden">
                                            <Package className="w-6 h-6 text-gray-300 group-hover:text-[#2563EB] transition-all" />
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-sm font-black uppercase tracking-tighter group-hover:text-[#2563EB] transition-colors cursor-pointer flex items-center gap-2">
                                            {product.name} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                                        </p>
                                        <p className="text-[9px] font-mono text-gray-400 mt-1 uppercase tracking-tighter">SKU: EV-PRD-{product.id.slice(0, 6)}</p>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                            {product.category}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <StockBadge status={product.status} stock={product.stock} />
                                    </td>
                                    <td className="p-6">
                                        <span className="text-sm font-black tracking-tighter italic">{formatPrice(product.price)}</span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            <button className="p-2 bg-white border border-gray-100 hover:border-[#050505] transition-all" title="Modifier">
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id, product.name)}
                                                className="p-2 bg-white border border-gray-100 hover:border-red-100 hover:text-red-500 transition-all"
                                                title="Archiver"
                                            >
                                                <Archive className="w-3.5 h-3.5" />
                                            </button>
                                            <button className="p-2 bg-white border border-gray-100 hover:border-[#050505]" title="Plus">
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="group-hover:hidden text-[9px] font-bold text-gray-200 tracking-widest">
                                            SYSTEM READY
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer / Stats Rapides */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 border-t border-gray-100">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 mb-2">Valeur du Stock</span>
                    <span className="text-2xl font-black tracking-tighter">{totalValue.toFixed(2)}  Ar</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 mb-2">Alertes Rupture</span>
                    <span className={`text-2xl font-black tracking-tighter ${outOfStockCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {outOfStockCount > 0 ? `${String(outOfStockCount).padStart(2, '0')} PRODUIT${outOfStockCount > 1 ? 'S' : ''}` : 'AUCUNE'}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 mb-2">Total SKU</span>
                    <span className="text-2xl font-black tracking-tighter italic underline decoration-[#2563EB]">{products.length}</span>
                </div>
            </div>
        </div>
    );
}