import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { Plus, Trash2, Pencil, Users, Briefcase, Building2, X, Check, Loader2 } from "lucide-react"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface ClientWithStats extends Client {
    project_count: number
    employee_count: number
}

export default function ClientsPage() {
    const [clients, setClients] = useState<ClientWithStats[]>([])
    const [employees, setEmployees] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([])
    const [formData, setFormData] = useState({ id: "", name: "", contact_info: "" })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            await Promise.all([fetchClients(), fetchAllEmployees()])
        } finally {
            setLoading(false)
        }
    }

    const fetchAllEmployees = async () => {
        const { data } = await supabase.from("profiles").select("*").order("full_name")
        setEmployees(data || [])
    }

    const fetchClients = async () => {
        try {
            const { data: clientsData, error } = await supabase
                .from("clients")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) throw error

            const clientsWithStats = await Promise.all((clientsData || []).map(async (client) => {
                // Count projects
                const { count: pCount } = await supabase
                    .from("projects")
                    .select("*", { count: 'exact', head: true })
                    .eq("client_id", client.id)

                // Count assigned employees (handle if table doesn't exist)
                let eCount = 0
                try {
                    const { count } = await supabase
                        .from("client_assignments")
                        .select("*", { count: 'exact', head: true })
                        .eq("client_id", client.id)
                    eCount = count || 0
                } catch {
                    // Table might not exist yet
                    eCount = 0
                }

                return {
                    ...client,
                    project_count: pCount || 0,
                    employee_count: eCount
                }
            }))

            setClients(clientsWithStats)
        } catch (error) {
            console.error("Error fetching clients:", error)
        }
    }

    const fetchAssignedEmployees = async (clientId: string) => {
        try {
            const { data } = await supabase
                .from("client_assignments")
                .select("user_id")
                .eq("client_id", clientId)

            setAssignedEmployeeIds(data?.map(a => a.user_id) || [])
        } catch {
            setAssignedEmployeeIds([])
        }
    }

    const handleOpenAssign = async (client: Client) => {
        setSelectedClient(client)
        await fetchAssignedEmployees(client.id)
        setShowAssignModal(true)
    }

    const toggleEmployeeAssignment = async (employeeId: string) => {
        if (!selectedClient) return

        const isAssigned = assignedEmployeeIds.includes(employeeId)

        try {
            if (isAssigned) {
                await supabase
                    .from("client_assignments")
                    .delete()
                    .eq("client_id", selectedClient.id)
                    .eq("user_id", employeeId)
                setAssignedEmployeeIds(prev => prev.filter(id => id !== employeeId))
            } else {
                await supabase
                    .from("client_assignments")
                    .insert({ client_id: selectedClient.id, user_id: employeeId })
                setAssignedEmployeeIds(prev => [...prev, employeeId])
            }
            fetchClients() // Refresh stats
        } catch (err) {
            alert("Asegúrate de haber creado la tabla client_assignments en el SQL Editor.")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            if (formData.id) {
                const { error } = await supabase
                    .from("clients")
                    .update({ name: formData.name, contact_info: formData.contact_info })
                    .eq("id", formData.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from("clients")
                    .insert([{ name: formData.name, contact_info: formData.contact_info }])
                if (error) throw error
            }

            // Important: await the refresh to ensure data is ready before closing modal
            await fetchClients()
            setShowModal(false)
            setFormData({ id: "", name: "", contact_info: "" })
        } catch (error: any) {
            console.error("Error in handleSubmit:", error)
            alert("Error al guardar cliente: " + (error.message || "Error desconocido"))
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro? Esto eliminará todos los proyectos asociados con este cliente.")) return;
        try {
            const { error } = await supabase.from("clients").delete().eq("id", id)
            if (error) throw error
            fetchClients()
        } catch (error) {
            alert("No se pudo eliminar. Verifique que no tenga proyectos activos.")
        }
    }

    if (loading) return (
        <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white">Clientes</h1>
                    <p className="text-zinc-400">Gestiona los clientes y asigna empleados a cada uno.</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ id: "", name: "", contact_info: "" })
                        setShowModal(true)
                    }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
                >
                    <Plus className="h-5 w-5" />
                    Nuevo Cliente
                </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                    <div
                        key={client.id}
                        className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-primary/50 hover:bg-zinc-900"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{client.name}</h3>
                                    <span className="text-sm text-zinc-500 line-clamp-1">{client.contact_info || "Sin descripción"}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setFormData({ id: client.id, name: client.name, contact_info: client.contact_info || "" })
                                        setShowModal(true)
                                    }}
                                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(client.id)}
                                    className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center gap-6 border-t border-zinc-800/50 pt-6">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                                    <Briefcase className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-white leading-none">{client.project_count}</span>
                                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Proyectos</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                                    <Users className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-white leading-none">{client.employee_count}</span>
                                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Empleados</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleOpenAssign(client)}
                            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-800/50 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-95"
                        >
                            <Users className="h-4 w-4" />
                            Gestionar Empleados
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal CRUD Cliente */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">
                                {formData.id ? "Editar Cliente" : "Nuevo Cliente"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white"><X /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Información de contacto (Opcional)</label>
                                <textarea
                                    value={formData.contact_info}
                                    onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white h-24 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="rounded-xl px-6 py-3 font-semibold text-zinc-400 hover:bg-zinc-900 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-white hover:bg-primary/90 transition-all disabled:opacity-50"
                                >
                                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {formData.id ? "Guardar" : "Crear"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Asignar Empleados */}
            {showAssignModal && selectedClient && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-2xl font-bold text-white">Asignar Empleados</h2>
                            <button onClick={() => setShowAssignModal(false)} className="text-zinc-500 hover:text-white"><X /></button>
                        </div>
                        <p className="mb-6 text-zinc-400">Selecciona los empleados que trabajarán con <span className="text-primary font-bold">{selectedClient.name}</span></p>

                        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {employees.map(employee => {
                                const isAssigned = assignedEmployeeIds.includes(employee.id)
                                return (
                                    <button
                                        key={employee.id}
                                        onClick={() => toggleEmployeeAssignment(employee.id)}
                                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isAssigned
                                            ? 'border-primary/50 bg-primary/5 text-white'
                                            : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 flex items-center justify-center rounded-full font-bold ${isAssigned ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-500'
                                                }`}>
                                                {employee.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold">{employee.full_name}</p>
                                                <p className="text-xs opacity-60">{employee.department || 'Sin departamento'}</p>
                                            </div>
                                        </div>
                                        {isAssigned ? (
                                            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-primary text-white">
                                                <Check className="h-4 w-4" />
                                            </div>
                                        ) : (
                                            <Plus className="h-5 w-5 opacity-40" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="rounded-xl bg-zinc-800 px-8 py-3 font-bold text-white hover:bg-zinc-700 transition-all"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

