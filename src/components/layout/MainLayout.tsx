import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { X } from "lucide-react"

export function MainLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                    <div className="relative z-50 w-64 bg-white dark:bg-slate-950">
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="absolute right-4 top-4 text-slate-500"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <Sidebar />
                    </div>
                </div>
            )}

            <div className="flex flex-1 flex-col overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-auto p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
