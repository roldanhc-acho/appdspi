import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import {
    Clock,
    Folder,
    CheckCircle,
    Wallet,
    Calendar,
    Filter,
    Pencil,
    AlertCircle,
    Check,
    TrendingUp
} from "lucide-react"
import { TaskModal } from "@/components/projects/TaskModal"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import { startOfWeek, subMonths, startOfMonth, format, addDays } from "date-fns"
import { es } from "date-fns/locale"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export default function DashboardPage() {
    const { profile } = useAuth()
    const isAdmin = profile?.role === "admin"

    // State
    const [stats, setStats] = useState({
        hoursToday: 0,
        activeProjects: 0,
        completedTasks: 0,
        hourBank: 0,
        completedTasksGrowth: 0,
        productiveHours: 0
    })
    const [weeklyData, setWeeklyData] = useState<any[]>([])
    const [tasks, setTasks] = useState<any[]>([])
    const [recentActivity, setRecentActivity] = useState<any[]>([])
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
    const [selectedTask, setSelectedTask] = useState<any>(null)
    const [showTaskModal, setShowTaskModal] = useState(false)
    const [taskProgress, setTaskProgress] = useState<Record<string, number>>({})


    // Filters
    const [filterUser, setFilterUser] = useState<string>("all")
    const [filterClient, setFilterClient] = useState<string>("all")
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

    const [users, setUsers] = useState<Profile[]>([])
    const [clients, setClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (isAdmin) {
            fetchUsers()
            fetchClients()
        }
    }, [isAdmin])

    useEffect(() => {
        if (profile) fetchUpcomingEvents()
    }, [profile])

    useEffect(() => {
        if (profile) fetchData()
    }, [profile, filterUser, filterClient, startDate, endDate])

    const fetchUsers = async () => {
        const { data } = await supabase.from("profiles").select("*").order("full_name")
        setUsers(data || [])
    }

    const fetchClients = async () => {
        const { data } = await supabase.from("clients").select("*").order("name")
        setClients(data || [])
    }

    const fetchUpcomingEvents = async () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')

        const { data } = await supabase
            .from("events")
            .select("*")
            .or(`event_date.gte.${today},and(requires_confirmation.eq.true,is_confirmed.eq.false)`)
            .lte("event_date", nextWeek)
            .order("event_date", { ascending: true })

        setUpcomingEvents(data || [])
    }

    const handleConfirmEvent = async (eventId: string) => {
        try {
            const { error } = await supabase
                .from("events")
                .update({ is_confirmed: true })
                .eq("id", eventId)

            if (error) throw error
            fetchUpcomingEvents()
        } catch (error) {
            console.error("Error confirming event:", error)
        }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const targetUser = isAdmin && filterUser !== 'all' ? filterUser : (isAdmin ? null : profile?.id)

            // 1. Fetch Time Logs
            let logsQuery = supabase
                .from("time_logs")
                .select("*, tasks(title, project_id, projects(client_id, name))")
                .gte('date', startDate)
                .lte('date', endDate)
                .order("date", { ascending: false })

            if (targetUser) logsQuery = logsQuery.eq("user_id", targetUser)
            const { data: logsData } = await logsQuery
            let logs = logsData || []

            // 2. Fetch Tasks
            let tasksQuery = supabase
                .from("tasks")
                .select("*, projects(client_id, name)")
                .order("due_date", { ascending: true })

            if (targetUser) tasksQuery = tasksQuery.eq("assigned_to", targetUser)
            const { data: tasksData } = await tasksQuery
            let allTasks = tasksData || []

            // Memory Filtering for Client
            if (filterClient !== 'all') {
                logs = logs.filter(l => l.tasks?.projects?.client_id === filterClient)
                allTasks = allTasks.filter(t => t.projects?.client_id === filterClient)
            }

            // 3. Fetch Projects (Filter by assignment if user selected)
            let projectsQuery = supabase
                .from("projects")
                .select("id", { count: 'exact', head: true })
                .eq("status", "active")

            if (filterClient !== 'all') projectsQuery = projectsQuery.eq("client_id", filterClient)

            if (targetUser) {
                // If user selected, only count projects they are assigned to
                const { data: assignedProjects } = await supabase
                    .from("project_assignments")
                    .select("project_id")
                    .eq("user_id", targetUser)

                const projectIds = assignedProjects?.map(p => p.project_id) || []
                projectsQuery = projectsQuery.in("id", projectIds)
            }

            const { count: projectCount } = await projectsQuery

            // 4. Fetch Productive Hours (Admin Only)
            let productiveHours: any[] = []
            if (isAdmin) {
                let phQuery = supabase
                    .from("productive_hours")
                    .select("*")
                    .gte('month', startDate.slice(0, 7))
                    .lte('month', endDate.slice(0, 7))

                if (targetUser) phQuery = phQuery.eq("user_id", targetUser)
                if (filterClient !== 'all') phQuery = phQuery.eq("client_id", filterClient)

                const { data: phData } = await phQuery
                productiveHours = phData || []
            }

            // Process Data
            if (logs && allTasks) {
                processStats(logs, allTasks, projectCount || 0, productiveHours)

                const progressMap: Record<string, number> = {}
                allTasks.forEach(task => {
                    const taskLogs = logs.filter(l => l.task_id === task.id)
                    const worked = taskLogs.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0)
                    const estimated = parseFloat(task.estimated_hours) || 0
                    progressMap[task.id] = estimated > 0 ? Math.min(Math.round((worked / estimated) * 100), 100) : 0
                })
                setTaskProgress(progressMap)
            }

        } catch (error) {
            console.error("Error fetching dashboard data:", error)
        } finally {
            setLoading(false)
        }
    }

    const processStats = (logs: any[], allTasks: any[], projectCount: number, productiveHours: any[] = []) => {
        const today = new Date().toISOString().split('T')[0]
        const currentMonthStart = startOfMonth(new Date())
        const lastMonthStart = startOfMonth(subMonths(new Date(), 1))

        // Hours Today
        const todayLogs = logs.filter(l => l.date === today)
        const hoursToday = todayLogs.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0)

        // Completed Tasks (Current Month vs Last)
        const completedThisMonth = allTasks.filter(t =>
            t.status === 'done' && new Date(t.updated_at) >= currentMonthStart
        ).length
        const completedLastMonth = allTasks.filter(t =>
            t.status === 'done' &&
            new Date(t.updated_at) >= lastMonthStart &&
            new Date(t.updated_at) < currentMonthStart
        ).length
        const growth = completedLastMonth > 0
            ? Math.round(((completedThisMonth - completedLastMonth) / completedLastMonth) * 100)
            : 0

        // Weekly Chart
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
        const weekData = []
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
        for (let i = 0; i < 5; i++) {
            const date = addDays(weekStart, i)
            const dateStr = format(date, 'yyyy-MM-dd')
            const dayLogs = logs.filter(l => l.date === dateStr)
            const hours = dayLogs.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0)
            weekData.push({ name: days[i], hours, target: 9 })
        }

        // Assigned Tasks (Top pending)
        const pendingTasks = allTasks.filter(t => t.status !== 'done')

        const activity = [
            ...logs.slice(0, 3).map(l => ({
                type: 'log',
                title: 'Horas registradas',
                desc: `${l.hours_worked} horas en ${l.tasks?.projects?.name || 'Unknown Project'}`,
                time: l.created_at
            })),
            ...allTasks.filter(t => t.status === 'done').slice(0, 3).map(t => ({
                type: 'task',
                title: 'Tarea completada',
                desc: `${t.title} - ${t.projects?.name}`,
                time: t.updated_at
            }))
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 4)

        // Total Productive Hours for the period
        const totalProductive = productiveHours.reduce((acc, curr) => acc + (curr.hours || 0), 0)

        setStats({
            hoursToday,
            activeProjects: projectCount,
            completedTasks: completedThisMonth,
            hourBank: 0, // Removed hardcoded 5.5
            completedTasksGrowth: growth,
            productiveHours: totalProductive
        })
        setWeeklyData(weekData)
        setTasks(pendingTasks)
        setRecentActivity(activity)
    }

    if (loading) return <div className="p-8">Cargando Panel...</div>

    return (
        <div className="space-y-6">
            {/* Header / Intro */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white">¡Hola, {profile?.full_name?.split(' ')[0]}!</h1>
                    <p className="text-slate-500 dark:text-slate-400">Aquí tienes un resumen de tu actividad.</p>
                </div>

                {/* Filters (Admin Only) */}
                {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Date Range */}
                        <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent outline-none dark:text-slate-300"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent outline-none dark:text-slate-300"
                            />
                        </div>

                        {/* User Filter */}
                        <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700">
                            <Filter className="h-4 w-4 text-slate-500" />
                            <select
                                value={filterUser}
                                onChange={(e) => setFilterUser(e.target.value)}
                                className="bg-transparent outline-none dark:text-slate-300"
                            >
                                <option value="all">Todo el equipo</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Client Filter */}
                        <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700">
                            <Folder className="h-4 w-4 text-slate-500" />
                            <select
                                value={filterClient}
                                onChange={(e) => setFilterClient(e.target.value)}
                                className="bg-transparent outline-none dark:text-slate-300"
                            >
                                <option value="all">Todos los clientes</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Hours Today */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Horas Hoy</p>
                            <h3 className="mt-2 text-3xl font-bold dark:text-white">{stats.hoursToday}</h3>
                            <p className="text-xs text-slate-500">De 9 horas objetivo</p>
                        </div>
                        <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            <Clock className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* Active Projects */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Proyectos Activos</p>
                            <h3 className="mt-2 text-3xl font-bold dark:text-white">{stats.activeProjects}</h3>
                        </div>
                        <div className="rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                            <Folder className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* Completed Tasks */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tareas Completadas</p>
                            <h3 className="mt-2 text-3xl font-bold dark:text-white">{stats.completedTasks}</h3>
                            <p className="text-xs text-slate-500">Este mes</p>
                            <p className={`text-xs font-medium ${stats.completedTasksGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stats.completedTasksGrowth >= 0 ? '+' : ''}{stats.completedTasksGrowth}% vs mes anterior
                            </p>
                        </div>
                        <div className="rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                {/* Productive Hours (Admin Only) */}
                {isAdmin ? (
                    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Horas Productivas</p>
                                <h3 className="mt-2 text-3xl font-bold text-green-500">+{stats.productiveHours}h</h3>
                                <p className="text-xs text-slate-500">Asignadas este mes</p>
                            </div>
                            <div className="rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Banco de Horas</p>
                                <h3 className="mt-2 text-3xl font-bold dark:text-white">+{stats.hourBank}</h3>
                                <p className="text-xs text-slate-500">Horas acumuladas</p>
                            </div>
                            <div className="rounded-full bg-yellow-100 p-3 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400">
                                <Wallet className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Weekly Chart */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="font-semibold dark:text-white">Horas esta Semana</h3>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                                <span className="text-slate-500">Trabajadas</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-slate-700"></span>
                                <span className="text-slate-500">Objetivo (9h)</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, 12]}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                />
                                <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                    {weeklyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.hours >= 9 ? '#22c55e' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Assigned Tasks */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="font-semibold dark:text-white">Tareas Asignadas</h3>
                        <button className="text-xs font-medium text-red-500 hover:text-red-400">Ver todas</button>
                    </div>
                    <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                        {tasks.map(task => {
                            const progress = taskProgress[task.id] || 0
                            const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) && task.status !== 'done'

                            return (
                                <div key={task.id} className={`group flex flex-col gap-2 rounded-lg border p-3 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOverdue ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`font-medium dark:text-white line-clamp-1 ${isOverdue ? 'text-red-500' : ''}`}>{task.title}</p>
                                                {isOverdue && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded uppercase animate-pulse">
                                                        <AlertCircle className="h-3 w-3" /> Vencida
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 uppercase">{task.projects?.name || 'Tarea General'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}
                                                className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold min-w-[30px] ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                                            {progress}%
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold 
                                                ${task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                task.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'} uppercase`}
                                        >
                                            {task.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        {tasks.length === 0 && (
                            <p className="text-center text-sm text-slate-500 py-4 italic">No tienes tareas pendientes</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Task Edit Modal */}
            {showTaskModal && (
                <TaskModal
                    isOpen={showTaskModal}
                    onClose={() => setShowTaskModal(false)}
                    onSuccess={() => {
                        fetchData()
                        setShowTaskModal(false)
                    }}
                    initialData={selectedTask}
                    fixedClientId={selectedTask?.projects?.client_id || selectedTask?.client_id}
                />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Activity */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <h3 className="mb-6 font-semibold dark:text-white">Actividad reciente</h3>
                    <div className="space-y-6">
                        {recentActivity.map((item, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg 
                                    ${item.type === 'log' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20' : 'bg-green-100 text-green-600 dark:bg-green-900/20'}`}>
                                    {item.type === 'log' ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                </div>
                                <div>
                                    <p className="font-medium dark:text-white">{item.title}</p>
                                    <p className="text-sm text-slate-500">{item.desc}</p>
                                    <p className="mt-1 text-xs text-slate-400">Hace {Math.abs(new Date().getHours() - new Date(item.time).getHours())} horas</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="font-semibold dark:text-white">Próximos Eventos</h3>
                        <a href="/agenda" className="text-xs font-medium text-indigo-500 hover:text-indigo-400">
                            Ver agenda
                        </a>
                    </div>
                    <div className="space-y-4">
                        {upcomingEvents.length === 0 && (
                            <p className="text-center text-sm text-slate-500 py-4">No hay eventos próximos</p>
                        )}
                        {upcomingEvents.map((event: any) => {
                            const isPast = new Date(event.event_date) < new Date(new Date().setHours(0, 0, 0, 0))
                            const needsAttention = event.requires_confirmation && !event.is_confirmed && isPast

                            const colorClass = needsAttention
                                ? 'border-red-500 bg-red-500/10'
                                : event.is_public
                                    ? 'border-green-900/30 bg-green-900/10'
                                    : 'border-purple-900/30 bg-purple-900/10'

                            const dotColor = needsAttention ? 'bg-red-500' : (event.is_public ? 'bg-green-500' : 'bg-purple-500')
                            const textColor = needsAttention ? 'text-red-500' : (event.is_public ? 'text-green-200' : 'text-purple-200')

                            return (
                                <div key={event.id} className={`rounded-lg border ${colorClass} p-4 transition-colors`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                                            <div>
                                                <p className={`font-medium ${textColor} flex items-center gap-2`}>
                                                    {event.title}
                                                    {needsAttention && (
                                                        <span className="text-[10px] font-bold bg-red-500 text-white px-1 py-0.5 rounded animate-pulse">
                                                            VENCIDO
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {format(addDays(new Date(event.event_date + 'T12:00:00'), 0), "d 'de' MMMM", { locale: es })}
                                                    {event.event_time && ` - ${event.event_time.slice(0, 5)}`}
                                                </p>
                                            </div>
                                        </div>

                                        {event.requires_confirmation && !event.is_confirmed && (
                                            <button
                                                onClick={() => handleConfirmEvent(event.id)}
                                                className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition-colors"
                                                title="Marcar como visto"
                                            >
                                                <Check className="h-3 w-3" /> CONFIRMAR
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
