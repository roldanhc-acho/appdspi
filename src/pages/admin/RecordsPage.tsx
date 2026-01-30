import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { Calendar, User, Download, ChevronLeft, ChevronRight, FileText, Building2, Edit2, Trash2, X, Save, CheckSquare } from "lucide-react"

// Tipos
type Profile = { id: string; full_name: string | null }
type Client = { id: string; name: string }
type TaskSimple = {
    id: string;
    title: string;
    project: {
        id: string;
        name: string;
        client_id: string
    } | null
}

type TimeLogWithDetails = {
    id: string
    date: string
    hours_worked: number
    notes: string | null
    created_at: string
    user: { full_name: string | null } | null
    task: {
        id: string
        title: string
        client_id?: string
        client_direct?: { name: string } | null
        project: {
            name: string
            client: { name: string } | null
        } | null
    } | null
}

export default function RecordsPage() {
    // Datos principales
    const [logs, setLogs] = useState<TimeLogWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [totalHours, setTotalHours] = useState(0)

    // Catálogos para selects
    const [users, setUsers] = useState<Profile[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [tasks, setTasks] = useState<TaskSimple[]>([])

    // Filtros de estado
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [selectedUserId, setSelectedUserId] = useState("all")
    const [selectedClientId, setSelectedClientId] = useState("all")
    const [selectedTaskId, setSelectedTaskId] = useState("all")

    // Paginación
    const [page, setPage] = useState(1)
    const pageSize = 50
    const [hasMore, setHasMore] = useState(false)
    const [totalRecords, setTotalRecords] = useState(0)

    // Estado de Edición
    const [editingLog, setEditingLog] = useState<TimeLogWithDetails | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editForm, setEditForm] = useState({
        date: "",
        hours_worked: 0,
        notes: ""
    })
    const [isSaving, setIsSaving] = useState(false)

    // 1. Cargar catálogos iniciales
    useEffect(() => {
        fetchCatalogs()
    }, [])

    // 2. Cargar tareas cuando cambie el cliente
    useEffect(() => {
        fetchTasksForClient()
    }, [selectedClientId])

    // 3. Recargar logs cuando cambian filtros o página
    useEffect(() => {
        fetchLogs()
    }, [page, startDate, endDate, selectedUserId, selectedClientId, selectedTaskId])

    async function fetchCatalogs() {
        try {
            const { data: usersData } = await supabase.from("profiles").select("id, full_name").order("full_name")
            if (usersData) setUsers(usersData)

            const { data: clientsData } = await supabase.from("clients").select("id, name").order("name")
            if (clientsData) setClients(clientsData)
        } catch (err) {
            console.error("Error cargando catálogos:", err)
        }
    }

    async function fetchTasksForClient() {
        try {
            if (selectedClientId === "all") {
                const { data } = await supabase
                    .from("tasks")
                    .select(`
                        id, 
                        title, 
                        project:projects(id, name, client_id)
                    `)
                    .order("title")
                    .limit(1000)
                if (data) setTasks(data as any)
                return
            }

            // Obtener IDs de proyectos del cliente
            const { data: projects } = await supabase
                .from('projects')
                .select('id')
                .eq('client_id', selectedClientId)

            const projIds = projects?.map(p => p.id) || []

            let query = supabase
                .from("tasks")
                .select(`
                    id, 
                    title, 
                    project:projects(id, name, client_id)
                `)
                .order("title")

            if (projIds.length > 0) {
                // Tarea directa del cliente O tarea de uno de sus proyectos
                query = query.or(`client_id.eq.${selectedClientId},project_id.in.(${projIds.join(',')})`)
            } else {
                // Solo tareas directas del cliente
                query = query.eq('client_id', selectedClientId)
            }

            const { data } = await query
            if (data) setTasks(data as any)
        } catch (err) {
            console.error("Error cargando tareas:", err)
        }
    }

    async function fetchLogs() {
        setLoading(true)
        try {
            let query = supabase
                .from("time_logs")
                .select(`
                    id,
                    date,
                    hours_worked,
                    notes,
                    created_at,
                    user:profiles!time_logs_user_id_fkey(full_name),
                    task:tasks!time_logs_task_id_fkey(
                        id,
                        title,
                        client_id,
                        project:projects(
                            id,
                            name,
                            client:clients(id, name)
                        ),
                        client_direct:clients(id, name)
                    )
                `, { count: 'exact' })
                .order("date", { ascending: false })
                .range((page - 1) * pageSize, page * pageSize - 1)

            if (startDate) query = query.gte("date", startDate)
            if (endDate) query = query.lte("date", endDate)
            if (selectedUserId !== "all") query = query.eq("user_id", selectedUserId)

            if (selectedTaskId !== "all") {
                query = query.eq("task_id", selectedTaskId)
            }
            else if (selectedClientId !== "all") {
                // Filtro híbrido: Tareas del cliente directo (project_id null) O tareas de proyectos del cliente
                // Supabase no soporta OR complejos fácilmente en JS client sin hacer RPC o filtro custom.
                // Estrategia: Obtener todos los IDs de tareas que cumplen la condición (del cliente directo O de proyectos del cliente)
                // y filtrar por 'task_id.in(...)'

                // 1. Tareas directas del cliente
                const { data: directTaskIds } = await supabase
                    .from('tasks')
                    .select('id')
                    .eq('client_id', selectedClientId)

                // 2. Proyectos del cliente
                const { data: projectIds } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('client_id', selectedClientId)

                let allTargetTaskIds: string[] = []

                if (directTaskIds) allTargetTaskIds = [...allTargetTaskIds, ...directTaskIds.map(t => t.id)]

                if (projectIds && projectIds.length > 0) {
                    const pIds = projectIds.map(p => p.id)
                    const { data: projectTaskIds } = await supabase
                        .from('tasks')
                        .select('id')
                        .in('project_id', pIds)

                    if (projectTaskIds) {
                        allTargetTaskIds = [...allTargetTaskIds, ...projectTaskIds.map(t => t.id)]
                    }
                }

                if (allTargetTaskIds.length > 0) {
                    query = query.in('task_id', allTargetTaskIds)
                } else {
                    // Si no hay tareas, forzar vacío
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000')
                }
            }

            const { data, error, count } = await query
            if (error) throw error

            setLogs(data as any)
            setTotalRecords(count || 0)
            setHasMore((count || 0) > page * pageSize)

            const total = (data as any[]).reduce((sum, item) => sum + (item.hours_worked || 0), 0)
            setTotalHours(total)

        } catch (err) {
            console.error("Error fetching logs:", err)
        } finally {
            setLoading(false)
        }
    }

    const downloadCSV = () => {
        const csvHeader = ["Fecha", "Empleado", "Cliente", "Proyecto", "Tarea", "Horas", "Notas"]
        const csvRows = logs.map(log => {
            const clientName = log.task?.client_direct?.name || log.task?.project?.client?.name || "-"
            const projectName = log.task?.project?.name || "General"

            return [
                log.date, // El valor ya viene como YYYY-MM-DD, no necesitamos formatearlo para evitar líos de zona horaria en CSV
                log.user?.full_name || "Sin Asignar",
                clientName,
                projectName,
                log.task?.title || "Sin Tarea",
                log.hours_worked.toFixed(2),
                (log.notes || "").replace(/,/g, " ")
            ]
        })

        const csvContent = [csvHeader, ...csvRows].map(e => e.join(",")).join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `reporte_horas_${format(new Date(), 'yyyy-MM-dd')}.csv`
        link.click()
    }

    // --- Lógica de Edición ---
    const handleEdit = (log: TimeLogWithDetails) => {
        setEditingLog(log)
        setEditForm({
            date: log.date,
            hours_worked: log.hours_worked,
            notes: log.notes || ""
        })
        setIsEditModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Estás seguro de que quieres eliminar este registro permanentemente?")) return
        try {
            const { error } = await supabase.from("time_logs").delete().eq("id", id)
            if (error) throw error
            setLogs(logs.filter(l => l.id !== id))
            setTotalRecords(prev => prev - 1)
        } catch (err) {
            console.error("Error eliminando:", err)
            alert("Error al eliminar")
        }
    }

    const handleSaveEdit = async () => {
        if (!editingLog) return
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from("time_logs")
                .update({
                    date: editForm.date,
                    hours_worked: editForm.hours_worked,
                    notes: editForm.notes
                })
                .eq("id", editingLog.id)
            if (error) throw error
            setLogs(logs.map(l => l.id === editingLog.id ? { ...l, date: editForm.date, hours_worked: editForm.hours_worked, notes: editForm.notes } : l))
            setIsEditModalOpen(false)
            setEditingLog(null)
        } catch (err) {
            console.error("Error actualizando:", err)
            alert("Error al guardar cambios")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-8 p-8 pb-24 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Registro de Actividades</h1>
                    <p className="text-slate-400 mt-2 text-base">Visión global de horas trabajadas. Utiliza los filtros para refinar la búsqueda.</p>
                </div>
                <button
                    onClick={downloadCSV}
                    disabled={logs.length === 0}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
                >
                    <Download className="w-4 h-4" /> Exportar CSV
                </button>
            </div>

            {/* Panel de Filtros */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Rango de Fechas */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Rango de Fechas
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <input type="date" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Selector de Empleado */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <User className="w-3 h-3" /> Empleado
                        </label>
                        <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                            <option value="all">Todos los empleados</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.full_name || "Sin nombre"}</option>)}
                        </select>
                    </div>

                    {/* Selector de Cliente */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Building2 className="w-3 h-3" /> Cliente
                        </label>
                        <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); setSelectedTaskId("all"); }}>
                            <option value="all">Todos los clientes</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Selector de Tarea */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <CheckSquare className="w-3 h-3" /> Tarea
                        </label>
                        <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
                            <option value="all">Todas las tareas</option>
                            {tasks.map(t => (
                                <option key={t.id} value={t.id}>{t.title} {t.project ? `(${t.project.name})` : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Resumen */}
            <div className="flex justify-between items-end">
                <div className="text-sm text-slate-400">Mostrando <span className="text-white font-medium">{logs.length}</span> de <span className="text-white font-medium">{totalRecords}</span>.</div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-lg">
                    <span className="text-sm font-medium text-indigo-300">Total: </span>
                    <span className="text-lg font-bold text-white ml-2">{totalHours.toFixed(2)} hrs</span>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                                <th className="py-4 px-6 font-semibold w-28">Fecha</th>
                                <th className="py-4 px-6 font-semibold">Empleado</th>
                                <th className="py-4 px-6 font-semibold">Cliente / Proyecto</th>
                                <th className="py-4 px-6 font-semibold">Tarea</th>
                                <th className="py-4 px-6 font-semibold text-right">Horas</th>
                                <th className="py-4 px-6 font-semibold w-48">Notas</th>
                                <th className="py-4 px-6 font-semibold w-24 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse"><td colSpan={7} className="py-8 px-6"><div className="h-4 bg-slate-800 rounded w-full"></div></td></tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={7} className="py-16 text-center text-slate-500">No se encontraron registros</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="py-4 px-6 text-slate-300 font-mono text-xs">
                                            {format(new Date(log.date + 'T00:00:00'), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="py-4 px-6 text-slate-200">{log.user?.full_name || 'Desconocido'}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-indigo-400 uppercase">
                                                    {log.task?.client_direct?.name || log.task?.project?.client?.name || 'INTERNO'}
                                                </span>
                                                <span className="text-slate-300">
                                                    {log.task?.project?.name || 'General'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-300">{log.task?.title || 'Sin tarea'}</td>
                                        <td className="py-4 px-6 text-right">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.hours_worked >= 8 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {log.hours_worked} h
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-500 text-sm truncate max-w-xs">{log.notes || '-'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <button onClick={() => handleEdit(log)} className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(log.id)} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-slate-800 p-4 bg-slate-950 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Página {page}</span>
                    <div className="flex gap-2">
                        <button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                        <button disabled={!hasMore || loading} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            {/* Modal Edit Simple */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg">
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between">
                            <h3 className="text-white font-semibold">Editar Registro</h3>
                            <button onClick={() => setIsEditModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <input type="date" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
                            <input type="number" step="0.5" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={editForm.hours_worked} onChange={(e) => setEditForm({ ...editForm, hours_worked: parseFloat(e.target.value) })} />
                            <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notas..." />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
                            <button onClick={handleSaveEdit} disabled={isSaving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">{isSaving ? 'Guardando...' : 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
