import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { Plus, Check, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

type Absence = Database["public"]["Tables"]["absences"]["Row"] & {
    profiles: { full_name: string } | null
}

export default function AbsencePage() {
    const { profile } = useAuth()
    const isAdmin = profile?.role === "admin"

    const [absences, setAbsences] = useState<Absence[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    const [formData, setFormData] = useState({
        start_date: "",
        end_date: "",
        type: "vacation",
        reason: ""
    })

    useEffect(() => {
        fetchAbsences()
    }, [])

    const fetchAbsences = async () => {
        try {
            let query = supabase
                .from("absences")
                .select("*, profiles(full_name)")
                .order("start_date", { ascending: false })

            // If not admin, only show own absences
            if (!isAdmin && profile) {
                query = query.eq("user_id", profile.id)
            }

            const { data, error } = await query
            if (error) throw error
            setAbsences(data as any || [])
        } catch (error) {
            console.error("Error fetching absences:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile) return

        try {
            const { error } = await supabase.from("absences").insert([{
                user_id: profile.id,
                start_date: formData.start_date,
                end_date: formData.end_date,
                type: formData.type as any,
                reason: formData.reason,
                status: "pending"
            }])

            if (error) throw error

            fetchAbsences()
            setShowModal(false)
            setFormData({ start_date: "", end_date: "", type: "vacation", reason: "" })
        } catch (error) {
            console.error("Error creating request:", error)
            alert("Error creating request")
        }
    }

    const handleUpdateStatus = async (id: string, status: "approved" | "rejected") => {
        try {
            const { error } = await supabase.from("absences").update({ status }).eq("id", id)
            if (error) throw error
            fetchAbsences()
        } catch (error) {
            console.error("Error updating status:", error)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700'
            case 'rejected': return 'bg-red-100 text-red-700'
            default: return 'bg-yellow-100 text-yellow-700'
        }
    }

    if (loading) return <div>Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold dark:text-white">Gestión de ausencias/vacaciones</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" />
                    Cargar
                </button>
            </div>

            <div className="rounded-lg border bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-3 font-medium">Employee</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Dates</th>
                            <th className="px-4 py-3 font-medium">Reason</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            {isAdmin && <th className="px-4 py-3 font-medium">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {absences.map(absence => (
                            <tr key={absence.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-medium">{absence.profiles?.full_name}</td>
                                <td className="px-4 py-3 capitalize">{absence.type}</td>
                                <td className="px-4 py-3 text-slate-500">
                                    <div className="flex flex-col text-xs">
                                        <span>{new Date(absence.start_date).toLocaleDateString()}</span>
                                        <span>to {new Date(absence.end_date).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={absence.reason || ""}>
                                    {absence.reason || "-"}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${getStatusColor(absence.status || 'pending')}`}>
                                        {absence.status}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-4 py-3">
                                        {absence.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleUpdateStatus(absence.id, 'approved')} className="text-green-600 hover:text-green-800" title="Approve">
                                                    <Check className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleUpdateStatus(absence.id, 'rejected')} className="text-red-600 hover:text-red-800" title="Reject">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {absences.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No requests found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
                        <h2 className="mb-4 text-xl font-bold dark:text-white">Solicitar ausencia</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Fecha de inicio</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Fecha de fin</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Tipo</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="vacation">Vacaciones</option>
                                    <option value="sickness">Enfermedad</option>
                                    <option value="study">Estudio</option>
                                    <option value="other">Otro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Motivo</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                                >
                                    Enviar solicitud
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
