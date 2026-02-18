import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Database } from "@/types/database.types"
import { Plus, Calendar, Globe, Lock, Trash2, X, Clock, Pencil, RefreshCw, Users } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

type Event = Database["public"]["Tables"]["events"]["Row"] & {
    recurrence?: string
    requires_confirmation: boolean
    is_confirmed: boolean
}

type RecurrenceType = "once" | "weekly" | "monthly" | "yearly"

const recurrenceLabels: Record<RecurrenceType, string> = {
    once: "Una vez",
    weekly: "Semanal",
    monthly: "Mensual",
    yearly: "Anual"
}

export default function AgendaPage() {
    const { profile } = useAuth()
    const isAdmin = profile?.role === "admin"
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [filter, setFilter] = useState<"all" | "public" | "private">("all")
    const [editingEvent, setEditingEvent] = useState<Event | null>(null)
    const [profiles, setProfiles] = useState<{ id: string, full_name: string | null }[]>([])
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        event_date: format(new Date(), "yyyy-MM-dd"),
        event_time: "",
        is_public: true,
        recurrence: "once" as RecurrenceType,
        requires_confirmation: false,
        participant_ids: [] as string[]
    })

    useEffect(() => {
        fetchProfiles()
    }, [])

    const fetchProfiles = async () => {
        const { data } = await supabase.from("profiles").select("id, full_name").order("full_name")
        setProfiles(data || [])
    }

    useEffect(() => {
        fetchEvents()
    }, [filter])

    const fetchEvents = async () => {
        try {
            setError(null)
            let query = supabase
                .from("events")
                .select("*")
                .order("event_date", { ascending: true })

            if (filter === "public") {
                query = query.eq("is_public", true)
            } else if (filter === "private") {
                query = query.eq("is_public", false)
            }

            const { data, error } = await query
            if (error) throw error
            setEvents(data || [])
        } catch (error: any) {
            console.error("Error fetching events:", error)
            setError("Error al cargar eventos: " + (error.message || "Error desconocido"))
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingEvent(null)
        setFormData({
            title: "",
            description: "",
            event_date: format(new Date(), "yyyy-MM-dd"),
            event_time: "",
            is_public: isAdmin,
            recurrence: "once",
            requires_confirmation: false,
            participant_ids: []
        })
        setShowModal(true)
    }

    const openEditModal = async (event: Event) => {
        setEditingEvent(event)

        // Fetch participants
        const { data } = await supabase
            .from("event_participants")
            .select("user_id")
            .eq("event_id", event.id)

        const participantIds = data?.map(p => p.user_id) || []

        setFormData({
            title: event.title,
            description: event.description || "",
            event_date: event.event_date,
            event_time: event.event_time || "",
            is_public: event.is_public,
            recurrence: (event.recurrence as RecurrenceType) || "once",
            requires_confirmation: event.requires_confirmation,
            participant_ids: participantIds
        })
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile) return

        try {
            let eventId = editingEvent?.id

            if (editingEvent) {
                // Update existing event
                const { error } = await supabase
                    .from("events")
                    .update({
                        title: formData.title,
                        description: formData.description || null,
                        event_date: formData.event_date,
                        event_time: formData.event_time || null,
                        is_public: formData.is_public,
                        recurrence: formData.recurrence,
                        requires_confirmation: formData.requires_confirmation
                    })
                    .eq("id", editingEvent.id)

                if (error) throw error
            } else {
                // Create new event
                const { data, error } = await supabase.from("events").insert({
                    title: formData.title,
                    description: formData.description || null,
                    event_date: formData.event_date,
                    event_time: formData.event_time || null,
                    is_public: formData.is_public,
                    recurrence: formData.recurrence,
                    requires_confirmation: formData.requires_confirmation,
                    is_confirmed: false,
                    created_by: profile.id
                }).select().single()

                if (error) throw error
                eventId = data.id
            }

            // Update participants
            if (eventId) {
                // Delete existing participants
                await supabase.from("event_participants").delete().eq("event_id", eventId)

                // Insert new participants
                if (formData.participant_ids.length > 0) {
                    const participantsData = formData.participant_ids.map(uid => ({
                        event_id: eventId!,
                        user_id: uid,
                        status: 'pending'
                    }))
                    const { error: partError } = await supabase.from("event_participants").insert(participantsData)
                    if (partError) throw partError
                }
            }

            fetchEvents()
            setShowModal(false)
            setEditingEvent(null)
        } catch (error: any) {
            console.error("Error saving event:", error)
            const errorMessage = error.message || "Error desconocido"
            const errorDetails = error.details || error.hint || ""
            alert(`Error al guardar el evento: ${errorMessage}\n${errorDetails}`)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este evento?")) return

        try {
            const { error } = await supabase.from("events").delete().eq("id", id)
            if (error) throw error
            fetchEvents()
        } catch (error) {
            console.error("Error deleting event:", error)
            alert("Error al eliminar el evento")
        }
    }

    if (loading) return <div className="p-8">Cargando agenda...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white">Agenda</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gestiona tus eventos y recordatorios
                    </p>
                    {error && (
                        <div className="mt-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="rounded-md border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    >
                        <option value="all">Todos los eventos</option>
                        <option value="public">Solo públicos</option>
                        <option value="private">Solo privados</option>
                    </select>

                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Evento
                    </button>
                </div>
            </div>

            {/* Events List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                    <div
                        key={event.id}
                        className="group relative rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${event.is_public
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                        }`}
                                >
                                    {event.is_public ? (
                                        <>
                                            <Globe className="h-3 w-3" /> Público
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="h-3 w-3" /> Privado
                                        </>
                                    )}
                                </span>
                                {event.recurrence && event.recurrence !== "once" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        <RefreshCw className="h-3 w-3" />
                                        {recurrenceLabels[event.recurrence as RecurrenceType]}
                                    </span>
                                )}
                            </div>

                            {event.created_by === profile?.id && (
                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                        onClick={() => openEditModal(event)}
                                        className="text-slate-400 hover:text-blue-500"
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(event.id)}
                                        className="text-slate-400 hover:text-red-500"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">
                            {event.title}
                        </h3>

                        {event.description && (
                            <p className="mb-3 text-sm text-slate-500 line-clamp-2 dark:text-slate-400">
                                {event.description}
                            </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(event.event_date + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
                            </div>
                            {event.event_time && (
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.event_time.slice(0, 5)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {events.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-500">
                        No hay eventos programados
                    </div>
                )}
            </div>

            {/* Modal */}
            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b p-4 dark:border-slate-800">
                            <h2 className="text-xl font-bold dark:text-white">
                                {editingEvent ? "Editar Evento" : "Nuevo Evento"}
                            </h2>
                            <button onClick={() => { setShowModal(false); setEditingEvent(null); }}>
                                <X className="h-5 w-5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6">
                            <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">
                                        Título
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) =>
                                            setFormData({ ...formData, title: e.target.value })
                                        }
                                        className="w-full rounded-md border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        placeholder="Nombre del evento"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">
                                        Descripción (opcional)
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({ ...formData, description: e.target.value })
                                        }
                                        className="w-full rounded-md border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        rows={3}
                                        placeholder="Detalles adicionales..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium dark:text-gray-300">
                                            Fecha
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.event_date}
                                            onChange={(e) =>
                                                setFormData({ ...formData, event_date: e.target.value })
                                            }
                                            className="w-full rounded-md border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium dark:text-gray-300">
                                            Hora (opcional)
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.event_time}
                                            onChange={(e) =>
                                                setFormData({ ...formData, event_time: e.target.value })
                                            }
                                            className="w-full rounded-md border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 mb-2">
                                        Repetición
                                    </label>
                                    <select
                                        value={formData.recurrence}
                                        onChange={(e) =>
                                            setFormData({ ...formData, recurrence: e.target.value as RecurrenceType })
                                        }
                                        className="w-full rounded-md border p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="once">Una sola vez</option>
                                        <option value="weekly">Cada semana</option>
                                        <option value="monthly">Cada mes</option>
                                        <option value="yearly">Cada año</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.requires_confirmation}
                                            onChange={(e) =>
                                                setFormData({ ...formData, requires_confirmation: e.target.checked })
                                            }
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium dark:text-gray-300">
                                            Requiere confirmación (no desaparece hasta marcarlo)
                                        </span>
                                    </label>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 block text-sm font-medium dark:text-gray-300 mb-2">
                                        <Users className="h-4 w-4" />
                                        Participantes
                                    </label>
                                    <div className="max-h-40 overflow-y-auto rounded-md border p-2 dark:bg-slate-800 dark:border-slate-700 custom-scrollbar mb-4">
                                        {profiles.map(p => (
                                            <label key={p.id} className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.participant_ids.includes(p.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...formData.participant_ids, p.id]
                                                            : formData.participant_ids.filter(id => id !== p.id)
                                                        setFormData({ ...formData, participant_ids: newIds })
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm dark:text-gray-300">{p.full_name || "Sin nombre"}</span>
                                            </label>
                                        ))}
                                        {profiles.length === 0 && (
                                            <p className="text-sm text-slate-500 text-center py-2">No hay usuarios disponibles</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 mb-2">
                                        Visibilidad
                                    </label>
                                    <div className="flex gap-4">
                                        <label className={`flex items-center gap-2 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                            <input
                                                type="radio"
                                                name="visibility"
                                                checked={formData.is_public}
                                                disabled={!isAdmin}
                                                onChange={() =>
                                                    setFormData({ ...formData, is_public: true })
                                                }
                                                className="text-indigo-600"
                                            />
                                            <Globe className="h-4 w-4 text-green-500" />
                                            <span className="text-sm dark:text-gray-300">Público</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="visibility"
                                                checked={!formData.is_public}
                                                onChange={() =>
                                                    setFormData({ ...formData, is_public: false })
                                                }
                                                className="text-indigo-600"
                                            />
                                            <Lock className="h-4 w-4 text-purple-500" />
                                            <span className="text-sm dark:text-gray-300">Privado</span>
                                        </label>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {isAdmin
                                            ? "Los eventos públicos son visibles para todos los usuarios."
                                            : "Solo los administradores pueden crear eventos públicos."}
                                    </p>
                                </div>
                            </form>
                        </div>

                        <div className="flex justify-end gap-2 border-t p-4 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => { setShowModal(false); setEditingEvent(null); }}
                                className="rounded-md px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                form="event-form"
                                type="submit"
                                className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                            >
                                {editingEvent ? "Guardar Cambios" : "Crear Evento"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
