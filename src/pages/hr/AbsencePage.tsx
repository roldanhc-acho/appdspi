import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { Plus, Check, X, Upload, FileText, Image as ImageIcon, Trash2, ExternalLink, Paperclip, Loader2, Pencil } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect"

type Absence = Database["public"]["Tables"]["absences"]["Row"] & {
    profiles: { full_name: string; daily_hours?: number | null } | null
}

export default function AbsencePage() {
    const { profile } = useAuth()
    const isAdmin = profile?.role === "admin"
    const userDailyHours = profile?.daily_hours ?? 9

    const [absences, setAbsences] = useState<Absence[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    // Edit modal state
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
    const [editFormData, setEditFormData] = useState({
        hours: 9,
        reason: "",
        type: "vacation" as Database["public"]["Enums"]["absence_type"],
        start_date: "",
        end_date: "",
        status: "pending" as Database["public"]["Enums"]["absence_status"]
    })
    const [isUpdating, setIsUpdating] = useState(false)

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)

    const absenceTypeOptions: SelectOption[] = [
        { value: "vacation", label: "Vacaciones" },
        { value: "sickness", label: "Enfermedad / Certificado Médico" },
        { value: "study", label: "Estudio" },
        { value: "suspension", label: "Suspensión" },
        { value: "other", label: "Otro" },
    ]

    const [formData, setFormData] = useState({
        start_date: "",
        end_date: "",
        type: "vacation",
        reason: "",
        hours: userDailyHours
    })

    useEffect(() => {
        if (profile?.daily_hours) {
            setFormData(prev => ({ ...prev, hours: profile.daily_hours ?? 9 }))
        }
    }, [profile?.daily_hours])

    useEffect(() => {
        fetchAbsences()
    }, [])

    const fetchAbsences = async () => {
        try {
            let query = supabase
                .from("absences")
                .select("*, profiles(full_name, daily_hours)")
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            alert("El archivo no debe superar los 10MB")
            return
        }

        setSelectedFile(file)
        if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file)
            setFilePreviewUrl(url)
        } else {
            setFilePreviewUrl(null)
        }
    }

    const handleRemoveFile = () => {
        setSelectedFile(null)
        if (filePreviewUrl) {
            URL.revokeObjectURL(filePreviewUrl)
            setFilePreviewUrl(null)
        }
    }

    const resetForm = () => {
        setFormData({
            start_date: "",
            end_date: "",
            type: "vacation",
            reason: "",
            hours: profile?.daily_hours ?? 9
        })
        handleRemoveFile()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile) return

        setIsUploading(true)

        try {
            let uploadedAttachmentUrl: string | null = null

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `${profile.id}_${Date.now()}.${fileExt}`
                const filePath = `certificates/${fileName}`

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from("absences")
                    .upload(filePath, selectedFile, { upsert: true })

                if (uploadError) {
                    console.error("Storage upload error:", uploadError)
                    alert("No se pudo subir el archivo adjunto al almacenamiento. Por favor verifica el formato/tamaño e intenta nuevamente.")
                    setIsUploading(false)
                    return
                }

                const { data: publicUrlData } = supabase.storage.from("absences").getPublicUrl(uploadData.path)
                uploadedAttachmentUrl = publicUrlData.publicUrl
            }

            const { error } = await supabase.from("absences").insert([{
                user_id: profile.id,
                start_date: formData.start_date,
                end_date: formData.end_date,
                type: formData.type as any,
                reason: formData.reason,
                hours: formData.hours,
                attachment_url: uploadedAttachmentUrl,
                status: "pending"
            }])

            if (error) throw error

            fetchAbsences()
            setShowModal(false)
            resetForm()
        } catch (error) {
            console.error("Error creating request:", error)
            alert("Error creando la solicitud")
        } finally {
            setIsUploading(false)
        }
    }

    const openEditModal = (absence: Absence) => {
        setEditingAbsence(absence)
        setEditFormData({
            hours: absence.hours ?? absence.profiles?.daily_hours ?? 9,
            reason: absence.reason || "",
            type: absence.type,
            start_date: absence.start_date,
            end_date: absence.end_date,
            status: absence.status || "pending"
        })
    }

    const handleUpdateAbsence = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingAbsence) return

        setIsUpdating(true)
        try {
            const updatePayload: Record<string, any> = {
                hours: Number(editFormData.hours),
                reason: editFormData.reason,
                type: editFormData.type,
                start_date: editFormData.start_date,
                end_date: editFormData.end_date,
            }

            if (isAdmin) {
                updatePayload.status = editFormData.status
            }

            const { error } = await supabase
                .from("absences")
                .update(updatePayload)
                .eq("id", editingAbsence.id)

            if (error) throw error

            setEditingAbsence(null)
            fetchAbsences()
        } catch (error) {
            console.error("Error updating absence:", error)
            alert("Error al actualizar la solicitud de ausencia")
        } finally {
            setIsUpdating(false)
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

    if (loading) return <div className="p-6">Cargando ausencias...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold dark:text-white">Gestión de ausencias/vacaciones</h1>
                <button
                    onClick={() => {
                        resetForm()
                        setShowModal(true)
                    }}
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Cargar
                </button>
            </div>

            <div className="rounded-lg border bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-3 font-medium">Empleado</th>
                            <th className="px-4 py-3 font-medium">Tipo</th>
                            <th className="px-4 py-3 font-medium">Fechas</th>
                            <th className="px-4 py-3 font-medium">Horas</th>
                            <th className="px-4 py-3 font-medium">Motivo</th>
                            <th className="px-4 py-3 font-medium">Certificado / Comprobante</th>
                            <th className="px-4 py-3 font-medium">Estado</th>
                            <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {absences.map(absence => (
                            <tr key={absence.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-medium">{absence.profiles?.full_name}</td>
                                <td className="px-4 py-3 capitalize">{absence.type}</td>
                                <td className="px-4 py-3 text-slate-500">
                                    <div className="flex flex-col text-xs">
                                        <span>{new Date(`${absence.start_date}T12:00:00`).toLocaleDateString()}</span>
                                        <span>hasta {new Date(`${absence.end_date}T12:00:00`).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-center font-medium">
                                    {absence.hours != null ? `${absence.hours}h` : `${absence.profiles?.daily_hours ?? 9}h`}
                                </td>
                                <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={absence.reason || ""}>
                                    {absence.reason || "-"}
                                </td>
                                <td className="px-4 py-3">
                                    {absence.attachment_url ? (
                                        <a
                                            href={absence.attachment_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                            title="Ver certificado o comprobante"
                                        >
                                            {absence.attachment_url.includes(".pdf") || absence.attachment_url.startsWith("data:application/pdf") ? (
                                                <FileText className="h-3.5 w-3.5 text-red-500" />
                                            ) : (
                                                <Paperclip className="h-3.5 w-3.5" />
                                            )}
                                            <span>Ver archivo</span>
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${getStatusColor(absence.status || 'pending')}`}>
                                        {absence.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        {isAdmin && absence.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateStatus(absence.id, 'approved')}
                                                    className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                                                    title="Aprobar"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(absence.id, 'rejected')}
                                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    title="Rechazar"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                        {(isAdmin || (absence.user_id === profile?.id && absence.status === 'pending')) && (
                                            <button
                                                onClick={() => openEditModal(absence)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                title="Editar solicitud"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {absences.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No se encontraron solicitudes.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Absence Modal */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50 overflow-y-auto">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900 my-8">
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
                                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Tipo</label>
                                <SearchableSelect
                                    value={formData.type}
                                    onChange={(val) => setFormData({ ...formData, type: val })}
                                    options={absenceTypeOptions}
                                    placeholder="Seleccionar tipo de ausencia"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">
                                    Horas <span className="text-slate-400 font-normal text-xs">(jornada habitual = {userDailyHours}h | intervalos de 30 min)</span>
                                </label>
                                <input
                                    type="number"
                                    min="0.5"
                                    max="24"
                                    step="0.5"
                                    value={formData.hours}
                                    onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Motivo</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    rows={3}
                                    placeholder="Describa el motivo de la ausencia..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                                    Certificado médico / Comprobante de ausencia
                                </label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                    Adjunte una foto, imagen o archivo PDF con el certificado o justificativo.
                                </p>

                                {!selectedFile ? (
                                    <div className="flex justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-6 py-4 hover:border-blue-500 transition-colors">
                                        <div className="text-center">
                                            <Upload className="mx-auto h-8 w-8 text-slate-400" />
                                            <div className="mt-2 flex text-sm leading-6 text-slate-600 dark:text-slate-400">
                                                <label className="relative cursor-pointer rounded-md font-semibold text-blue-600 focus-within:outline-none hover:text-blue-500">
                                                    <span>Seleccionar o tomar foto</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        onChange={handleFileChange}
                                                        className="sr-only"
                                                    />
                                                </label>
                                                <span className="pl-1">o arrastrar archivo</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG, WEBP hasta 10MB</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                                        <div className="flex items-center space-x-3 overflow-hidden">
                                            {filePreviewUrl ? (
                                                <img src={filePreviewUrl} alt="Vistazo" className="h-12 w-12 object-cover rounded border flex-shrink-0" />
                                            ) : selectedFile.type === "application/pdf" ? (
                                                <FileText className="h-8 w-8 text-red-500 flex-shrink-0" />
                                            ) : (
                                                <ImageIcon className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                            )}
                                            <div className="truncate">
                                                <p className="text-sm font-medium dark:text-white truncate">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-500 transition-colors flex-shrink-0"
                                            title="Quitar archivo"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        resetForm()
                                    }}
                                    disabled={isUploading}
                                    className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploading}
                                    className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isUploading ? "Subiendo..." : "Enviar solicitud"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Absence Modal */}
            {editingAbsence && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50 overflow-y-auto">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900 my-8">
                        <h2 className="mb-4 text-xl font-bold dark:text-white">
                            Editar ausencia {editingAbsence.profiles?.full_name ? `(${editingAbsence.profiles.full_name})` : ""}
                        </h2>
                        <form onSubmit={handleUpdateAbsence} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Fecha de inicio</label>
                                    <input
                                        type="date"
                                        required
                                        value={editFormData.start_date}
                                        onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">Fecha de fin</label>
                                    <input
                                        type="date"
                                        required
                                        value={editFormData.end_date}
                                        onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Tipo</label>
                                <SearchableSelect
                                    value={editFormData.type}
                                    onChange={(val) => setEditFormData({ ...editFormData, type: val as any })}
                                    options={absenceTypeOptions}
                                    placeholder="Seleccionar tipo de ausencia"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">
                                    Horas <span className="text-slate-400 font-normal text-xs">(intervalos de 30 min / 0.5h)</span>
                                </label>
                                <input
                                    type="number"
                                    min="0.5"
                                    max="24"
                                    step="0.5"
                                    value={editFormData.hours}
                                    onChange={(e) => setEditFormData({ ...editFormData, hours: parseFloat(e.target.value) || 0 })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    required
                                />
                            </div>

                            {isAdmin && (
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">Estado</label>
                                    <select
                                        value={editFormData.status || "pending"}
                                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                                        className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="pending">Pendiente</option>
                                        <option value="approved">Aprobado</option>
                                        <option value="rejected">Rechazado</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium dark:text-gray-300">Motivo</label>
                                <textarea
                                    value={editFormData.reason}
                                    onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                    className="w-full rounded border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    rows={3}
                                    placeholder="Describa el motivo de la ausencia..."
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingAbsence(null)}
                                    disabled={isUpdating}
                                    className="rounded px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isUpdating ? "Guardando..." : "Guardar cambios"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
