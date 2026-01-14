import { AdminSidebar } from "@/components/admin-sidebar"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Bell, Search, UserCircle, LogOut } from "lucide-react"
import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect("/auth/login")
    }

    return (
        <SidebarProvider>
            {/* AJOUT: Conteneur Flex pour forcer l'alignement horizontal strict */}
            <div className="flex min-h-screen w-full bg-[#F9FAFB]">

                <AdminSidebar />

                {/* MODIFICATION: flex-1 permet de prendre l'espace restant, w-0 gère les débordements flex */}
                <SidebarInset className="flex-1 w-0 flex flex-col h-full overflow-hidden">

                    {/* Header : "Control Strip" ultra-fin */}
                    <header className="flex sticky top-0 z-[40] bg-white/80 backdrop-blur-md h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-6 transition-all duration-300">

                        <div className="flex items-center gap-4">


                            {/* Fil d'Ariane technique */}
                            <div className="hidden md:flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#050505]">
                                    Everest Terminal
                                </span>
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-tight">
                                    Network Status: Optimal
                                </span>
                            </div>
                        </div>

                        {/* Actions de droite : Profil & Notifs */}
                        <div className="flex items-center gap-6">
                            {/* <div className="hidden sm:flex items-center gap-4 border-r border-gray-100 pr-6">
                                <button className="text-gray-400 hover:text-[#2563EB] transition-colors">
                                    <Search className="w-4 h-4" />
                                </button>
                                <button className="relative text-gray-400 hover:text-[#2563EB] transition-colors">
                                    <Bell className="w-4 h-4" />
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#2563EB] rounded-full"></span>
                                </button>
                            </div> */}

                            <div className="flex items-center gap-3 group cursor-pointer relative">
                                <form
                                    action={async () => {
                                        "use server"
                                        await signOut({ redirectTo: "/auth/login" })
                                    }}
                                >
                                    <button type="submit" className="flex items-center gap-3 hover:opacity-80 transition-opacity" title="Se déconnecter">
                                        <div className="text-right hidden lg:block">
                                            <p className="text-[10px] font-black uppercase tracking-tighter leading-none">Admin Root</p>
                                            <p className="text-[8px] font-bold text-[#2563EB] uppercase tracking-widest mt-1">{session.user?.name || "User"}</p>
                                        </div>
                                        <div className="w-9 h-9 bg-[#050505] flex items-center justify-center group-hover:bg-red-500 transition-colors">
                                            <LogOut className="w-4 h-4 text-white" />
                                        </div>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-y-auto bg-[#F9FAFB]">
                        {/* Conteneur pour le padding et la structure interne */}
                        <div className="p-6 lg:p-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                            {children}
                        </div>
                    </main>

                    {/* Footer Discret Admin */}
                    <footer className="px-10 py-4 border-t border-gray-100 flex justify-between items-center bg-white/50 shrink-0">
                        <p className="text-[8px] font-bold text-gray-300 uppercase tracking-[0.3em]">
                            © 2026 EverestIntelligence Unit
                        </p>
                        <div className="flex gap-4">
                            <span className="text-[8px] font-bold text-[#2563EB] uppercase tracking-widest">
                                Server: EU-West-1
                            </span>
                        </div>
                    </footer>
                </SidebarInset>
            </div>
        </SidebarProvider>
    )
}