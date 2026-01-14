"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BookOpen,
    LayoutDashboard,
    Package,
    Settings,
    Users,
    Command,
    ChevronRight,
    LogOut
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"

const menuItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, code: "DB-01" },
    { title: "Catalogue Cours", url: "/courses", icon: BookOpen, code: "ED-02" },
    { title: "Inventaire Store", url: "/products", icon: Package, code: "SH-03" },
    { title: "Base Utilisateurs", url: "/users", icon: Users, code: "US-04" },
]

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname()

    return (
        <Sidebar
            variant="sidebar"
            collapsible="icon"
            className="bg-[#0A0A0A] border-r border-white/5 text-white h-screen sticky top-0"
            {...props}
        >
            {/* Header : Identité Console */}
            <SidebarHeader className="p-6">
                <div className="flex items-center gap-3">
                    <div className="flex aspect-square size-9 items-center justify-center bg-[#2563EB] text-white rounded-none transition-transform group-hover:scale-110">
                        <Command className="size-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-tighter leading-none italic">
                            EVEREST<span className="text-[#2563EB]">ADMIN</span>
                        </span>
                        <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.3em] mt-1">
                            v2.0.4 core
                        </span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-3">
                <SidebarGroup>
                    {/* Label technique */}
                    <div className="px-3 mb-4">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Main Terminal</p>
                    </div>

                    <SidebarGroupContent>
                        <SidebarMenu className="gap-2">
                            {menuItems.map((item) => {
                                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={active}
                                            className={`
                                                relative h-12 rounded-none transition-all duration-300
                                                ${active
                                                    ? "bg-white/5 text-[#2563EB] border-l-2 border-[#2563EB]"
                                                    : "text-white/50 hover:bg-white/5 hover:text-white"
                                                }
                                            `}
                                        >
                                            <Link href={item.url} className="flex items-center w-full px-3">
                                                <item.icon className={`size-4 mr-3 ${active ? "text-[#2563EB]" : ""}`} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest flex-1">
                                                    {item.title}
                                                </span>
                                                {active && <ChevronRight className="size-3 animate-pulse" />}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer : Utilitaires */}
            <SidebarFooter className="p-4 border-t border-white/5">
                <SidebarMenu>
                    <SidebarMenuItem className="mb-2">
                        <SidebarMenuButton asChild className="text-white/40 hover:text-white rounded-none">
                            <Link href="/settings" className="flex items-center px-3">
                                <Settings className="size-4 mr-3" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Configuration</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton
                            className="text-red-500/50 hover:text-red-500 hover:bg-red-500/5 rounded-none transition-colors"
                            onClick={() => console.log("System Logout")}
                        >
                            <div className="flex items-center px-3">
                                <LogOut className="size-4 mr-3" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Disconnect</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                {/* Status Indicator */}
                <div className="mt-4 px-3 flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Encrypted Session</span>
                </div>
            </SidebarFooter>

            <SidebarRail className="hover:after:bg-[#2563EB]/20" />
        </Sidebar>
    )
}