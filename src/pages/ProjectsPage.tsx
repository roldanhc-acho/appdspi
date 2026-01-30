import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { Plus, Briefcase, Calendar, Users, X, Pencil, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
    clients: Database["public"]["Tables"]["clients"]["Row"] | null
}
type Client = Database["public"]["Tables"]["clients"]["Row"]

export default function ProjectsPage() {
    const { profile } = useAuth()
    const isAdmin = profile?.role === "admin"

    const [projects, setProjects] = useState<Project[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // Team Management State
    const [showTeamModal, setShowTeamModal] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [employees, setEmployees] = useState<Database["public"]["Tables"]["profiles"]["Row"][]>([])
    const [assignments, setAssignments] = useState<Database["public"]["Tables"]["project_assignments"]["Row"][]>([])
    const [selectedEmployee, setSelectedEmployee] = useState("")

    const [formData, setFormData] = useState({
        id: "",
        name: "",
        client_id: "",
        start_date: "",
        end_date: "",
        description: "" // Fixed typo in state init
    })

    useEffect(() => {
        fetchProjects()
        if (isAdmin) fetchClients()
    }, [isAdmin])

    const fetchProjects = async () => {
        try {
            const { data, error } = await supabase
                .from("projects")
                .select("*, clients(*)")
                .order("created_at", { ascending: false })

            if (error) throw error
            setProjects(data as any || [])
        } catch (error) {
            console.error("Error fetching projects:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchClients = async () => {
        const { data } = await supabase.from("clients").select("*").order("name")
        setClients(data || [])
    }

    const openTeamModal = async (project: Project) => {
        setSelectedProject(project)
        setShowTeamModal(true)
        const { data: users } = await supabase.from("profiles").select("*").order("full_name")
        setEmployees(users || [])
        fetchAssignments(project.id)
    }

    const fetchAssignments = async (projectId: string) => {
        const { data } = await supabase.from("project_assignments").select("*, profiles(*)").eq("project_id", projectId)
        setAssignments(data as any || [])
    }

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProject || !selectedEmployee) return
        try {
            const { error } = await supabase.from("project_assignments").insert({
                project_id: selectedProject.id,
                user_id: selectedEmployee
            })
            if (error) throw error
            fetchAssignments(selectedProject.id)
            setSelectedEmployee("")
        } catch (error: any) {
            if (error.code === '23505') alert("Usuario ya asignado")
            else alert("Error al asignar usuario")
        }
    }

    const handleUnassign = async (assignmentId: string) => {
        try {
            await supabase.from("project_assignments").delete().eq("id", assignmentId)
            if (selectedProject) fetchAssignments(selectedProject.id)
        } catch (error) {
            console.error(error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAdmin) return
        try {
            if (formData.id) {
                // Update
                const { error } = await supabase.from("projects").update({
                    name: formData.name,
                    client_id: formData.client_id,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null,
                    description: formData.description
                }).eq("id", formData.id)
                if (error) throw error
            } else {
                // Create
                const { error } = await supabase.from("projects").insert([{
                    name: formData.name,
                    client_id: formData.client_id,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null,
                    description: formData.description
                }])
                if (error) throw error
            }
            fetchProjects()
            setShowModal(false)
            setFormData({ id: "", name: "", client_id: "", start_date: "", end_date: "", description: "" })
        } catch (error) {
            alert("Error al guardar el proyecto")
            console.error(error)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation() // Prevent triggering card click if any
        if (!confirm("¿Estás seguro? Esto eliminará el proyecto y sus asignaciones.")) return;
        try {
            const { error } = await supabase.from("projects").delete().eq("id", id)
            if (error) throw error
            fetchProjects()
        } catch (error) {
            console.error(error)
            alert("No se pudo eliminar. Verifique que no tenga tareas asociadas.")
        }
    }

    if (loading) return <div>Cargando...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold dark:text-white">Proyectos</h1>
                {isAdmin && (
                    <button
                        onClick={() => {
                            setFormData({ id: "", name: "", client_id: "", start_date: "", end_date: "", description: "" })
                            setShowModal(true)
                        }}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Proyecto
                    </button>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                    <div key={project.id} className="flex flex-col rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-800 dark:border-slate-700">
                        <div className="flex items-start justify-between">
                            <div className="mb-2 flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-blue-500" />
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                    {project.clients?.name || "Cliente desconocido"}
                                </span>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {project.status}
                            </span>
                        </div>

                        <h3
                            onClick={() => window.location.href = `/projects/${project.id}`}
                            className="mb-2 text-lg font-bold cursor-pointer hover:text-blue-600"
                        >
                            {project.name}
                        </h3>
                        <p className="flex-1 text-sm text-slate-600 line-clamp-2 dark:text-slate-400">
                            {project.description}
                        </p>

                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                            {project.start_date && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{new Date(project.start_date).toLocaleDateString()}</span>
                                </div>
                            )}

                            {isAdmin && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openTeamModal(project)}
                                        className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                                        title="Equipo"
                                    >
                                        <Users className="h-3 w-3" />
                                        Equipo
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFormData({
                                                id: project.id,
                                                name: project.name,
                                                client_id: project.client_id,
                                                start_date: project.start_date || "",
                                                end_date: project.end_date || "",
                                                description: project.description || ""
                                            })
                                            setShowModal(true)
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-500"
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(project.id, e)}
                                        className="p-1 text-slate-400 hover:text-red-500"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-500">
                        No se encontraron proyectos.
                    </div>
                )}
            </div>

            {showModal && isAdmin && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
                        <h2 className="mb-4 text-xl font-bold dark:text-white">
                            {formData.id ? "Editar Proyecto" : "Nuevo Proyecto"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Nombre del Proyecto</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Cliente</label>
                                <select
                                    required
                                    value={formData.client_id}
                                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="">Seleccionar Cliente</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Fecha Fin</label>
                                    <input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        setFormData({ id: "", name: "", client_id: "", start_date: "", end_date: "", description: "" })
                                    }}
                                    className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                                >
                                    {formData.id ? "Guardar cambios" : "Crear Proyecto"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTeamModal && selectedProject && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">Team: {selectedProject.name}</h2>
                            <button onClick={() => setShowTeamModal(false)}><X className="h-5 w-5" /></button>
                        </div>

                        <form onSubmit={handleAssign} className="mb-6 flex gap-2">
                            <select
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                className="flex-1 rounded border p-2 dark:bg-slate-800 dark:border-slate-700"
                                required
                            >
                                <option value="">Select Employee...</option>
                                {employees.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                            <button type="submit" className="rounded bg-blue-600 px-4 text-white hover:bg-blue-700">Add</button>
                        </form>

                        <div className="space-y-2">
                            {assignments.map((assignment: any) => (
                                <div key={assignment.id} className="flex items-center justify-between rounded bg-slate-50 p-2 dark:bg-slate-800">
                                    <span className="font-medium">{assignment.profiles?.full_name}</span>
                                    <button onClick={() => handleUnassign(assignment.id)} className="text-red-500 hover:underline">Remove</button>
                                </div>
                            ))}
                            {assignments.length === 0 && <p className="text-sm text-slate-500">No members assigned.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
