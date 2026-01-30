import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { Plus, List, Kanban, Pencil, Trash2, Building2, ChevronLeft, Download, Upload, Loader2, Search } from "lucide-react"
import * as XLSX from 'xlsx'

type Task = Database["public"]["Tables"]["tasks"]["Row"] & {
    projects: { name: string; client_id: string } | null
    task_assignments: {
        profiles: { full_name: string } | null
    }[]
}
type Project = Database["public"]["Tables"]["projects"]["Row"]

import { TaskModal } from "@/components/projects/TaskModal"
import { TaskKanban } from "@/components/projects/TaskKanban"

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [clients, setClients] = useState<any[]>([])
    const [selectedClient, setSelectedClient] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [isImporting, setIsImporting] = useState(false)
    const [view, setView] = useState<"list" | "board">("list")
    const [showModal, setShowModal] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")

    // Form State
    const [formData, setFormData] = useState<{
        id: string;
        title: string;
        description: string;
        project_id: string;
        status: Database["public"]["Enums"]["task_status"];
        priority: string;
        start_date: string;
        due_date: string;
        assigned_to: string;
        estimated_hours: number;
    }>({
        id: "",
        title: "",
        description: "",
        project_id: "",
        status: "pending",
        priority: "medium",
        start_date: "",
        due_date: "",
        assigned_to: "",
        estimated_hours: 0
    })




    useEffect(() => {
        fetchClientsWithTaskCount()
        fetchProjects()
    }, [])

    useEffect(() => {
        if (selectedClient) {
            fetchTasks()
        }
    }, [selectedClient, filterStatus])



    const fetchClientsWithTaskCount = async () => {
        setLoading(true)
        try {
            const { data: clientsData } = await supabase.from("clients").select("*").order("name")
            if (!clientsData) return

            // Para cada cliente, contar tareas
            const clientsWithCount = await Promise.all(clientsData.map(async (client) => {
                // Obtenemos los proyectos de este cliente
                const { data: pjs } = await supabase.from("projects").select("id").eq("client_id", client.id)
                const projectIds = pjs?.map(p => p.id) || []

                let query = supabase
                    .from("tasks")
                    .select("id", { count: 'exact', head: true })

                if (projectIds.length > 0) {
                    query = query.or(`client_id.eq.${client.id},project_id.in.(${projectIds.join(',')})`)
                } else {
                    query = query.eq("client_id", client.id)
                }

                const { count } = await query
                return { ...client, taskCount: count || 0 }
            }))

            setClients(clientsWithCount)
        } catch (error) {
            console.error("Error fetching clients:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTasks = async () => {
        try {
            let query = supabase
                .from("tasks")
                .select("*, projects(name, client_id), task_assignments(profiles(full_name))")

            if (selectedClient && selectedClient.id !== 'all') {
                // Obtenemos los proyectos de este cliente para filtrar las tareas
                const { data: pjs } = await supabase.from("projects").select("id").eq("client_id", selectedClient.id)
                const projectIds = pjs?.map(p => p.id) || []

                if (projectIds.length > 0) {
                    query = query.or(`client_id.eq.${selectedClient.id},project_id.in.(${projectIds.join(',')})`)
                } else {
                    query = query.eq("client_id", selectedClient.id)
                }
            }

            query = query.order("created_at", { ascending: false })

            if (filterStatus !== "all") {
                query = query.eq("status", filterStatus)
            }

            const { data, error } = await query
            if (error) throw error
            setTasks(data as any || [])
        } catch (error) {
            console.error("Error fetching tasks:", error)
        }
    }

    const handleUpdateTaskStatus = async (taskId: string, newStatus: Database["public"]["Enums"]["task_status"] | null) => {
        if (!newStatus) return
        try {
            const { error } = await supabase
                .from("tasks")
                .update({ status: newStatus })
                .eq("id", taskId)

            if (error) throw error

            // Optimistic update
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

            // Cascade status to subtasks if status is finished or cancelled
            if (newStatus === "finished" || newStatus === "cancelled") {
                await supabase
                    .from("tasks")
                    .update({ status: newStatus })
                    .eq("parent_task_id", taskId)

                // Update UI
                setTasks(prev => prev.map(t =>
                    t.parent_task_id === taskId ? { ...t, status: newStatus } : t
                ))
            }
        } catch (error) {
            console.error("Error updating task status:", error)
            alert("Error al actualizar estado")
            fetchTasks()
        }
    }

    const fetchProjects = async () => {
        // In a real app, strict RLS would limit this. 
        // Admin gets all, User gets assigned.
        // For now, listing all active projects for simplicity or assuming RLS handles it.
        const { data } = await supabase.from("projects").select("*").eq("status", "active")
        setProjects(data || [])
    }





    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro? Esto eliminará la tarea.")) return;
        try {
            const { error } = await supabase.from("tasks").delete().eq("id", id)
            if (error) throw error
            fetchTasks()
        } catch (error) {
            console.error("Error deleting task", error)
            alert("No se pudo eliminar. Verifique que no tenga registros de tiempo asociados.")
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'finished': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'high': return <span className="text-red-500 font-bold">!!!</span>
            case 'medium': return <span className="text-yellow-500 font-bold">!!</span>
            case 'low': return <span className="text-blue-500 font-bold">!</span>
            default: return null
        }
    }

    const handleExportTemplate = () => {
        const template = [
            {
                "Título": "Mantenimiento General",
                "Descripción": "Revisión de servidores",
                "Fecha Inicio": "2026-01-21",
                "Fecha Fin": "2026-01-25",
                "Prioridad": "medium",
                "Proyecto": "", // Vacío para tarea general del cliente
                "Tarea Madre": ""
            }
        ]
        const ws = XLSX.utils.json_to_sheet(template)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla Tareas")
        XLSX.writeFile(wb, `Plantilla_Tareas_${selectedClient?.name || 'Cliente'}.xlsx`)
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedClient) return

        setIsImporting(true)
        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheet = workbook.Sheets[workbook.SheetNames[0]]
                const json: any[] = XLSX.utils.sheet_to_json(sheet)

                for (const row of json) {
                    // Buscar proyecto si se especificó
                    let projectId = null
                    if (row["Proyecto"]) {
                        const { data: proj } = await supabase
                            .from("projects")
                            .select("id")
                            .eq("client_id", selectedClient.id)
                            .ilike("name", row["Proyecto"])
                            .maybeSingle()
                        if (proj) projectId = proj.id
                    }

                    await supabase.from("tasks").insert([{
                        title: row["Título"] || "Sin título",
                        description: row["Descripción"] || "",
                        client_id: selectedClient.id,
                        project_id: projectId,
                        start_date: row["Fecha Inicio"] || null,
                        due_date: row["Fecha Fin"] || null,
                        priority: row["Prioridad"] || "medium",
                        status: "pending"
                    }])
                }
                alert("Importación exitosa")
                fetchTasks()
                fetchClientsWithTaskCount()
            } catch (err) {
                console.error(err)
                alert("Error al importar")
            } finally {
                setIsImporting(false)
                e.target.value = ""
            }
        }
        reader.readAsArrayBuffer(file)
    }

    if (loading) return <div className="flex h-64 items-center justify-center dark:text-white">Cargando...</div>

    if (!selectedClient) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold dark:text-white">Gestión de Tareas</h1>
                        <p className="text-slate-500">Selecciona una empresa para gestionar sus tareas.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div
                        onClick={() => setSelectedClient({ id: 'all', name: 'Todas las Empresas' })}
                        className="group cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-6 shadow-sm transition-all hover:border-blue-500 hover:bg-white dark:border-blue-900/30 dark:bg-blue-900/10 dark:hover:bg-slate-900"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                            <Kanban className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold dark:text-white group-hover:text-blue-500 transition-colors">Vista Global</h3>
                        <p className="mt-1 text-sm text-slate-500 italic">Ver todas las tareas</p>
                    </div>

                    {clients.map(client => (
                        <div
                            key={client.id}
                            onClick={() => setSelectedClient(client)}
                            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold dark:text-white group-hover:text-blue-500 transition-colors">{client.name}</h3>
                            <div className="mt-2 flex items-center justify-between text-sm">
                                <span className="text-slate-500 uppercase font-semibold text-xs tracking-wider">Tareas totales</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {client.taskCount}
                                </span>
                            </div>
                        </div>
                    ))}
                    {clients.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                            No hay clientes registrados en el sistema.
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const filteredTasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.projects?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => {
                        setSelectedClient(null)
                        fetchClientsWithTaskCount()
                    }}
                    className="flex w-fit items-center gap-2 text-sm text-slate-500 hover:text-blue-500 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Volver a Empresas
                </button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 dark:bg-blue-900/30">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold dark:text-white">{selectedClient.name}</h1>
                            <p className="text-sm text-slate-500">Gestión de tareas generales y por proyecto</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportTemplate}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                            <Download className="h-4 w-4" />
                            Plantilla
                        </button>

                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportExcel}
                                className="absolute inset-0 cursor-pointer opacity-0"
                                disabled={isImporting}
                            />
                            <button
                                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-400"
                                disabled={isImporting}
                            >
                                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Importar
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setFormData({
                                    id: "",
                                    title: "",
                                    description: "",
                                    project_id: "",
                                    status: "pending",
                                    priority: "medium",
                                    start_date: "",
                                    due_date: "",
                                    assigned_to: "",
                                    estimated_hours: 0
                                })
                                setShowModal(true)
                            }}
                            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all hover:scale-105"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva Tarea
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por título o proyecto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="in_progress">En Proceso</option>
                        <option value="finished">Finalizado</option>
                        <option value="cancelled">Suspendido/Cancelado</option>
                    </select>

                    <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:bg-slate-800 dark:border-slate-700">
                        <button
                            onClick={() => setView("list")}
                            className={`rounded-md px-3 py-1.5 transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setView("board")}
                            className={`rounded-md px-3 py-1.5 transition-all ${view === 'board' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            <Kanban className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* List View */}
            {view === 'list' && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Detalle de Tarea</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Contexto / Proyecto</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Responsable</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Estado</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Entrega</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredTasks.map(task => (
                                <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold dark:text-white text-base">{task.title}</span>
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                {getPriorityIcon(task.priority || 'medium')} {(task.priority || 'medium').toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {task.projects?.name ? (
                                            <span className="rounded bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                                                {task.projects.name}
                                            </span>
                                        ) : (
                                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase">
                                                Tarea General
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1 -space-x-2">
                                            {task.task_assignments && task.task_assignments.length > 0 ? (
                                                task.task_assignments.map((assignment, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="h-7 w-7 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold border-2 border-slate-100 dark:border-slate-700 shadow-sm"
                                                        title={assignment.profiles?.full_name || "???"}
                                                    >
                                                        {(assignment.profiles?.full_name || "??").slice(0, 2).toUpperCase()}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sin asignar</span>
                                            )}
                                            {task.task_assignments && task.task_assignments.length > 0 && (
                                                <span className="ml-2 text-xs truncate max-w-[100px]">
                                                    {task.task_assignments.map(a => a.profiles?.full_name).join(", ")}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusColor(task.status || 'pending')}`}>
                                            {(task.status || 'pending').replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : "-"}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setFormData({
                                                        id: task.id,
                                                        title: task.title,
                                                        description: task.description || "",
                                                        project_id: task.project_id || "",
                                                        status: task.status || "pending",
                                                        priority: task.priority || "medium",
                                                        start_date: task.start_date || "",
                                                        due_date: task.due_date || "",
                                                        assigned_to: task.assigned_to || "",
                                                        estimated_hours: task.estimated_hours || 0
                                                    })
                                                    setShowModal(true)
                                                }}
                                                className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(task.id)}
                                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTasks.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">No se encontraron tareas para los criterios seleccionados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Board View */}
            {view === 'board' && (
                <TaskKanban
                    tasks={filteredTasks}
                    onUpdateStatus={handleUpdateTaskStatus}
                    onEdit={(task) => {
                        setFormData({
                            id: task.id,
                            title: task.title,
                            description: task.description || "",
                            project_id: task.project_id || "",
                            status: task.status || "pending",
                            priority: task.priority || "medium",
                            start_date: task.start_date || "",
                            due_date: task.due_date || "",
                            assigned_to: task.assigned_to || "",
                            estimated_hours: task.estimated_hours || 0
                        })
                        setShowModal(true)
                    }}
                />
            )}


            {/* Create Task Modal */}
            <TaskModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={() => {
                    fetchTasks()
                    fetchClientsWithTaskCount()
                }}
                initialData={formData as any}
                projects={projects}
                fixedClientId={selectedClient?.id}
            />
        </div>
    )
}
