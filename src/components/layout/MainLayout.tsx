import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { MobileDrawer } from "./MobileDrawer"
import { FloatingDock } from "./FloatingDock"

export function MainLayout() {
    const [drawerOpen, setDrawerOpen] = useState(false)

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Mobile Drawer lateral (se abre con las 3 líneas de arriba) */}
            <MobileDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />

            <div className="flex flex-1 flex-col overflow-hidden relative">
                <Header onMenuClick={() => setDrawerOpen(true)} />

                {/* Contenido principal con padding inferior para no solapar el dock flotante en móvil */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 pb-24 md:pb-6 scroll-smooth">
                    <Outlet />
                </main>

                {/* Dock flotante pequeño con los 4 botones principales en móvil */}
                <FloatingDock />
            </div>
        </div>
    )
}
