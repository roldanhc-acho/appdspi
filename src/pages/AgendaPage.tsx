import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Database } from "@/types/database.types"
import { Plus, Globe, Lock, Trash2, X, Clock, Pencil, RefreshCw, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"

type Event = Database["public"]["Tables"]["events"]["Row"] & {
    recurrence?: string
    requires_confirmation: boolean
    is_confirmed: boolean
}

type EventWithParticipants = Event & {
    participant_ids: string[]
}

type RecurrenceType = "once" | "weekly" | "monthly" | "yearly"

const recurrenceLabels: Record<RecurrenceType, string> = {
    once: "Una vez",
    weekly: "Semanal",
    monthly: "Mensual",
    yearly: "Anual"
}

const WEEKDAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export default function AgendaPage() {
    const { profile } = useAuth()
    const isAdmin = profile?.role === "admin"
    const [events, setEvents] = useState<EventWithParticipants[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [filter, setFilter] = useState<"all" | "public" | "private">("all")
    const [editingEvent, setEditingEvent] = useState<Event | null>(null)
    const [profiles, setProfiles] = useState<{ id: string, full_name: string | null }[]>([])
    const [error, setError] = useState<string | null>(null)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)

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

            // Fetch participants for all events
            const eventsData = data || []
            const eventIds = eventsData.map(e => e.id)

            let participantsMap: Record<string, string[]> = {}
            if (eventIds.length > 0) {
                const { data: participantsData } = await supabase
                    .from("event_participants")
                    .select("event_id, user_id")
                    .in("event_id", eventIds)

                if (participantsData) {
                    for (const p of participantsData) {
                        if (!participantsMap[p.event_id]) {
                            participantsMap[p.event_id] = []
                        }
                        participantsMap[p.event_id].push(p.user_id)
                    }
                }
            }

            const eventsWithParticipants: EventWithParticipants[] = eventsData.map(e => ({
                ...e,
                participant_ids: participantsMap[e.id] || []
            }))

            setEvents(eventsWithParticipants)
        } catch (error: any) {
            console.error("Error fetching events:", error)
            setError("Error al cargar eventos: " + (error.message || "Error desconocido"))
        } finally {
            setLoading(false)
        }
    }

    // Filter private events: only show if user is creator or participant
    const visibleEvents = useMemo(() => {
        if (!profile) return []
        return events.filter(event => {
            // Public events are visible to everyone
            if (event.is_public) return true
            // Private events: visible only if user is creator or participant
            if (event.created_by === profile.id) return true
            if (event.participant_ids.includes(profile.id)) return true
            // Private events with NO participants (only creator) — creator already handled above
            return false
        })
    }, [events, profile])

    // Calendar grid calculation
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

        const days: Date[] = []
        let day = calendarStart
        while (day <= calendarEnd) {
            days.push(day)
            day = addDays(day, 1)
        }
        return days
    }, [currentMonth])

    // Map events to dates
    const eventsByDate = useMemo(() => {
        const map: Record<string, EventWithParticipants[]> = {}
        for (const event of visibleEvents) {
            const dateKey = event.event_date
            if (!map[dateKey]) map[dateKey] = []
            map[dateKey].push(event)
        }
        // Sort events within each day by time
        for (const key of Object.keys(map)) {
            map[key].sort((a, b) => {
                // Events with time come first, sorted chronologically
                if (a.event_time && b.event_time) return a.event_time.localeCompare(b.event_time)
                if (a.event_time && !b.event_time) return -1
                if (!a.event_time && b.event_time) return 1
                return 0
            })
        }
        return map
    }, [visibleEvents])

    const today = new Date()

    const openCreateModal = (date?: Date) => {
        setEditingEvent(null)
        setFormData({
            title: "",
            description: "",
            event_date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
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
                await supabase.from("event_participants").delete().eq("event_id", eventId)

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

    const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
    const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))
    const goToToday = () => setCurrentMonth(new Date())

    // Events for the selected day panel
    const selectedDayEvents = useMemo(() => {
        if (!selectedDay) return []
        const dateKey = format(selectedDay, "yyyy-MM-dd")
        return eventsByDate[dateKey] || []
    }, [selectedDay, eventsByDate])

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                <span className="text-slate-400 text-sm">Cargando agenda...</span>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
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
                        onClick={() => openCreateModal()}
                        className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Evento
                    </button>
                </div>
            </div>

            {/* Calendar Navigation */}
            <div className="flex items-center justify-between rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={goToPreviousMonth}
                        className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-lg font-semibold dark:text-white min-w-[200px] text-center capitalize">
                        {format(currentMonth, "MMMM yyyy", { locale: es })}
                    </h2>
                    <button
                        onClick={goToNextMonth}
                        className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
                <button
                    onClick={goToToday}
                    className="rounded-lg border dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    Hoy
                </button>
            </div>

            {/* Calendar + Side Panel */}
            <div className="flex gap-6 flex-col lg:flex-row">
                {/* Calendar Grid */}
                <div className="flex-1 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 border-b dark:border-slate-800">
                        {WEEKDAY_NAMES.map((name) => (
                            <div
                                key={name}
                                className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                            >
                                {name}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, idx) => {
                            const dateKey = format(day, "yyyy-MM-dd")
                            const dayEvents = eventsByDate[dateKey] || []
                            const isCurrentMonth = isSameMonth(day, currentMonth)
                            const isToday = isSameDay(day, today)
                            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                            const hasEvents = dayEvents.length > 0

                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedDay(day)}
                                    className={`
                                        min-h-[100px] border-b border-r dark:border-slate-800 p-1.5 cursor-pointer transition-all
                                        ${!isCurrentMonth ? "bg-slate-50/50 dark:bg-slate-950/30" : ""}
                                        ${isSelected ? "bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-inset ring-indigo-500" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}
                                    `}
                                >
                                    {/* Day number */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`
                                                inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-medium
                                                ${isToday ? "bg-indigo-600 text-white" : ""}
                                                ${!isToday && isCurrentMonth ? "text-slate-700 dark:text-slate-300" : ""}
                                                ${!isToday && !isCurrentMonth ? "text-slate-400 dark:text-slate-600" : ""}
                                            `}
                                        >
                                            {format(day, "d")}
                                        </span>
                                        {hasEvents && (
                                            <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400">
                                                {dayEvents.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* Event pills */}
                                    <div className="space-y-0.5">
                                        {dayEvents.slice(0, 3).map((event) => (
                                            <div
                                                key={event.id}
                                                className={`
                                                    rounded px-1.5 py-0.5 text-[10px] font-medium truncate leading-tight
                                                    ${event.is_public
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                                                    }
                                                `}
                                                title={`${event.event_time ? event.event_time.slice(0, 5) + " - " : ""}${event.title}`}
                                            >
                                                {event.event_time && (
                                                    <span className="opacity-75">{event.event_time.slice(0, 5)} </span>
                                                )}
                                                {event.title}
                                            </div>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-1.5 font-medium">
                                                +{dayEvents.length - 3} más
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Side Panel - Selected Day Details */}
                <div className="w-full lg:w-80 shrink-0">
                    <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden sticky top-4">
                        <div className="p-4 border-b dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                            <h3 className="font-semibold dark:text-white">
                                {selectedDay
                                    ? format(selectedDay, "EEEE d 'de' MMMM", { locale: es })
                                    : "Selecciona un día"
                                }
                            </h3>
                            {selectedDay && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {selectedDayEvents.length === 0 ? "Sin eventos" : `${selectedDayEvents.length} evento${selectedDayEvents.length > 1 ? "s" : ""}`}
                                </p>
                            )}
                        </div>

                        <div className="p-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                            {!selectedDay && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                                    Haz clic en un día del calendario para ver sus eventos
                                </p>
                            )}

                            {selectedDay && selectedDayEvents.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                        No hay eventos este día
                                    </p>
                                    <button
                                        onClick={() => openCreateModal(selectedDay)}
                                        className="text-sm text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1 mx-auto"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Agregar evento
                                    </button>
                                </div>
                            )}

                            {selectedDay && selectedDayEvents.length > 0 && (
                                <div className="space-y-2">
                                    {selectedDayEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`
                                                group relative rounded-lg border p-3 transition-all hover:shadow-md
                                                ${event.is_public
                                                    ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                                                    : "border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20"
                                                }
                                            `}
                                        >
                                            {/* Top row: badges + actions */}
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${event.is_public
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                                                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400"
                                                            }`}
                                                    >
                                                        {event.is_public ? (
                                                            <><Globe className="h-2.5 w-2.5" /> Público</>
                                                        ) : (
                                                            <><Lock className="h-2.5 w-2.5" /> Privado</>
                                                        )}
                                                    </span>
                                                    {event.recurrence && event.recurrence !== "once" && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                                                            <RefreshCw className="h-2.5 w-2.5" />
                                                            {recurrenceLabels[event.recurrence as RecurrenceType]}
                                                        </span>
                                                    )}
                                                </div>

                                                {event.created_by === profile?.id && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
                                                            className="text-slate-400 hover:text-blue-500 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                                                {event.title}
                                            </h4>

                                            {/* Description */}
                                            {event.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                    {event.description}
                                                </p>
                                            )}

                                            {/* Time */}
                                            {event.event_time && (
                                                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <Clock className="h-3 w-3" />
                                                    {event.event_time.slice(0, 5)}
                                                </div>
                                            )}

                                            {/* Participants indicator */}
                                            {event.participant_ids.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                    <Users className="h-3 w-3" />
                                                    {event.participant_ids.length} participante{event.participant_ids.length > 1 ? "s" : ""}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => openCreateModal(selectedDay)}
                                        className="w-full mt-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 p-2 text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Agregar evento
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
