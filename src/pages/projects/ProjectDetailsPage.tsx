import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import type { Task, Database } from "@/types/database.types"
import { ChevronLeft, Plus, Calendar, List, Kanban, Search, Filter, X, Download, Upload, Loader2 } from "lucide-react"
import * as XLSX from 'xlsx'

import { TaskModal } from "@/components/projects/TaskModal"
import { TaskKanban } from "@/components/projects/TaskKanban"
import { TaskGantt } from "@/components/projects/TaskGantt"
import { formatLocalDate } from "@/utils/dateUtils"

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
    clients?: { name: string }
}

export default function ProjectDetailsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [project, setProject] = useState<Project | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [viewMode, setViewMode] = useState<"list" | "kanban" | "gantt">("kanban")
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Partial<Task> | undefined>(undefined)

    // Filters State
    const [searchQuery, setSearchQuery] = useState("")
    const [filterResponsible, setFilterResponsible] = useState("")
    const [filterType, setFilterType] = useState<"all" | "parents" | "subtasks">("all")
    const [filterStatus, setFilterStatus] = useState<Exclude<Task["status"], null> | "all">("all")
    const [dateRange, setDateRange] = useState({ start: "", end: "" })
    const [projectUsers, setProjectUsers] = useState<any[]>([])
    const [showFilters, setShowFilters] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [taskProgress, setTaskProgress] = useState<Record<string, number>>({})


    const fetchProjectDetails = async () => {
        try {
            // Fetch Project Info
            const { data: projectData, error: projError } = await supabase
                .from("projects")
                .select("*, clients(name)")
                .eq("id", id!)
                .single()

            if (projError) throw projError
            setProject(projectData)

            // Fetch Tasks (simple query, no join)
            const { data: tasksData, error: tasksError } = await supabase
                .from("tasks")
                .select("*")
                .eq("project_id", id!)
                .order("created_at", { ascending: false })

            if (tasksError) throw tasksError
            const tasksData_ = tasksData || []
            setTasks(tasksData_)

            // Fetch Time Logs to calculate progress
            const { data: logsData } = await supabase
                .from("time_logs")
                .select("task_id, hours_worked")
                .in("task_id", tasksData_.map(t => t.id))

            if (logsData) {
                const progressMap: Record<string, number> = {}
                tasksData_.forEach(task => {
                    const taskLogs = logsData.filter(l => l.task_id === task.id)
                    const worked = taskLogs.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0)
                    const estimated = task.estimated_hours || 0
                    progressMap[task.id] = estimated > 0 ? Math.min(Math.round((worked / estimated) * 100), 100) : 0
                })
                setTaskProgress(progressMap)
            }

            // Get project team members from project_assignments (same query as ProjectsPage.tsx)
            const { data: teamAssignments, error: teamError } = await supabase
                .from("project_assignments")
                .select("*, profiles(*)")
                .eq("project_id", id!)

            console.log('[DEBUG] Team assignments data:', teamAssignments)
            console.log('[DEBUG] Team assignments error:', teamError)

            if (teamAssignments && teamAssignments.length > 0) {
                const teamUsers = teamAssignments
                    .filter((a: any) => a.profiles)
                    .map((a: any) => ({
                        id: a.user_id,
                        full_name: a.profiles.full_name || "Sin nombre",
                        avatar_url: a.profiles.avatar_url
                    }))
                console.log('[DEBUG] Team users:', teamUsers)
                setProjectUsers(teamUsers)
            }

        } catch (error) {
            console.error("Error fetching project details:", error)
        } finally {
            setLoading(false)
        }
    }



    const filteredTasks = useMemo(() => {
        return tasks.filter((task: Task) => {
            // Search Query
            if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false

            // Responsible Filter
            if (filterResponsible && task.assigned_to !== filterResponsible) return false

            // Type Filter
            if (filterType === 'parents' && task.parent_task_id) return false
            if (filterType === 'subtasks' && !task.parent_task_id) return false

            // Status Filter
            if (filterStatus !== 'all' && task.status !== filterStatus) return false

            // Date Range Filter
            if (dateRange.start) {
                const taskDate = task.start_date || task.created_at
                if (taskDate && new Date(taskDate) < new Date(dateRange.start)) return false
            }
            if (dateRange.end) {
                const taskDate = task.due_date || task.start_date
                if (taskDate && new Date(taskDate) > new Date(dateRange.end)) return false
            }

            return true
        })
    }, [tasks, searchQuery, filterResponsible, filterType, filterStatus, dateRange])

    useEffect(() => {
        if (id) {
            fetchProjectDetails()
        }
    }, [id])


    const updateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
        // Optimistic UI update for parent task
        const previousTasks = [...tasks]
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        try {
            // Update parent task
            const { error } = await supabase
                .from("tasks")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", taskId)

            if (error) {
                setTasks(previousTasks) // Revert on error
                console.error("Error updating status:", error)
                return
            }

            // Cascade status to subtasks if status is finished or cancelled
            if (newStatus === "finished" || newStatus === "cancelled") {
                // Update subtasks in database
                await supabase
                    .from("tasks")
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq("parent_task_id", taskId)

                // Update UI optimistically
                setTasks(prev => prev.map(t =>
                    t.parent_task_id === taskId ? { ...t, status: newStatus } : t
                ))
            }
        } catch (err) {
            setTasks(previousTasks)
            console.error(err)
        }
    }

    const updateTaskDates = async (updatedTask: Task) => {
        const previousTasks = [...tasks]
        setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t))

        try {
            const { error } = await supabase
                .from("tasks")
                .update({
                    start_date: updatedTask.start_date,
                    due_date: updatedTask.due_date,
                    updated_at: new Date().toISOString()
                })
                .eq("id", updatedTask.id)

            if (error) {
                setTasks(previousTasks)
                console.error("Error updating dates:", error)
            }
        } catch (err) {
            setTasks(previousTasks)
            console.error(err)
        }
    }

    const handleExportTemplate = () => {
        const template = [
            {
                "Título": "Ejemplo Tarea Madre",
                "Descripción": "Descripción de la tarea",
                "Fecha Inicio": "2026-01-21",
                "Fecha Fin": "2026-02-10",
                "Prioridad": "medium",
                "Tarea Madre": ""
            },
            {
                "Título": "Ejemplo Subtarea",
                "Descripción": "Descripción de la subtarea",
                "Fecha Inicio": "2026-01-22",
                "Fecha Fin": "2026-01-25",
                "Prioridad": "low",
                "Tarea Madre": "Ejemplo Tarea Madre"
            }
        ]

        const ws = XLSX.utils.json_to_sheet(template)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla Tareas")
        XLSX.writeFile(wb, `Plantilla_Importacion_${project?.name || 'Proyecto'}.xlsx`)
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !id) return

        setIsImporting(true)
        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const json: any[] = XLSX.utils.sheet_to_json(worksheet)

                if (json.length === 0) {
                    alert("La planilla está vacía")
                    return
                }

                // 1. Identificar Tareas Madre (sin Tarea Madre especificada)
                const motherTasksData = json.filter(row => !row["Tarea Madre"])
                const subtasksData = json.filter(row => row["Tarea Madre"])

                const createdMotherTasks: Record<string, string> = {} // Nombre -> ID

                // Crear Tareas Madre
                for (const row of motherTasksData) {
                    const taskToInsert = {
                        title: row["Título"] || "Sin título",
                        description: row["Descripción"] || "",
                        project_id: id,
                        start_date: row["Fecha Inicio"] || null,
                        due_date: row["Fecha Fin"] || null,
                        priority: row["Prioridad"] || "medium",
                        status: "pending"
                    }

                    const { data: inserted, error } = await supabase
                        .from("tasks")
                        .insert([taskToInsert])
                        .select()
                        .single()

                    if (error) {
                        console.error(`Error creando tarea ${row["Título"]}:`, error)
                        continue
                    }
                    createdMotherTasks[row["Título"]] = inserted.id
                }

                // Crear Subtareas
                for (const row of subtasksData) {
                    const parentName = row["Tarea Madre"]
                    let parentId = createdMotherTasks[parentName]

                    // Si el padre no se creó en este lote, buscarlo en la base de datos (por nombre en este proyecto)
                    if (!parentId) {
                        const { data: existingParent } = await supabase
                            .from("tasks")
                            .select("id")
                            .eq("project_id", id)
                            .eq("title", parentName)
                            .is("parent_task_id", null)
                            .maybeSingle()

                        if (existingParent) parentId = existingParent.id
                    }

                    const subtaskToInsert = {
                        title: row["Título"] || "Sin título",
                        description: row["Descripción"] || "",
                        project_id: id,
                        parent_task_id: parentId || null,
                        start_date: row["Fecha Inicio"] || null,
                        due_date: row["Fecha Fin"] || null,
                        priority: row["Prioridad"] || "medium",
                        status: "pending"
                    }

                    const { error } = await supabase.from("tasks").insert([subtaskToInsert])
                    if (error) console.error(`Error creando subtarea ${row["Título"]}:`, error)
                }

                alert("Importación completada correctamente")
                fetchProjectDetails()
            } catch (error) {
                console.error("Error procesando Excel:", error)
                alert("Error al procesar el archivo Excel")
            } finally {
                setIsImporting(false)
                e.target.value = "" // Reset input
            }
        }
        reader.readAsArrayBuffer(file)
    }

    if (loading) return <div className="p-8">Cargando proyecto...</div>
    if (!project) return <div className="p-8">Proyecto no encontrado</div>

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate("/projects")}
                    className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Volver a Proyectos
                </button>

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold dark:text-white">{project.name}</h1>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase text-white
                                ${project.status === 'active' ? 'bg-green-500' : 'bg-slate-500'}`}>
                                {project.status || 'active'}
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">{project.clients?.name}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportTemplate}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
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
                                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-400"
                                disabled={isImporting}
                            >
                                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Importar Excel
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setSelectedTask(undefined)
                                setShowModal(true)
                            }}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva Tarea
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar tarea o subtarea por nombre..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors
                            ${showFilters ? 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}
                    >
                        <Filter className="h-4 w-4" />
                        Filtros
                    </button>

                    <div className="flex items-center gap-1 ml-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                            title="Tablero"
                        >
                            <Kanban className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("gantt")}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'gantt' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                            title="Cronograma"
                        >
                            <Calendar className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                            title="Lista"
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Responsable</label>
                            <select
                                value={filterResponsible}
                                onChange={(e) => setFilterResponsible(e.target.value)}
                                className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                                <option value="">Todos los responsables</option>
                                {projectUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Tipo de Tarea</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value as any)}
                                className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                                <option value="all">Todas</option>
                                <option value="parents">Solo Tareas Madre</option>
                                <option value="subtasks">Solo Subtareas</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Estado</label>
                            <select
                                value={filterStatus || "all"}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                                <option value="all">Cualquier estado</option>
                                <option value="pending">Pendiente</option>
                                <option value="in_progress">En Progreso</option>
                                <option value="review">En Revisión</option>
                                <option value="finished">Finalizado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Desde</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Hasta</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </div>
                    </div>
                )}

            </div>


            {/* Content Area */}
            <div className="min-h-[500px]">
                {viewMode === 'kanban' && (
                    <TaskKanban
                        tasks={filteredTasks}
                        onUpdateStatus={updateTaskStatus}
                        taskProgress={taskProgress}
                        onEdit={(task) => {
                            setSelectedTask(task)
                            setShowModal(true)
                        }}
                    />
                )}

                {viewMode === 'gantt' && (
                    <TaskGantt tasks={filteredTasks} onDateChange={updateTaskDates} />
                )}

                {viewMode === 'list' && (
                    <div className="rounded-xl border bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        {/* Basic List Reuse or Component */}
                        <div className="divide-y dark:divide-slate-800">
                            {filteredTasks.map(t => (
                                <div key={t.id} className="border-b py-3 last:border-0 dark:border-slate-800">
                                    <div
                                        onClick={() => {
                                            setSelectedTask(t)
                                            setShowModal(true)
                                        }}
                                        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2 w-2 rounded-full ${t.status === 'finished' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-blue-500' : t.status === 'review' ? 'bg-purple-500' : 'bg-yellow-500'}`} />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium dark:text-white">{t.title}</span>
                                                    {t.parent_task_id && (
                                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                            Subtarea
                                                        </span>
                                                    )}
                                                </div>
                                                {t.due_date && <p className="text-[10px] text-slate-400">Entrega: {formatLocalDate(t.due_date)}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-medium text-slate-500 uppercase">{t.status || 'pending'}</span>
                                            {t.assigned_to && (
                                                <div className="h-7 w-7 rounded-full bg-slate-100 text-[10px] flex items-center justify-center text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                                                    {t.assigned_to.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <TaskModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={fetchProjectDetails}
                initialData={selectedTask}
                fixedProjectId={id!}
                fixedClientId={project?.client_id}
            />
        </div>
    )
}

