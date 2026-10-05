import { useAuth } from "@/contexts/AuthContext"
import { LogOut, User, Menu } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { PushNotificationToggle } from "@/components/notifications/PushNotificationToggle"

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
    const { profile, signOut } = useAuth()

    return (
        <header className="flex items-center justify-between border-b bg-white px-3 sm:px-6 dark:bg-slate-950 dark:border-slate-800 flex-nowrap gap-2 pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))]">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <button
                    onClick={onMenuClick}
                    className="text-slate-500 hover:text-slate-700 md:hidden dark:text-slate-400 dark:hover:text-slate-200 shrink-0"
                >
                    <Menu className="h-6 w-6" />
                </button>
                <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate dark:text-white">
                    Hola, {profile?.full_name?.split(" ")[0] || "Usuario"}
                </h2>
            </div>

            <div className="flex items-center gap-1 sm:gap-3 shrink-0 flex-nowrap">
                <PushNotificationToggle compact />
                <ThemeToggle />

                <div 
                    onClick={onMenuClick}
                    className="flex items-center gap-2 text-sm sm:border-l sm:pl-3 sm:ml-1 dark:border-slate-800 cursor-pointer sm:cursor-default"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-900/60">
                        {profile?.full_name ? profile.full_name[0].toUpperCase() : <User className="h-4 w-4" />}
                    </div>
                    <div className="hidden md:block">
                        <p className="font-medium text-xs text-slate-800 dark:text-slate-200">{profile?.full_name}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{profile?.role === 'admin' ? 'Administrador' : 'Empleado'}</p>
                    </div>
                </div>

                <button
                    onClick={signOut}
                    className="hidden sm:flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-400"
                    title="Cerrar sesión"
                >
                    <LogOut className="h-4 w-4" />
                </button>
            </div>
        </header>
    )
}
