import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import {
    format,
    startOfMonth,
    endOfMonth,
    addMonths,
    subMonths,
    eachDayOfInterval,
    isWeekend
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Download, Loader2 } from "lucide-react"
import { isNonWorkingDay } from "@/utils/holidays"

type UserStats = {
    userId: string
    fullName: string
    avatarUrl: string | null
    hoursRegistered: number
    absenceHours: number
    productivityHours: number
    bankHours: number
}

export default function MonthlyReportPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [userStats, setUserStats] = useState<UserStats[]>([])
    const [loading, setLoading] = useState(true)

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const formattedMonth = format(monthStart, 'MMMM yyyy', { locale: es })
    const currentMonthStr = format(monthStart, 'yyyy-MM')

    // Calculate working days in month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const workingDays = daysInMonth.filter(d => !isWeekend(d) && !isNonWorkingDay(d)).length
    const expectedHours = workingDays * 9 // 9 hours per working day

    useEffect(() => {
        fetchData()
    }, [currentDate])

    const fetchData = async () => {
        setLoading(true)
        try {
            const monthStartStr = format(monthStart, 'yyyy-MM-dd')
            const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

            // Fetch all data in parallel (same pattern as ProductiveHoursPage)
            const [profilesRes, timeLogsRes, absencesRes, hourBanksRes] = await Promise.all([
                supabase.from("profiles").select("*").neq("is_active", false).order("full_name"),
                supabase.from("time_logs").select("user_id, hours_worked").gte("date", monthStartStr).lte("date", monthEndStr),
                supabase.from("absences").select("user_id, start_date, end_date, type, status").eq("status", "approved"),
                supabase.from("hour_bank").select("user_id, hours_saved, month")
            ])

            const profiles = profilesRes.data
            const timeLogs = timeLogsRes.data
            const absences = absencesRes.data
            const hourBanks = hourBanksRes.data

            console.log("[MonthlyReport] Profiles:", profiles?.length, "Error:", profilesRes.error)
            console.log("[MonthlyReport] TimeLogs:", timeLogs?.length, "Error:", timeLogsRes.error)
            console.log("[MonthlyReport] Absences:", absences?.length, "Error:", absencesRes.error)
            console.log("[MonthlyReport] HourBanks:", hourBanks?.length, "Error:", hourBanksRes.error)

            if (!profiles || profiles.length === 0) {
                setUserStats([])
                setLoading(false)
                return
            }

            // Calculate stats for each user
            const stats: UserStats[] = profiles.map(user => {
                // Hours registered this month
                const userLogs = (timeLogs || []).filter(l => l.user_id === user.id)
                const hoursRegistered = userLogs.reduce((acc, l) => acc + l.hours_worked, 0)

                // Calculate absence hours (9h per absence day in this month)
                const userAbsences = (absences || []).filter(a => a.user_id === user.id)
                let absenceHours = 0

                userAbsences.forEach(absence => {
                    daysInMonth.forEach(day => {
                        const dayStr = format(day, 'yyyy-MM-dd')
                        if (dayStr >= absence.start_date && dayStr <= absence.end_date) {
                            if (!isWeekend(day) && !isNonWorkingDay(day)) {
                                absenceHours += 9
                            }
                        }
                    })
                })

                // Productivity = (registered + absences) - expected
                const effectiveHours = hoursRegistered + absenceHours
                const rawProductivity = effectiveHours - expectedHours

                // Bank hours for current month only
                const currentMonthBank = (hourBanks || []).find(b => b.user_id === user.id && b.month === currentMonthStr)
                const bankHoursThisMonth = currentMonthBank?.hours_saved || 0

                // Bank hours total = sum of all hours_saved for this user
                const userBanks = (hourBanks || []).filter(b => b.user_id === user.id)
                const bankHours = userBanks.reduce((acc, b) => acc + (b.hours_saved || 0), 0)

                // Productivity displayed = raw productivity minus what was saved to bank this month
                const productivityHours = rawProductivity - bankHoursThisMonth

                return {
                    userId: user.id,
                    fullName: user.full_name || 'Sin nombre',
                    avatarUrl: user.avatar_url,
                    hoursRegistered,
                    absenceHours,
                    productivityHours,
                    bankHours
                }
            })

            stats.sort((a, b) => a.fullName.localeCompare(b.fullName))
            setUserStats(stats)
        } catch (error) {
            console.error("[MonthlyReport] Error:", error)
        }
        setLoading(false)
    }

    const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const handleCurrentMonth = () => setCurrentDate(new Date())

    const exportToCSV = () => {
        const headers = ['Usuario', 'Horas Registradas', 'Horas RRHH', 'Productividad', 'Banco de Horas']
        const rows = userStats.map(u => [
            u.fullName,
            u.hoursRegistered,
            u.absenceHours,
            u.productivityHours,
            u.bankHours
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `resumen_mensual_${currentMonthStr}.csv`
        link.click()
    }

    // Totals
    const totals = useMemo(() => ({
        hoursRegistered: userStats.reduce((acc, u) => acc + u.hoursRegistered, 0),
        absenceHours: userStats.reduce((acc, u) => acc + u.absenceHours, 0),
        productivityHours: userStats.reduce((acc, u) => acc + u.productivityHours, 0),
        bankHours: userStats.reduce((acc, u) => acc + u.bankHours, 0)
    }), [userStats])

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white">Resumen Mensual</h1>
                    <p className="text-slate-500">Vista general de horas de todos los usuarios</p>
                </div>
                <button
                    onClick={exportToCSV}
                    disabled={userStats.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Month Navigation */}
            <div className="rounded-xl border bg-slate-900 p-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-slate-400" />
                        <span className="text-slate-400">Período:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handlePreviousMonth} className="p-2 rounded hover:bg-slate-800 border border-slate-700">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-medium px-4 capitalize min-w-[160px] text-center">
                            {formattedMonth}
                        </span>
                        <button onClick={handleNextMonth} className="p-2 rounded hover:bg-slate-800 border border-slate-700">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button onClick={handleCurrentMonth} className="flex items-center gap-2 px-3 py-2 rounded border border-slate-700 hover:bg-slate-800 text-sm ml-2">
                            Mes actual
                        </button>
                    </div>

                    <div className="text-sm text-slate-400">
                        {workingDays} días laborables · {expectedHours}h esperadas/usuario
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                {userStats.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No se encontraron usuarios.
                        <br />
                        <span className="text-xs">Revisa la consola (F12) para ver logs de debug.</span>
                    </div>
                ) : (
                    <div className="max-h-[calc(100vh-300px)] overflow-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Usuario
                                        </div>
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                        Horas Registradas
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                        Horas RRHH
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                        Productividad
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                                        Banco de Horas
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {userStats.map(user => (
                                    <tr key={user.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {user.avatarUrl ? (
                                                    <img
                                                        src={user.avatarUrl}
                                                        alt={user.fullName}
                                                        className="h-8 w-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                                                        {user.fullName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {user.fullName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                                            {user.hoursRegistered}h
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`${user.absenceHours > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {user.absenceHours}h
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-medium ${user.productivityHours >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {user.productivityHours > 0 ? '+' : ''}{user.productivityHours}h
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${user.bankHours >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                {user.bankHours > 0 ? '+' : ''}{user.bankHours}h
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 dark:bg-slate-800 font-semibold">
                                <tr>
                                    <td className="px-4 py-3 text-slate-900 dark:text-white">
                                        TOTAL ({userStats.length} usuarios)
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                                        {totals.hoursRegistered}h
                                    </td>
                                    <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                                        {totals.absenceHours}h
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={totals.productivityHours >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                            {totals.productivityHours > 0 ? '+' : ''}{totals.productivityHours}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={totals.bankHours >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                            {totals.bankHours > 0 ? '+' : ''}{totals.bankHours}h
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
