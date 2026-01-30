import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { User, Shield, Search, X, ToggleLeft, ToggleRight } from "lucide-react"

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & { email?: string; is_active?: boolean }

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Edit State
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [editForm, setEditForm] = useState({
        department: "",
        hourly_rate: "",
        role: "employee" as "admin" | "employee",
        email: "",
        is_active: true
    })

    useEffect(() => {
        fetchEmployees()
    }, [])

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("full_name")

            if (error) throw error
            setEmployees(data || [])
        } catch (error) {
            console.error("Error fetching employees:", error)
        } finally {
            setLoading(false)
        }
    }

    const openEditModal = (user: Profile) => {
        setEditingUser(user)
        setEditForm({
            department: user.department || "",
            hourly_rate: user.hourly_rate?.toString() || "",
            role: user.role || "employee",
            email: user.email || "",
            is_active: user.is_active !== false // default true if undefined
        })
    }

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingUser) return

        try {
            const { error } = await supabase.from("profiles").update({
                department: editForm.department,
                hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
                role: editForm.role,
                email: editForm.email,
                is_active: editForm.is_active
            }).eq("id", editingUser.id)

            if (error) throw error

            fetchEmployees()
            setEditingUser(null)
        } catch (error) {
            console.error("Error updating user:", error)
            alert("Error al actualizar el usuario")
        }
    }

    const handleToggleActive = async (user: Profile) => {
        try {
            const newValue = user.is_active === false ? true : false
            const { error } = await supabase
                .from("profiles")
                .update({ is_active: newValue })
                .eq("id", user.id)

            if (error) throw error
            fetchEmployees()
        } catch (error) {
            console.error("Error toggling active status:", error)
        }
    }

    const filteredEmployees = employees.filter(e =>
        e.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.department?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return <div className="p-8">Cargando...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white">Gestión de Usuarios</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Administra accesos, roles y perfiles de usuarios.</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar usuarios..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-md border pl-8 py-2 text-sm sm:w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    />
                </div>
            </div>

            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
                <span className="font-semibold">Nota:</span> Los nuevos usuarios pueden registrarse desde la página de inicio de sesión. Una vez registrados, aparecerán aquí para asignarles roles y detalles.
            </div>

            <div className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nombre</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Departamento</th>
                            <th className="px-4 py-3 font-medium">Tarifa por Hora</th>
                            <th className="px-4 py-3 font-medium">Rol</th>
                            <th className="px-4 py-3 font-medium text-center">Activo</th>
                            <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredEmployees.map(employee => (
                            <tr key={employee.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${employee.is_active === false ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium dark:text-white">{employee.full_name || "Sin nombre"}</span>
                                            <span className="text-xs text-slate-400">ID: ...{employee.id.slice(-4)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                    {employee.email || "-"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                    {employee.department || "-"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                    {employee.hourly_rate ? `$${employee.hourly_rate}/hr` : "-"}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${employee.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        }`}>
                                        {employee.role === 'admin' && <Shield className="h-3 w-3" />}
                                        {employee.role === 'admin' ? 'Administrador' : 'Empleado'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => handleToggleActive(employee)}
                                        className="transition-colors"
                                        title={employee.is_active !== false ? "Desactivar usuario" : "Activar usuario"}
                                    >
                                        {employee.is_active !== false ? (
                                            <ToggleRight className="h-6 w-6 text-green-500" />
                                        ) : (
                                            <ToggleLeft className="h-6 w-6 text-slate-400" />
                                        )}
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => openEditModal(employee)}
                                        className="text-blue-600 hover:text-blue-800 font-medium dark:text-blue-400"
                                    >
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingUser && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold dark:text-white">Editar Usuario</h2>
                            <button onClick={() => setEditingUser(null)}><X className="h-5 w-5 text-slate-500" /></button>
                        </div>

                        <div className="mb-4 flex items-center gap-3 rounded-md bg-slate-50 dark:bg-slate-800 p-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-700 shadow-sm">
                                <User className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                            </div>
                            <div>
                                <p className="font-bold dark:text-white">{editingUser.full_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Actualizando perfil y acceso</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Email</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="usuario@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Departamento</label>
                                <input
                                    type="text"
                                    value={editForm.department}
                                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="ej. Ingeniería, Diseño"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Tarifa por Hora ($)</label>
                                <input
                                    type="number"
                                    value={editForm.hourly_rate}
                                    onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Rol (Nivel de Acceso)</label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="employee">Empleado (Acceso Estándar)</option>
                                    <option value="admin">Administrador (Acceso Completo)</option>
                                </select>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Los administradores pueden gestionar clientes, proyectos, usuarios y aprobar solicitudes.
                                </p>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-slate-700">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Usuario Activo</label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Los usuarios inactivos no aparecen en reportes
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                                    className="transition-colors"
                                >
                                    {editForm.is_active ? (
                                        <ToggleRight className="h-8 w-8 text-green-500" />
                                    ) : (
                                        <ToggleLeft className="h-8 w-8 text-slate-400" />
                                    )}
                                </button>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
