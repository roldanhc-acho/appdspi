import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
    LayoutDashboard,
    Users,
    Briefcase,
    CheckSquare,
    Clock,
    CalendarDays,
    Calendar,
    TrendingUp,
    FileText,
    BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"

const SidebarItem = ({
    icon: Icon,
    label,
    to,
    active
}: {
    icon: any,
    label: string,
    to: string,
    active: boolean
}) => (
    <Link
        to={to}
        className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200",
            active
                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        )}
    >
        <Icon className={cn("h-5 w-5", active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")} />
        <span>{label}</span>
    </Link>
)

export function Sidebar() {
    const { profile } = useAuth()
    const location = useLocation()
    const isAdmin = profile?.role === "admin"

    return (
        <div className="flex h-full w-full flex-col bg-zinc-950 border-r border-zinc-900">
            <div className="flex h-16 shrink-0 items-center px-6">
                <img src="/logo.png" alt="DSPI Logo" className="h-8 object-contain" />
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="space-y-1 px-2">
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="Panel Principal"
                        to="/"
                        active={location.pathname === "/"}
                    />

                    <SidebarItem
                        icon={CheckSquare}
                        label="Tareas"
                        to="/tasks"
                        active={location.pathname.startsWith("/tasks")}
                    />

                    <SidebarItem
                        icon={Clock}
                        label="Registro de Horas"
                        to="/time-logs"
                        active={location.pathname.startsWith("/time-logs")}
                    />

                    <SidebarItem
                        icon={CalendarDays}
                        label="RRHH"
                        to="/hr"
                        active={location.pathname.startsWith("/hr")}
                    />

                    <SidebarItem
                        icon={Calendar}
                        label="Agenda"
                        to="/agenda"
                        active={location.pathname.startsWith("/agenda")}
                    />

                    <div className="my-4 border-t dark:border-slate-800" />

                    <div className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                        Proyectos
                    </div>
                    <SidebarItem
                        icon={Briefcase}
                        label="Todos los Proyectos"
                        to="/projects"
                        active={location.pathname.startsWith("/projects")}
                    />

                    {isAdmin && (
                        <>
                            <div className="my-4 border-t dark:border-slate-800" />
                            <div className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                                Administración
                            </div>
                            <SidebarItem
                                icon={FileText}
                                label="Registro de Actividades"
                                to="/admin/records"
                                active={location.pathname.startsWith("/admin/records")}
                            />
                            <SidebarItem
                                icon={TrendingUp}
                                label="Horas Productivas"
                                to="/admin/productive-hours"
                                active={location.pathname.startsWith("/admin/productive-hours")}
                            />
                            <SidebarItem
                                icon={BarChart3}
                                label="Resumen Mensual"
                                to="/admin/monthly-report"
                                active={location.pathname.startsWith("/admin/monthly-report")}
                            />
                            <SidebarItem
                                icon={Users}
                                label="Clientes"
                                to="/clients"
                                active={location.pathname.startsWith("/clients")}
                            />
                            <SidebarItem
                                icon={Users}
                                label="Empleados"
                                to="/employees"
                                active={location.pathname.startsWith("/employees")}
                            />
                        </>
                    )}
                </nav>
            </div>
        </div>
    )
}
