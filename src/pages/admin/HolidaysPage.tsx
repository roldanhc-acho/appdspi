import { useState, useMemo } from "react"
import { useHolidays } from "@/contexts/HolidaysContext"
import type { HolidayItem } from "@/utils/holidays"
import {
    Calendar as CalendarIcon,
    Plus,
    Trash2,
    Pencil,
    Search,
    RefreshCw,
    AlertCircle,
    CalendarOff,
    CheckCircle2,
    Clock,
    X,
    Loader2
} from "lucide-react"
import { format, parseISO, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"

export default function HolidaysPage() {
    const { holidays, loading, addHoliday, updateHoliday, deleteHoliday, resetToDefaults } = useHolidays()

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedYear, setSelectedYear] = useState<string>("2026")
    const [showModal, setShowModal] = useState(false)
    const [editingHoliday, setEditingHoliday] = useState<HolidayItem | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState<{
        date: string
        name: string
        type: "feriado" | "no_laborable"
    }>({
        date: format(new Date(), "yyyy-MM-dd"),
        name: "",
        type: "feriado"
    })

    const todayStr = format(new Date(), "yyyy-MM-dd")
    const today = new Date()

    // Available years in dataset
    const availableYears = useMemo(() => {
        const years = new Set<string>()
        years.add("2026")
        holidays.forEach(h => {
            if (h.date) {
                years.add(h.date.substring(0, 4))
            }
        })
        return Array.from(years).sort()
    }, [holidays])

    // Filtered holidays
    const filteredHolidays = useMemo(() => {
        return holidays.filter(h => {
            const matchesYear = selectedYear === "all" || h.date.startsWith(selectedYear)
            const matchesSearch =
                h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                h.date.includes(searchTerm)
            return matchesYear && matchesSearch
        }).sort((a, b) => a.date.localeCompare(b.date))
    }, [holidays, selectedYear, searchTerm])

    // KPI Metrics
    const metrics = useMemo(() => {
        const currentYearHolidays = holidays.filter(h => h.date.startsWith(selectedYear === "all" ? "2026" : selectedYear))
        const upcoming = holidays
            .filter(h => h.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
        
        const nextHoliday = upcoming[0] || null
        let daysToNext: number | null = null

        if (nextHoliday) {
            const nextDate = parseISO(nextHoliday.date)
            daysToNext = differenceInDays(nextDate, today)
            if (daysToNext < 0) daysToNext = 0
        }

        const currentMonthPrefix = format(today, "yyyy-MM")
        const thisMonthCount = holidays.filter(h => h.date.startsWith(currentMonthPrefix)).length

        return {
            totalYear: currentYearHolidays.length,
            nextHoliday,
            daysToNext,
            thisMonthCount
        }
    }, [holidays, selectedYear, todayStr])

    const handleOpenModal = (holiday?: HolidayItem) => {
        if (holiday) {
            setEditingHoliday(holiday)
            setFormData({
                date: holiday.date,
                name: holiday.name,
                type: holiday.type || "feriado"
            })
        } else {
            setEditingHoliday(null)
            setFormData({
                date: format(new Date(), "yyyy-MM-dd"),
                name: "",
                type: "feriado"
            })
        }
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim() || !formData.date) return

        setIsSaving(true)
        try {
            if (editingHoliday) {
                await updateHoliday(editingHoliday.id, {
                    date: formData.date,
                    name: formData.name.trim(),
                    type: formData.type
                })
            } else {
                await addHoliday({
                    date: formData.date,
                    name: formData.name.trim(),
                    type: formData.type
                })
            }
            setShowModal(false)
        } catch (error) {
            console.error("Error guardando feriado:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteHoliday(id)
            setConfirmDeleteId(null)
        } catch (error) {
            console.error("Error eliminando feriado:", error)
        }
    }

    const handleResetDefaults = async () => {
        setIsResetting(true)
        try {
            await resetToDefaults()
        } finally {
            setIsResetting(false)
        }
    }

    const formatHolidayDate = (dateStr: string) => {
        try {
            const parsed = parseISO(dateStr)
            return format(parsed, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
        } catch {
            return dateStr
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CalendarOff className="h-7 w-7 text-primary" />
                        Gestión de Días Feriados y No Laborables
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Registra los feriados oficiales y días no laborables para el cálculo automático de horas laborales.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleResetDefaults}
                        disabled={isResetting}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all disabled:opacity-50"
                        title="Restablecer feriados nacionales oficiales de 2026"
                    >
                        <RefreshCw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
                        Feriados Oficiales
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar Feriado
                    </button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Feriados ({selectedYear === "all" ? "2026" : selectedYear})
                        </span>
                        <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">
                            {metrics.totalYear}
                        </span>
                        <span className="text-xs text-slate-500">días no laborables</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Próximo Feriado
                        </span>
                        <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                            <Clock className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        {metrics.nextHoliday ? (
                            <div>
                                <p className="text-base font-bold text-slate-900 dark:text-white truncate" title={metrics.nextHoliday.name}>
                                    {metrics.nextHoliday.name}
                                </p>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 capitalize mt-0.5">
                                    {formatHolidayDate(metrics.nextHoliday.date)} ({metrics.daysToNext === 0 ? "¡Hoy!" : `en ${metrics.daysToNext} días`})
                                </p>
                            </div>
                        ) : (
                            <span className="text-sm text-slate-500">Sin próximos feriados</span>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Feriados del Mes Actual
                        </span>
                        <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">
                            {metrics.thisMonthCount}
                        </span>
                        <span className="text-xs text-slate-500">en {format(today, "MMMM", { locale: es })}</span>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o fecha..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Año:</span>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="all">Todos los años</option>
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Holidays Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        Cargando feriados...
                    </div>
                ) : filteredHolidays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <AlertCircle className="h-10 w-10 text-slate-400 mb-2" />
                        <p className="text-base font-semibold">No se encontraron feriados</p>
                        <p className="text-sm text-slate-400">Intenta cambiar los filtros de búsqueda o agrega un nuevo feriado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Día</th>
                                    <th className="px-6 py-4">Nombre / Motivo</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {filteredHolidays.map(item => {
                                    const isPast = item.date < todayStr
                                    const isToday = item.date === todayStr

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors ${
                                                isToday ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                                            }`}
                                        >
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                                                {item.date}
                                            </td>
                                            <td className="px-6 py-4 capitalize font-medium">
                                                {formatHolidayDate(item.date)}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                                {item.name}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        item.type === "no_laborable"
                                                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                    }`}
                                                >
                                                    {item.type === "no_laborable" ? "Día No Laborable" : "Feriado Nacional"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isToday ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                                        ¡Hoy!
                                                    </span>
                                                ) : isPast ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                        Pasado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                        Próximo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                        title="Editar feriado"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    {confirmDeleteId === item.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                                                            >
                                                                Confirmar
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDeleteId(item.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                            title="Eliminar feriado"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-950 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                {editingHoliday ? "Editar Feriado" : "Registrar Nuevo Feriado"}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                                    Fecha
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                                    Nombre / Motivo
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Paso a la Inmortalidad del Gral. José de San Martín"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                                    Tipo de Día
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="feriado">Feriado Nacional / Inamovible</option>
                                    <option value="no_laborable">Día No Laborable / Optativo</option>
                                </select>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50"
                                >
                                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingHoliday ? "Guardar Cambios" : "Agregar Feriado"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
