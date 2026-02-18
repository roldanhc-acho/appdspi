import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { useAuth } from "@/contexts/AuthContext"
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    addMonths,
    subMonths,
    isWeekend,
    getDay,
    isSameMonth
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Trash2, PiggyBank } from "lucide-react"
import { isNonWorkingDay } from "@/utils/holidays"

type TimeLog = Database["public"]["Tables"]["time_logs"]["Row"] & {
    tasks: { title: string, projects: { name: string, client_id: string } | null } | null
}
type Absence = Database["public"]["Tables"]["absences"]["Row"]
type Client = Database["public"]["Tables"]["clients"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]
type HourBank = {
    id: string
    user_id: string
    month: string
    hours_saved: number
}

export default function TimeLogsPage() {
    const { profile } = useAuth()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [logs, setLogs] = useState<TimeLog[]>([])
    const [absences, setAbsences] = useState<Absence[]>([])
    const [hourBankTotal, setHourBankTotal] = useState(0)
    const [currentMonthBank, setCurrentMonthBank] = useState<HourBank | null>(null)

    // Form and Data State
    const [clients, setClients] = useState<Client[]>([])
    const [tasks, setTasks] = useState<Task[]>([])
    const [showModal, setShowModal] = useState(false)
    const [showBankModal, setShowBankModal] = useState(false)
    const [bankHoursToSave, setBankHoursToSave] = useState("")

    const [formData, setFormData] = useState({
        id: "",
        client_id: "",
        task_id: "",
        date: new Date().toISOString().split('T')[0],
        hours_worked: "",
        notes: "",
    })

    // Monthly dates calculation
    const { monthStart, monthEnd, monthDays, formattedMonth, currentMonthStr } = useMemo(() => {
        const start = startOfMonth(currentDate)
        const end = endOfMonth(currentDate)

        // Get first day of the calendar grid (previous month days to fill first week)
        const firstDayOfMonth = getDay(start)
        const daysFromPrevMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 // Monday = 0
        const calendarStart = new Date(start)
        calendarStart.setDate(calendarStart.getDate() - daysFromPrevMonth)

        // Get last day of calendar grid (next month days to fill last week)
        const lastDayOfMonth = getDay(end)
        const daysToNextMonth = lastDayOfMonth === 0 ? 0 : 7 - lastDayOfMonth
        const calendarEnd = new Date(end)
        calendarEnd.setDate(calendarEnd.getDate() + daysToNextMonth)

        const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
        const formatted = format(start, 'MMMM yyyy', { locale: es })
        const monthStr = format(start, 'yyyy-MM')

        return { monthStart: start, monthEnd: end, monthDays: days, formattedMonth: formatted, currentMonthStr: monthStr }
    }, [currentDate])

    useEffect(() => {
        Promise.all([
            fetchLogs(),
            fetchAbsences(),
            fetchClients(),
            fetchHourBank()
        ])
    }, [currentDate])

    useEffect(() => {
        if (formData.client_id) {
            fetchTasks(formData.client_id)
        } else {
            setTasks([])
        }
    }, [formData.client_id])

    const fetchLogs = async () => {
        const { data } = await supabase
            .from("time_logs")
            .select("*, tasks(title, projects(name, client_id))")
            .eq("user_id", profile?.id)
            .gte("date", format(monthStart, 'yyyy-MM-dd'))
            .lte("date", format(monthEnd, 'yyyy-MM-dd'))

        setLogs(data as any || [])
    }

    const fetchAbsences = async () => {
        const { data } = await supabase
            .from("absences")
            .select("*")
            .eq("user_id", profile?.id)
            .eq("status", "approved")
            .or(`start_date.lte.${format(monthEnd, 'yyyy-MM-dd')},end_date.gte.${format(monthStart, 'yyyy-MM-dd')}`)

        setAbsences(data || [])
    }

    const fetchClients = async () => {
        if (!profile?.id) return

        // Gracias al RLS actualizado, simplemente pedimos los clientes.
        // La base de datos solo devolverá aquellos donde el usuario sea parte del equipo o tenga proyectos.
        const { data, error } = await supabase
            .from("clients")
            .select("*")
            .order("name")

        if (error) {
            console.error("Error fetching clients:", error)
            return
        }

        setClients(data || [])
    }

    const fetchHourBank = async () => {
        if (!profile?.id) return

        // Fetch total accumulated bank
        const { data: allBanks } = await supabase
            .from("hour_bank")
            .select("hours_saved")
            .eq("user_id", profile.id)

        const total = (allBanks || []).reduce((acc, b) => acc + (b.hours_saved || 0), 0)
        setHourBankTotal(total)

        // Fetch current month bank entry (use maybeSingle to handle no result)
        const { data: currentBank } = await supabase
            .from("hour_bank")
            .select("*")
            .eq("user_id", profile.id)
            .eq("month", currentMonthStr)
            .maybeSingle()

        setCurrentMonthBank(currentBank as HourBank | null)
    }

    const fetchTasks = async (clientId: string) => {
        const { data: pjs } = await supabase.from("projects").select("id").eq("client_id", clientId)
        const projectIds = pjs?.map(p => p.id) || []

        let query = supabase
            .from("tasks")
            .select("*, projects(name, client_id)")
            // Quitamos el filtro de assigned_to para que vea todas las tareas de la empresa
            // El RLS ya se encarga de que solo vea las de sus empresas/proyectos
            .neq("status", "finished")

        if (projectIds.length > 0) {
            query = query.or(`client_id.eq.${clientId},project_id.in.(${projectIds.join(',')})`)
        } else {
            query = query.eq("client_id", clientId)
        }

        const { data } = await query.order("title")
        const rawTasks = (data as any || []) as (Task & { projects: { name: string } | null })[]

        const generalTasks = rawTasks.filter(t => !t.project_id)
        const projectTasks = rawTasks.filter(t => t.project_id)

        const genParents = generalTasks.filter(t => !t.parent_task_id)
        const genChildren = generalTasks.filter(t => t.parent_task_id)

        const hierarchicalTasks: (Task & { projects: { name: string } | null, isHeader?: boolean })[] = []

        if (genParents.length > 0 || genChildren.length > 0) {
            hierarchicalTasks.push({ id: 'header-general', title: 'TAREAS GENERALES', isHeader: true } as any)
            genParents.forEach(p => {
                hierarchicalTasks.push(p)
                genChildren.filter(c => c.parent_task_id === p.id).forEach(c => hierarchicalTasks.push(c))
            })
            genChildren.forEach(c => {
                if (!hierarchicalTasks.find(t => t.id === c.id)) hierarchicalTasks.push(c)
            })
        }

        const projectsInTasks = [...new Set(projectTasks.map(t => t.projects?.name))].filter(Boolean).sort()

        projectsInTasks.forEach(projName => {
            hierarchicalTasks.push({ id: `header-${projName}`, title: projName!.toUpperCase(), isHeader: true } as any)
            const tasksOfThisProj = projectTasks.filter(t => t.projects?.name === projName)
            const pParents = tasksOfThisProj.filter(t => !t.parent_task_id)
            const pChildren = tasksOfThisProj.filter(t => t.parent_task_id)

            pParents.forEach(p => {
                hierarchicalTasks.push(p)
                pChildren.filter(c => c.parent_task_id === p.id).forEach(c => hierarchicalTasks.push(c))
            })
            pChildren.forEach(c => {
                if (!hierarchicalTasks.find(t => t.id === c.id)) hierarchicalTasks.push(c)
            })
        })

        setTasks(hierarchicalTasks as any)
    }

    // Calculations
    const getDailyStats = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayLogs = logs.filter(l => l.date === dateStr)
        const loggedHours = dayLogs.reduce((acc, curr) => acc + curr.hours_worked, 0)

        const absence = absences.find(a => {
            return dateStr >= a.start_date && dateStr <= a.end_date
        })
        const isAbsenceJustified = !!absence

        const isWknd = isWeekend(day)
        const isHoliday = isNonWorkingDay(day) && !isWknd
        const target = (isWknd || isHoliday) ? 0 : 9

        const effectiveHours = loggedHours + (isAbsenceJustified && !isWknd && !isHoliday ? 9 : 0)
        const balance = effectiveHours - target

        return {
            loggedHours,
            effectiveHours,
            balance,
            isWknd,
            isHoliday,
            isAbsenceJustified,
            target,
            logs: dayLogs
        }
    }

    const monthStats = useMemo(() => {
        let totalHours = 0
        let rawProductivity = 0

        monthDays.forEach(day => {
            if (isSameMonth(day, currentDate)) {
                const stats = getDailyStats(day)
                totalHours += stats.loggedHours
                rawProductivity += stats.balance
            }
        })

        // Subtract hours already saved to bank this month from productivity
        const savedThisMonth = currentMonthBank?.hours_saved || 0
        const productivity = rawProductivity - savedThisMonth
        const availableToSave = Math.max(0, rawProductivity - savedThisMonth)

        return { totalHours, productivity, savedThisMonth, availableToSave }
    }, [logs, absences, monthDays, currentMonthBank])

    const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const handleToday = () => setCurrentDate(new Date())

    const handleOpenModal = (dateStr?: string, log?: TimeLog) => {
        if (log) {
            const clientId = log.tasks?.projects?.client_id || ""
            setFormData({
                id: log.id,
                client_id: clientId,
                task_id: log.task_id || "",
                date: log.date,
                hours_worked: log.hours_worked.toString(),
                notes: log.notes || ""
            })
        } else {
            setFormData({
                id: "",
                client_id: "",
                task_id: "",
                date: dateStr || new Date().toISOString().split('T')[0],
                hours_worked: "",
                notes: "",
            })
        }
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (formData.id) {
                const { error } = await supabase.from("time_logs").update({
                    task_id: formData.task_id,
                    date: formData.date,
                    hours_worked: Number(formData.hours_worked),
                    notes: formData.notes,
                }).eq("id", formData.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from("time_logs").insert([{
                    user_id: profile!.id,
                    task_id: formData.task_id,
                    date: formData.date,
                    hours_worked: Number(formData.hours_worked),
                    notes: formData.notes,
                    type: "regular"
                }])
                if (error) throw error
            }

            fetchLogs()
            setShowModal(false)
        } catch (error) {
            console.error("Error saving log:", error)
            alert("Error al guardar el registro")
        }
    }

    const handleDelete = async () => {
        if (!formData.id) return
        if (!confirm("¿Estás seguro de que quieres eliminar este registro?")) return

        try {
            const { error } = await supabase.from("time_logs").delete().eq("id", formData.id)
            if (error) throw error
            fetchLogs()
            setShowModal(false)
        } catch (error) {
            console.error("Error deleting log:", error)
            alert("Error al eliminar el registro")
        }
    }

    const handleSaveToBank = async () => {
        const hoursToSave = Number(bankHoursToSave)
        if (!hoursToSave || hoursToSave <= 0 || hoursToSave > monthStats.availableToSave) {
            alert("Cantidad inválida")
            return
        }

        try {
            if (currentMonthBank) {
                // Update existing entry
                const { error } = await supabase
                    .from("hour_bank")
                    .update({
                        hours_saved: currentMonthBank.hours_saved + hoursToSave,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", currentMonthBank.id)
                if (error) throw error
            } else {
                // Create new entry
                const { error } = await supabase
                    .from("hour_bank")
                    .insert([{
                        user_id: profile!.id,
                        month: currentMonthStr,
                        hours_saved: hoursToSave
                    }])
                if (error) throw error
            }

            fetchHourBank()
            setShowBankModal(false)
            setBankHoursToSave("")
        } catch (error) {
            console.error("Error saving to bank:", error)
            alert("Error al guardar en el banco")
        }
    }

    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold dark:text-white">Registro de Horas</h1>
            <p className="text-slate-500">Registra tus horas trabajadas por tarea. Jornada estándar: 9 horas diarias.</p>

            {/* Calendar Controls & Stats */}
            <div className="rounded-xl border bg-slate-900 p-6 text-white shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-slate-400" />
                        <h2 className="text-lg font-semibold">Calendario mensual</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handlePreviousMonth} className="p-2 rounded hover:bg-slate-800 border border-slate-700">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-medium px-2 capitalize min-w-[140px] text-center">
                            {formattedMonth}
                        </span>
                        <button onClick={handleNextMonth} className="p-2 rounded hover:bg-slate-800 border border-slate-700">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button onClick={handleToday} className="flex items-center gap-2 px-3 py-2 rounded border border-slate-700 hover:bg-slate-800 text-sm">
                            <CalendarIcon className="h-4 w-4" />
                            Hoy
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-6 text-sm mb-6">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400">Total mes:</span>
                        <span className="font-bold">{monthStats.totalHours} horas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400">Productividad:</span>
                        <span className={`font-bold ${monthStats.productivity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {monthStats.productivity > 0 ? '+' : ''}{monthStats.productivity} horas
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400">Banco de horas:</span>
                        <span className={`rounded-full border px-2 py-0.5 font-bold ${hourBankTotal >= 0 ? 'border-green-500/50 bg-green-500/10 text-green-500' : 'border-red-500/50 bg-red-500/10 text-red-500'}`}>
                            {hourBankTotal > 0 ? '+' : ''}{hourBankTotal} horas
                        </span>
                    </div>
                    {monthStats.availableToSave > 0 && (
                        <button
                            onClick={() => { setBankHoursToSave(monthStats.availableToSave.toString()); setShowBankModal(true) }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-sm font-medium transition-colors"
                        >
                            <PiggyBank className="h-4 w-4" />
                            Pasar al banco ({monthStats.availableToSave}h disponibles)
                        </button>
                    )}
                </div>

                {/* Day Names Header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {dayNames.map(day => (
                        <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {monthDays.map(day => {
                        const { loggedHours, target, isWknd, isHoliday, isAbsenceJustified, logs: dayLogs } = getDailyStats(day)
                        const isToday = isSameDay(day, new Date())
                        const isCurrentMonth = isSameMonth(day, currentDate)

                        return (
                            <div
                                key={day.toISOString()}
                                className={`relative flex flex-col rounded-lg border p-2 min-h-[90px] transition-colors cursor-pointer hover:border-blue-500/50
                                    ${isToday ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/50'}
                                    ${!isCurrentMonth ? 'opacity-40' : ''}
                                    ${isWknd ? 'border-l-2 border-l-red-500' : ''}
                                    ${isHoliday ? 'border-l-2 border-l-orange-500' : ''}
                                `}
                                onClick={() => isCurrentMonth && handleOpenModal(format(day, 'yyyy-MM-dd'))}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <p className={`text-sm font-bold 
                                        ${isWknd ? 'text-red-400' : (isHoliday ? 'text-orange-400' : 'text-white')}
                                    `}>
                                        {format(day, 'd')}
                                    </p>
                                    {isCurrentMonth && (
                                        <div className="text-right text-xs">
                                            <span className="text-white font-medium">{loggedHours}</span>
                                            <span className="text-slate-500">/{target}</span>
                                        </div>
                                    )}
                                </div>

                                {isCurrentMonth && (
                                    <div className="flex-1 space-y-0.5 overflow-hidden">
                                        {dayLogs.length > 0 ? (
                                            dayLogs.slice(0, 2).map(l => (
                                                <div
                                                    key={l.id}
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(undefined, l) }}
                                                    className="text-xs bg-slate-900/50 px-1 py-0.5 rounded truncate hover:bg-slate-700"
                                                >
                                                    {l.tasks?.title?.slice(0, 15) || 'Sin tarea'}
                                                </div>
                                            ))
                                        ) : isAbsenceJustified ? (
                                            <div className="flex items-center gap-1 text-xs text-green-400">
                                                <CheckCircle className="h-3 w-3" />
                                                <span>Justif.</span>
                                            </div>
                                        ) : null}
                                        {dayLogs.length > 2 && (
                                            <span className="text-xs text-slate-500">+{dayLogs.length - 2} más</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Time Log Modal */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-50 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">
                                {formData.id ? "Editar registro" : "Nuevo registro"}
                            </h2>
                            {formData.id && (
                                <button
                                    onClick={handleDelete}
                                    className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-900/20"
                                    title="Eliminar registro"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Cliente</label>
                                    <select
                                        required
                                        value={formData.client_id}
                                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value, task_id: "" })}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="">Seleccionar cliente</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Tarea</label>
                                    <select
                                        required
                                        value={formData.task_id}
                                        onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-blue-500"
                                        disabled={!formData.client_id}
                                    >
                                        <option value="">Seleccionar tarea</option>
                                        {tasks.map(t => {
                                            const isHeader = (t as any).isHeader
                                            if (isHeader) {
                                                return (
                                                    <option
                                                        key={t.id}
                                                        disabled
                                                        style={{ backgroundColor: '#334155', color: '#ffffff', fontWeight: 'bold' }}
                                                    >
                                                        ── {t.title} ──
                                                    </option>
                                                )
                                            }
                                            const isSubtask = !!t.parent_task_id
                                            return (
                                                <option
                                                    key={t.id}
                                                    value={t.id}
                                                    style={{ paddingLeft: isSubtask ? '20px' : '0', backgroundColor: '#0f172a' }}
                                                >
                                                    {isSubtask ? `\u00A0\u00A0\u00A0↳ ${t.title}` : t.title}
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Horas</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    required
                                    value={formData.hours_worked}
                                    onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-blue-500"
                                    placeholder="0.0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Notas</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-blue-500"
                                    rows={3}
                                    placeholder="Descripción del trabajo realizado..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="rounded-lg px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 font-medium transition-colors"
                                >
                                    {formData.id ? "Actualizar" : "Guardar registro"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Hour Bank Modal */}
            {showBankModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
                        <div className="flex items-center gap-3 mb-6">
                            <PiggyBank className="h-6 w-6 text-green-400" />
                            <h2 className="text-xl font-bold">Pasar horas al banco</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-800 rounded-lg p-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">Productividad del mes:</span>
                                    <span className="font-bold text-green-400">+{monthStats.productivity}h</span>
                                </div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">Ya guardadas este mes:</span>
                                    <span className="font-medium">{monthStats.savedThisMonth}h</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                                    <span className="text-slate-400">Disponible para guardar:</span>
                                    <span className="font-bold text-white">{monthStats.availableToSave}h</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Horas a guardar en el banco
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    max={monthStats.availableToSave}
                                    min="0.5"
                                    value={bankHoursToSave}
                                    onChange={(e) => setBankHoursToSave(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-green-500"
                                    placeholder="0.0"
                                />
                            </div>

                            <p className="text-xs text-slate-500">
                                Las horas guardadas en el banco se acumularán con las de los meses siguientes.
                            </p>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowBankModal(false)}
                                    className="rounded-lg px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveToBank}
                                    className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 font-medium transition-colors"
                                >
                                    Guardar en banco
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
