import { useAuth } from "@/contexts/AuthContext"
import { LogOut, User, Menu } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { PushNotificationToggle } from "@/components/notifications/PushNotificationToggle"

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
    const { profile, signOut } = useAuth()

    return (
        <header className="flex h-16 items-center justify-between border-b bg-white px-3 sm:px-6 dark:bg-slate-950 dark:border-slate-800 flex-nowrap gap-2">
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

            <div className="flex items-center gap-1.5 sm:gap-4 shrink-0 flex-nowrap">
                <PushNotificationToggle compact />
                <ThemeToggle />

                <div className="flex items-center gap-2 text-sm border-l pl-4 ml-2 dark:border-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="hidden md:block">
                        <p className="font-medium">{profile?.full_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{profile?.role === 'admin' ? 'Administrador' : 'Empleado'}</p>
                    </div>
                </div>

                <button
                    onClick={signOut}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-400"
                    title="Cerrar sesión"
                >
                    <LogOut className="h-4 w-4" />
                </button>
            </div>
        </header>
    )
}
