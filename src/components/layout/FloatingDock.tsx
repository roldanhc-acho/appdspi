import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Calendar
} from "lucide-react"

export function FloatingDock() {
  const location = useLocation()

  const items = [
    {
      to: "/",
      label: "Inicio",
      icon: LayoutDashboard,
      isActive: location.pathname === "/"
    },
    {
      to: "/tasks",
      label: "Tareas",
      icon: CheckSquare,
      isActive: location.pathname.startsWith("/tasks")
    },
    {
      to: "/time-logs",
      label: "Horas",
      icon: Clock,
      isActive: location.pathname.startsWith("/time-logs")
    },
    {
      to: "/agenda",
      label: "Agenda",
      icon: Calendar,
      isActive: location.pathname.startsWith("/agenda")
    }
  ]

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden w-auto max-w-[92vw] pointer-events-auto">
      <nav className="flex items-center gap-1 p-1.5 rounded-full bg-zinc-950/92 backdrop-blur-xl border border-zinc-800/90 shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.isActive

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 whitespace-nowrap ${
                active
                  ? "bg-primary text-white shadow-md shadow-primary/30 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-zinc-400"}`} />
              <span className="text-[11px] tracking-tight">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
