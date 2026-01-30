import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Database } from "@/types/database.types"
import {
    Plus,
    Trash2,
    Pencil,
    Building2,
    Calendar,
    Clock,
    X,
    Loader2,
    AlertCircle
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

type ProductiveHour = Database["public"]["Tables"]["productive_hours"]["Row"] & {
    profiles: { full_name: string | null }
    clients: { name: string }
}
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Client = Database["public"]["Tables"]["clients"]["Row"]

export default function ProductiveHoursPage() {
    const { profile: currentUser } = useAuth()
    const [data, setData] = useState<ProductiveHour[]>([])
    const [employees, setEmployees] = useState<Profile[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState({
        id: "",
        user_id: "",
        client_id: "",
        month: format(new Date(), "yyyy-MM"),
        hours: 0
    })

    useEffect(() => {
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [respHours, respEmployees, respClients] = await Promise.all([
                supabase
                    .from("productive_hours")
                    .select("*, profiles:user_id(full_name), clients:client_id(name)")
                    .order("month", { ascending: false }),
                supabase.from("profiles").select("*").order("full_name"),
                supabase.from("clients").select("*").order("name")
            ])

            setData(respHours.data as any || [])
            setEmployees(respEmployees.data || [])
            setClients(respClients.data || [])
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentUser) return
        setIsSaving(true)

        try {
            const payload = {
                user_id: formData.user_id,
                client_id: formData.client_id,
                month: formData.month,
                hours: formData.hours,
                created_by: currentUser.id
            }

            if (formData.id) {
                const { error } = await supabase
                    .from("productive_hours")
                    .update(payload)
                    .eq("id", formData.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from("productive_hours")
                    .insert([payload])
                if (error) throw error
            }

            fetchInitialData()
            setShowModal(false)
            setFormData({ id: "", user_id: "", client_id: "", month: format(new Date(), "yyyy-MM"), hours: 0 })
        } catch (error) {
            alert("Error al guardar horas productivas")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este registro?")) return
        try {
            const { error } = await supabase.from("productive_hours").delete().eq("id", id)
            if (error) throw error
            fetchInitialData()
        } catch (error) {
            alert("Error al eliminar")
        }
    }

    if (loading) return (
        <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white">Horas Productivas</h1>
                    <p className="text-zinc-400">Asigna horas extra de productividad que se sumarán al registro mensual.</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ id: "", user_id: "", client_id: "", month: format(new Date(), "yyyy-MM"), hours: 0 })
                        setShowModal(true)
                    }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
                >
                    <Plus className="h-5 w-5" />
                    Asignar Horas
                </button>
            </div>

            {/* List */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/80">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Empleado</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Empresa</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Mes</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-center">Horas</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {data.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-700">
                                            {item.profiles?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <span className="font-semibold text-zinc-200">{item.profiles?.full_name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Building2 className="h-4 w-4" />
                                        <span>{item.clients?.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Calendar className="h-4 w-4" />
                                        <span className="capitalize">{format(parseISO(`${item.month}-01`), "MMMM yyyy", { locale: es })}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-sm font-bold text-green-500">
                                        <Clock className="h-3 w-3" />
                                        {item.hours}h
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setFormData({
                                                    id: item.id,
                                                    user_id: item.user_id,
                                                    client_id: item.client_id,
                                                    month: item.month,
                                                    hours: item.hours
                                                })
                                                setShowModal(true)
                                            }}
                                            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 italic">
                                    No hay horas productivas asignadas aún.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">
                                {formData.id ? "Editar Asignación" : "Asignar Horas Productivas"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white"><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Employee Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Empleado</label>
                                <select
                                    required
                                    value={formData.user_id}
                                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="">Seleccionar empleado...</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>{e.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Client Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Empresa (Cliente)</label>
                                <select
                                    required
                                    value={formData.client_id}
                                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="">Seleccionar empresa...</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Month Select */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mes Aplicable</label>
                                    <input
                                        type="month"
                                        required
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>

                                {/* Hours Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Horas</label>
                                    <input
                                        type="number"
                                        required
                                        min="0.5"
                                        step="0.5"
                                        value={formData.hours}
                                        onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
                                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-6">
                                <div className="flex gap-3">
                                    <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
                                    <p className="text-xs text-blue-200 leading-relaxed">
                                        Estas horas aparecerán sumadas en los reportes de administración para el mes seleccionado,
                                        pero no afectarán el banco de horas personal del empleado.
                                    </p>
                                </div>
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
                                    {formData.id ? "Guardar" : "Asignar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
