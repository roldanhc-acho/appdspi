import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { Plus, X, Trash2, ChevronRight, Clock } from "lucide-react"
import { parseISO, isBefore } from "date-fns"
import { countWorkingDays } from "@/utils/holidays"
import { formatDateForInput, prepareDateForSave } from "@/utils/dateUtils"


type Task = Database["public"]["Tables"]["tasks"]["Row"]
type Project = Database["public"]["Tables"]["projects"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Client = Database["public"]["Tables"]["clients"]["Row"]

type TaskModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialData?: Partial<Task>
    projects?: Project[]
    fixedProjectId?: string
    fixedClientId?: string
}

export function TaskModal({ isOpen, onClose, onSuccess, initialData, projects = [], fixedProjectId, fixedClientId }: TaskModalProps) {
    const [formData, setFormData] = useState({
        id: "",
        title: "",
        description: "",
        project_id: fixedProjectId || "",
        client_id: fixedClientId || "",
        status: "todo",
        priority: "medium",
        start_date: "",
        due_date: "",
        assigned_to: "", // Legacy support
        assigned_users: [] as string[],
        estimated_hours: 0
    })
    const [subtasks, setSubtasks] = useState<{ title: string; isNew: boolean; id?: string; estimated_hours?: number; start_date?: string | null; due_date?: string | null }[]>([])
    const [newSubtask, setNewSubtask] = useState("")
    const [projectUsers, setProjectUsers] = useState<Profile[]>([])
    const [availableProjects, setAvailableProjects] = useState<Project[]>(projects)
    const [clients, setClients] = useState<Client[]>([])
    const [parentTaskName, setParentTaskName] = useState<string>("")
    const [allUsers, setAllUsers] = useState<Profile[]>([])
    const [clientUsers, setClientUsers] = useState<Profile[]>([])

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    id: initialData.id || "",
                    title: initialData.title || "",
                    description: initialData.description || "",
                    project_id: initialData.project_id || fixedProjectId || "",
                    client_id: (initialData as any).client_id || fixedClientId || "",
                    status: initialData.status || "pending",
                    priority: initialData.priority || "medium",
                    start_date: formatDateForInput(initialData.start_date),
                    due_date: formatDateForInput(initialData.due_date),
                    assigned_to: initialData.assigned_to || "",
                    assigned_users: [],
                    estimated_hours: initialData.estimated_hours || 0
                })
                if (initialData.id) {
                    fetchSubtasks(initialData.id)
                    fetchTaskAssignments(initialData.id)
                }
                if (initialData.parent_task_id) fetchParentInfo(initialData.parent_task_id)
            } else {
                setFormData({
                    id: "",
                    title: "",
                    description: "",
                    project_id: fixedProjectId || "",
                    client_id: fixedClientId || "",
                    status: "pending",
                    priority: "medium",
                    start_date: "",
                    due_date: "",
                    assigned_to: "",
                    assigned_users: [],
                    estimated_hours: 0
                })
                setSubtasks([])
                setParentTaskName("")
            }
            fetchClients()
            fetchAllUsers()
            if (fixedProjectId) fetchProjectUsers(fixedProjectId)
        }
    }, [isOpen, initialData, fixedProjectId, fixedClientId])

    useEffect(() => {
        if (projects.length === 0 && !fixedProjectId && isOpen) {
            fetchProjects()
        }
    }, [isOpen])

    useEffect(() => {
        if (formData.client_id) {
            fetchProjects()
            fetchClientUsers(formData.client_id)
        } else if (!fixedProjectId) {
            setAvailableProjects([])
            setClientUsers([])
        }
    }, [formData.client_id])

    useEffect(() => {
        if (formData.project_id) fetchProjectUsers(formData.project_id)
    }, [formData.project_id])

    // Sincronizar fechas de tarea madre con subtareas
    useEffect(() => {
        const isParent = !initialData?.parent_task_id && subtasks.length > 0
        if (isParent) {
            const startDates = subtasks.map(s => s.start_date).filter(Boolean) as string[]
            const dueDates = subtasks.map(s => s.due_date).filter(Boolean) as string[]

            if (startDates.length > 0 || dueDates.length > 0) {
                const minStart = startDates.length > 0 ? startDates.sort()[0] : formData.start_date
                const maxEnd = dueDates.length > 0 ? dueDates.sort().reverse()[0] : formData.due_date

                if (minStart !== formData.start_date || maxEnd !== formData.due_date) {
                    setFormData(prev => ({
                        ...prev,
                        start_date: minStart,
                        due_date: maxEnd
                    }))
                }
            }
        }
    }, [subtasks, initialData?.parent_task_id])

    const fetchClients = async () => {
        const { data } = await supabase.from("clients").select("*").order("name")
        setClients(data || [])
    }

    const fetchAllUsers = async () => {
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .neq("is_active", false)
            .order("full_name")
        setAllUsers(data || [])
    }

    const fetchProjects = async () => {
        const { data } = await supabase.from("projects").select("*").eq("status", "active")
        if (formData.client_id) {
            setAvailableProjects(data?.filter(p => p.client_id === formData.client_id) || [])
        } else {
            setAvailableProjects(data || [])
        }
    }

    const fetchClientUsers = async (clientId: string) => {
        const { data } = await supabase
            .from("client_assignments")
            .select("profiles(*)")
            .eq("client_id", clientId)

        const users = data?.map((d: any) => d.profiles).filter((u: any) => u && u.is_active !== false) || []
        setClientUsers(users)
    }

    const fetchProjectUsers = async (projectId: string) => {
        const { data } = await supabase
            .from("project_assignments")
            .select("profiles(*)")
            .eq("project_id", projectId)

        const users = data?.map((d: any) => d.profiles).filter((u: any) => u && u.is_active !== false) || []
        setProjectUsers(users)
    }

    const fetchParentInfo = async (parentId: string) => {
        const { data } = await supabase
            .from("tasks")
            .select("title, client_id, project_id")
            .eq("id", parentId)
            .single()

        if (data) {
            setParentTaskName(data.title)
            setFormData(prev => ({
                ...prev,
                client_id: prev.client_id || data.client_id || "",
                project_id: prev.project_id || data.project_id || ""
            }))
        }
    }

    const fetchSubtasks = async (taskId: string) => {
        const { data } = await supabase
            .from("tasks")
            .select("id, title, estimated_hours, start_date, due_date")
            .eq("parent_task_id", taskId)

        setSubtasks(data?.map((t: any) => ({
            title: t.title,
            isNew: false,
            id: t.id,
            estimated_hours: t.estimated_hours || 0,
            start_date: t.start_date,
            due_date: t.due_date
        })) || [])
    }

    const fetchTaskAssignments = async (taskId: string) => {
        const { data } = await supabase
            .from("task_assignments")
            .select("user_id")
            .eq("task_id", taskId)

        if (data) {
            setFormData(prev => ({
                ...prev,
                assigned_users: data.map(d => d.user_id)
            }))
        }
    }

    const calculateEstimatedHours = (start: string, end: string, assigned: string) => {
        if (!start || !end || !assigned) return 0
        const startDate = parseISO(start)
        const endDate = parseISO(end)

        if (isBefore(endDate, startDate)) return 0

        const workingDays = countWorkingDays(startDate, endDate)
        return workingDays * 9
    }

    const totalEstimated = useMemo(() => {
        const isSubtask = !!initialData?.parent_task_id
        if (isSubtask) {
            return calculateEstimatedHours(formData.start_date, formData.due_date, formData.assigned_users.length > 0 ? "assigned" : "")
        } else {
            // Tarea madre: suma de subtareas reales
            return subtasks.reduce((sum, st) => sum + (st.estimated_hours || 0), 0)
        }
    }, [formData.start_date, formData.due_date, formData.assigned_users, subtasks, initialData?.parent_task_id])

    const handleAddSubtask = () => {
        if (!newSubtask.trim()) return
        setSubtasks([...subtasks, { title: newSubtask, isNew: true, estimated_hours: 0 }])
        setNewSubtask("")
    }

    const handleDelete = async () => {
        if (!formData.id || !confirm("¿Está seguro de que desea eliminar esta tarea y sus subtareas?")) return
        try {
            await supabase.from("tasks").delete().eq("parent_task_id", formData.id)
            const { error } = await supabase.from("tasks").delete().eq("id", formData.id)
            if (error) throw error

            onSuccess()
            onClose()
        } catch (error) {
            console.error("Error deleting task:", error)
            alert("Error al eliminar la tarea")
        }
    }

    const handleRemoveSubtask = async (idx: number) => {
        const sub = subtasks[idx]
        if (!sub.isNew && sub.id) {
            if (!confirm("¿Desea eliminar esta subtarea del sistema?")) return
            const { error } = await supabase.from("tasks").delete().eq("id", sub.id)
            if (error) {
                alert("Error al eliminar la subtarea")
                return
            }
        }
        setSubtasks(subtasks.filter((_, i) => i !== idx))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            let taskId = formData.id

            const taskData: any = {
                title: formData.title,
                description: formData.description,
                project_id: formData.project_id || null,
                client_id: formData.client_id || null,
                status: formData.status as any,
                priority: formData.priority,
                start_date: prepareDateForSave(formData.start_date),
                due_date: prepareDateForSave(formData.due_date),
                assigned_to: formData.assigned_users[0] || null, // Keep legacy field updated with first user
                estimated_hours: formData.estimated_hours
            }

            if (taskId) {
                const { error } = await supabase.from("tasks").update(taskData).eq("id", taskId)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from("tasks").insert([taskData]).select().single()
                if (error) throw error
                taskId = data.id
            }

            // Sync assignments
            if (taskId) {
                // Delete removed assignments
                await supabase.from("task_assignments").delete().eq("task_id", taskId)

                // Insert new assignments
                if (formData.assigned_users.length > 0) {
                    const { error: assignError } = await supabase.from("task_assignments").insert(
                        formData.assigned_users.map(userId => ({
                            task_id: taskId,
                            user_id: userId
                        }))
                    )
                    if (assignError) throw assignError
                }
            }

            // Handle Subtasks (only for parent tasks)
            if (!initialData?.parent_task_id) {
                const newSubtasks = subtasks.filter((s: any) => s.isNew)
                if (newSubtasks.length > 0) {
                    const { error: subError } = await supabase.from("tasks").insert(
                        newSubtasks.map((s: any) => ({
                            title: s.title,
                            project_id: formData.project_id || null,
                            client_id: formData.client_id || null,
                            parent_task_id: taskId,
                            status: 'pending',
                            estimated_hours: 0
                        }))
                    )
                    if (subError) throw subError
                }
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error("Error saving task:", error)
            alert(`Error al guardar la tarea: ${error.message || "Error desconocido"}`)
        }
    }


    if (!isOpen) return null

    const isSubtaskView = !!initialData?.parent_task_id

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold dark:text-white">
                            {formData.id
                                ? (isSubtaskView ? "Editar Subtarea" : "Editar Tarea")
                                : "Nueva Tarea"}
                        </h2>
                        {isSubtaskView && (
                            <p className="text-xs text-slate-500 flex items-center mt-1">
                                <ChevronRight className="h-3 w-3 mr-1" />
                                Subtarea de: <span className="ml-1 font-medium text-slate-400">{parentTaskName || "Cargando..."}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {formData.id && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar tarea"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        )}
                        <button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button>
                    </div>
                </div>


                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">Título</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        />
                    </div>

                    {/* Mostrar siempre selección de empresa para tareas principales, permitiendo cambiarla */}
                    {!isSubtaskView && (
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Empresa (Cliente)</label>
                            <select
                                required
                                value={formData.client_id}
                                onChange={(e) => setFormData({ ...formData, client_id: e.target.value, project_id: "" })}
                                className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value="">Seleccionar Empresa</option>
                                {clients.map((c: Client) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {!fixedProjectId && !isSubtaskView && (
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Proyecto (Opcional)</label>
                            <select
                                value={formData.project_id}
                                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                disabled={!formData.client_id}
                            >
                                <option value="">Tarea General (Sin Proyecto)</option>
                                {availableProjects.map((p: Project) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="col-span-2">
                        <label className="block text-sm font-medium dark:text-gray-300">Asignado a (Múltiple)</label>
                        <div className="mt-2 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded border p-3 dark:bg-slate-800 dark:border-slate-700">
                            {(formData.project_id ? projectUsers : (formData.client_id ? clientUsers : allUsers)).map((u: Profile) => (
                                <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1 rounded transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.assigned_users.includes(u.id)}
                                        onChange={(e) => {
                                            const userId = u.id;
                                            setFormData(prev => ({
                                                ...prev,
                                                assigned_users: e.target.checked
                                                    ? [...prev.assigned_users, userId]
                                                    : prev.assigned_users.filter(id => id !== userId)
                                            }));
                                        }}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs dark:text-slate-300 truncate">{u.full_name}</span>
                                </label>
                            ))}
                            {(formData.project_id ? projectUsers : (formData.client_id ? clientUsers : allUsers)).length === 0 && (
                                <p className="col-span-2 text-xs text-slate-500 italic py-2 text-center">
                                    {formData.client_id ? "No hay usuarios activos en este equipo" : "Elija empresa primero"}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Estado</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value="pending">Pendiente</option>
                                <option value="in_progress">En Progreso</option>
                                <option value="finished">Finalizado</option>
                                <option value="cancelled">Suspendido/Cancelado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Prioridad</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value="low">Baja</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Horas Estimadas</label>
                            <div className="flex items-center">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={formData.estimated_hours}
                                    onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                                {initialData?.parent_task_id && (
                                    <div className="ml-2 text-xs text-slate-400 group relative">
                                        <Clock className="h-4 w-4" />
                                        <span className="absolute bottom-full right-0 w-max rounded bg-black px-2 py-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            Sugerido por fechas: {totalEstimated}h
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">
                                Fecha Inicio {!initialData?.parent_task_id && subtasks.length > 0 && "(Auto)"}
                            </label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className={`w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white ${!initialData?.parent_task_id && subtasks.length > 0 ? 'opacity-70 cursor-not-allowed' : ''}`}
                                disabled={!initialData?.parent_task_id && subtasks.length > 0}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">
                                Fecha Entrega {!initialData?.parent_task_id && subtasks.length > 0 && "(Auto)"}
                            </label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                className={`w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white ${!initialData?.parent_task_id && subtasks.length > 0 ? 'opacity-70 cursor-not-allowed' : ''}`}
                                disabled={!initialData?.parent_task_id && subtasks.length > 0}
                            />
                        </div>
                    </div>
                    {!initialData?.parent_task_id && subtasks.length > 0 && (
                        <p className="text-[10px] text-blue-500 italic">
                            * Las fechas se sincronizan automáticamente con el rango de sus subtareas.
                        </p>
                    )}

                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            rows={3}
                        />
                    </div>

                    {/* Subtasks - Only for parent tasks */}
                    {!isSubtaskView && (
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Subtareas</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    value={newSubtask}
                                    onChange={(e) => setNewSubtask(e.target.value)}
                                    placeholder="Nueva subtarea..."
                                    className="flex-1 rounded border p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddSubtask}
                                    className="rounded bg-slate-100 p-2 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {subtasks.map((st, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between rounded bg-slate-50 p-2 text-sm dark:bg-slate-800/50 group">
                                        <span className="dark:text-slate-300">
                                            {st.isNew ? `[Nueva] ${st.title}` : st.title}
                                            {!st.isNew && st.estimated_hours && st.estimated_hours > 0 ? (
                                                <span className="ml-2 text-[10px] text-slate-500">({st.estimated_hours}h)</span>
                                            ) : null}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSubtask(idx)}
                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                            {formData.id ? "Guardar cambios" : "Crear Tarea"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
