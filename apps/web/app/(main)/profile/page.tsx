import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import {
    User,
    Crown,
    Mail,
    Calendar,
    BookOpen,
    Award,
    Star,
    Trash2,
    Settings,
    CreditCard,
    AlertTriangle,
    CheckCircle,
    ChevronRight,
    Wallet
} from "lucide-react"
import DeleteAccountSection from "@/components/delete-account-section"

// --- COMPOSANTS UI INTERNES ---

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }: any) => {
    const baseStyle = "font-bold uppercase tracking-widest transition-all duration-300 rounded-none border flex items-center justify-center gap-2";
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
    return <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>{children}</button>;
};

const Card = ({ children, className = "" }: any) => (
    <div className={`bg-white border border-gray-100 rounded-none ${className}`}>{children}</div>
);

const Badge = ({ children, variant = "default" }: any) => {
    const styles = variant === "premium" ? "bg-[#2563EB] text-white" : "bg-gray-100 text-gray-600";
    return <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-tighter rounded-none ${styles}`}>{children}</span>;
};

// --- COMPOSANT PRINCIPAL (Server Component) ---

export default async function Profile() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        redirect("/auth/login?callbackUrl=/profile")
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            purchases: {
                include: { course: true },
                orderBy: { createdAt: 'desc' }
            },
            favorites: {
                include: { course: true },
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!dbUser) {
        redirect("/auth/login")
    }

    // Calcul des stats
    const totalCourses = dbUser.purchases.filter((p: any) => p.courseId).length
    const walletBalance = parseFloat(dbUser.walletBalance?.toString() || "0").toFixed(2)
    const joinDate = new Date(dbUser.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    const stats = [
        { label: "Cours acquis", value: totalCourses, icon: BookOpen, color: "text-[#001F3F]" },

        { label: "Certifications", value: 0, icon: Award, color: "text-[#2563EB]" },
        { label: "Temps d'étude", value: `0h`, icon: Star, color: "text-amber-500" }
    ];

    return (
        <div className="min-h-screen bg-[#F9FAFB] font-sans selection:bg-[#001F3F] selection:text-white">

            <main className="max-w-[1400px] mx-auto px-6 py-30">

                {/* Header Profil : Style "Command Center" */}
                <div className="bg-[#050505] text-white p-12 mb-12 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-full bg-[#2563EB] opacity-10 transform skew-x-12 translate-x-20"></div>

                    <div className="relative">
                        <div className="w-32 h-32 border-2 border-[#2563EB] p-1">
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                {dbUser.image ? (
                                    <img src={dbUser.image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-12 h-12 text-gray-500" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left z-10">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                            <h1 className="text-4xl font-bold tracking-tight uppercase">{dbUser.name}</h1>
                            <Badge variant={dbUser.role === 'ADMIN' ? 'premium' : 'default'}>
                                {dbUser.role}
                            </Badge>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-6 text-xs font-medium text-gray-400 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#2563EB]" /> {dbUser.email}</span>
                            <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#2563EB]" /> Membre depuis {joinDate}</span>
                        </div>
                    </div>

                    {/* <div className="z-10">
                        <Button variant="premium" size="lg">
                            <CreditCard className="w-4 h-4" /> Recharger Wallet
                        </Button>
                    </div> */}
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* Colonne Gauche : Activité et Cours */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* Stats Rapides */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.map((stat, i) => (
                                <Card key={i} className="p-6 border-b-2 border-b-gray-100 hover:border-b-[#2563EB] transition-all">
                                    <stat.icon className={`w-5 h-5 ${stat.color} mb-4`} />
                                    <div className="text-lg font-bold text-[#050505] truncate">{stat.value}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</div>
                                </Card>
                            ))}
                        </div>

                        {/* Liste des Cours (Style Académique) */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-[0.3em] mb-8 flex items-center gap-4">
                                Mes Cours Disponibles <span className="h-[1px] flex-1 bg-gray-100"></span>
                            </h2>

                            <div className="space-y-4">
                                {dbUser.purchases.length === 0 ? (
                                    <div className="text-center py-10 bg-white border border-gray-100">
                                        <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-4" />
                                        <p className="text-xs text-gray-400 font-bold uppercase">Aucun cours disponible</p>
                                    </div>
                                ) : (
                                    dbUser.purchases.map((purchase: any) => (
                                        purchase.course && (
                                            <div key={purchase.id} className="group bg-white border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-[#001F3F] transition-all">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-gray-50 flex-shrink-0 relative overflow-hidden">
                                                        {purchase.course.cardImage ? (
                                                            <img src={purchase.course.cardImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-200"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-[#050505] uppercase text-sm mb-1 group-hover:text-[#2563EB]">
                                                            {purchase.course.title}
                                                        </h3>
                                                        <p className="text-xs text-gray-400">Acheté le {new Date(purchase.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="w-full md:w-auto">
                                                    <a href={`/courses/${purchase.course.id}`} className="block">
                                                        <Button variant="outline" size="sm">Accéder au cours</Button>
                                                    </a>
                                                </div>
                                            </div>
                                        )
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Liste des Favoris */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-[0.3em] mb-8 flex items-center gap-4">
                                Mes Favoris <span className="h-[1px] flex-1 bg-gray-100"></span>
                            </h2>

                            <div className="space-y-4">
                                {dbUser.favorites.length === 0 ? (
                                    <div className="text-center py-10 bg-white border border-gray-100">
                                        <Star className="w-10 h-10 mx-auto text-gray-300 mb-4" />
                                        <p className="text-xs text-gray-400 font-bold uppercase">Aucun favori pour le moment</p>
                                    </div>
                                ) : (
                                    dbUser.favorites.map((favorite: any) => (
                                        favorite.course && (
                                            <div key={favorite.id} className="group bg-white border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-[#2563EB] transition-all">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-gray-50 flex-shrink-0 relative overflow-hidden">
                                                        {favorite.course.cardImage ? (
                                                            <img src={favorite.course.cardImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-200"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-[#050505] uppercase text-sm mb-1 group-hover:text-[#2563EB]">
                                                            {favorite.course.title}
                                                        </h3>
                                                        <p className="text-xs text-gray-400">Ajouté le {new Date(favorite.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="w-full md:w-auto">
                                                    <a href={`/courses/${favorite.course.id}`} className="block">
                                                        <Button variant="outline" size="sm">Voir le cours</Button>
                                                    </a>
                                                </div>
                                            </div>
                                        )
                                    ))
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Colonne Droite : Sidebar Paramètres */}
                    <div className="space-y-8">
                        {/* <Card className="p-8">
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-8 border-b border-gray-100 pb-4">Gestion du compte</h3>

                            <div className="space-y-2">
                                <button className="w-full flex items-center justify-between p-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-50 hover:text-[#001F3F] transition-all border-b border-gray-50">
                                    <span className="flex items-center gap-3"><User className="w-4 h-4" /> Profil Public</span>
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                                <button className="w-full flex items-center justify-between p-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-50 hover:text-[#001F3F] transition-all border-b border-gray-50">
                                    <span className="flex items-center gap-3"><CreditCard className="w-4 h-4" /> Facturation</span>
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                                <button className="w-full flex items-center justify-between p-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-50 hover:text-[#001F3F] transition-all border-b border-gray-50">
                                    <span className="flex items-center gap-3"><Settings className="w-4 h-4" /> Sécurité</span>
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </Card> */}

                        <DeleteAccountSection />
                    </div>

                </div>
            </main>

            {/* Footer Institutionnel */}
            <footer className="bg-white border-t border-gray-100 py-12 mt-20">
                <div className="max-w-[1400px] mx-auto px-6 text-center">
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.5em]">&copy; 2026 EverestArchitecture & Académie</p>
                </div>
            </footer>
        </div>
    );
}
