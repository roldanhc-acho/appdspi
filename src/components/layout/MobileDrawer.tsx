import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  X,
  LayoutDashboard,
  CheckSquare,
  Clock,
  CalendarDays,
  Calendar,
  Briefcase,
  TrendingUp,
  FileText,
  BarChart3,
  Database,
  CalendarOff,
  LogOut,
  User,
  Shield,
  Users
} from "lucide-react"

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const isAdmin = profile?.role === "admin"

  if (!isOpen) return null

  const handleLinkClick = () => {
    onClose()
  }

  const isLinkActive = (path: string) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop con desenfoque suave */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer lateral oscuro con rojo corporativo de DSPI */}
      <div className="relative z-50 flex flex-col h-full w-[85%] max-w-xs bg-zinc-950 text-white shadow-2xl border-r border-zinc-900 transition-transform duration-300 animate-in slide-in-from-left">
        {/* Cabecera del usuario */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/40">
          <div className="flex items-center justify-between mb-4">
            <img src="/logo.svg" alt="DSPI" className="h-8 object-contain" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-bold shadow-md shadow-primary/30">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : <User className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-zinc-100 truncate">
                {profile?.full_name || "Usuario"}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-950/60 text-red-300 border border-red-900/50">
                  <Shield className="h-2.5 w-2.5" />
                  {isAdmin ? "Administrador" : "Empleado"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de navegación con scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Navegación Principal */}
          <div>
            <p className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Principal
            </p>
            <div className="space-y-1">
              <DrawerItem
                to="/"
                icon={LayoutDashboard}
                label="Panel Principal"
                active={isLinkActive("/")}
                onClick={handleLinkClick}
              />
              <DrawerItem
                to="/tasks"
                icon={CheckSquare}
                label="Tareas"
                active={isLinkActive("/tasks")}
                onClick={handleLinkClick}
              />
              <DrawerItem
                to="/time-logs"
                icon={Clock}
                label="Registro de Horas"
                active={isLinkActive("/time-logs")}
                onClick={handleLinkClick}
              />
              <DrawerItem
                to="/agenda"
                icon={Calendar}
                label="Agenda"
                active={isLinkActive("/agenda")}
                onClick={handleLinkClick}
              />
              <DrawerItem
                to="/hr"
                icon={CalendarDays}
                label="RRHH"
                active={isLinkActive("/hr")}
                onClick={handleLinkClick}
              />
            </div>
          </div>

          {/* Proyectos */}
          <div>
            <p className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Proyectos
            </p>
            <div className="space-y-1">
              <DrawerItem
                to="/projects"
                icon={Briefcase}
                label="Todos los Proyectos"
                active={isLinkActive("/projects")}
                onClick={handleLinkClick}
              />
            </div>
          </div>

          {/* Administración (solo si es Admin) */}
          {isAdmin && (
            <div>
              <p className="px-3 text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-2">
                Administración
              </p>
              <div className="space-y-1">
                <DrawerItem
                  to="/admin/records"
                  icon={FileText}
                  label="Registro de Actividades"
                  active={isLinkActive("/admin/records")}
                  onClick={handleLinkClick}
                />
                <DrawerItem
                  to="/admin/productive-hours"
                  icon={TrendingUp}
                  label="Horas Productivas"
                  active={isLinkActive("/admin/productive-hours")}
                  onClick={handleLinkClick}
                />
                <DrawerItem
                  to="/admin/monthly-report"
                  icon={BarChart3}
                  label="Resumen Mensual"
                  active={isLinkActive("/admin/monthly-report")}
                  onClick={handleLinkClick}
                />
                <DrawerItem
                  to="/admin/hour-bank"
                  icon={Database}
                  label="Acumulado Banco"
                  active={isLinkActive("/admin/hour-bank")}
                  onClick={handleLinkClick}
                />
                <DrawerItem
                  to="/admin/holidays"
                  icon={CalendarOff}
                  label="Días Feriados"
                  active={isLinkActive("/admin/holidays")}
                  onClick={handleLinkClick}
                />
                <DrawerItem
                  to="/clients"
                  icon={Users}
                  label="Clientes"
                  active={isLinkActive("/clients")}
                  onClick={handleLinkClick}
                />
                <DrawerItem
                  to="/employees"
                  icon={Users}
                  label="Empleados"
                  active={isLinkActive("/employees")}
                  onClick={handleLinkClick}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer con botón de cerrar sesión */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950">
          <button
            onClick={() => {
              onClose()
              signOut()
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/40 rounded-xl transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DrawerItem({
  to,
  icon: Icon,
  label,
  active,
  onClick
}: {
  to: string
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-white" : "text-zinc-500"}`} />
      <span>{label}</span>
    </Link>
  )
}
