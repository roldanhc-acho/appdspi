import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Users, Download, Loader2, Database } from "lucide-react"

type UserStats = {
    userId: string
    fullName: string
    avatarUrl: string | null
    bankHoursTotal: number
}

export default function HourBankReportPage() {
    const [userStats, setUserStats] = useState<UserStats[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [profilesRes, hourBanksRes] = await Promise.all([
                supabase.from("profiles").select("*").neq("is_active", false).order("full_name"),
                supabase.from("hour_bank").select("user_id, hours_saved, month")
            ])

            const profiles = profilesRes.data
            const hourBanks = hourBanksRes.data

            if (!profiles || profiles.length === 0) {
                setUserStats([])
                setLoading(false)
                return
            }

            // Calculate stats for each user
            const stats: UserStats[] = profiles.map(user => {
                // Bank hours total = sum of all hours_saved for this user
                const userBanks = (hourBanks || []).filter(b => b.user_id === user.id)
                const bankHoursTotal = userBanks.reduce((acc, b) => acc + (b.hours_saved || 0), 0)

                return {
                    userId: user.id,
                    fullName: user.full_name || 'Sin nombre',
                    avatarUrl: user.avatar_url,
                    bankHoursTotal
                }
            })

            stats.sort((a, b) => a.fullName.localeCompare(b.fullName))
            setUserStats(stats)
        } catch (error) {
            console.error("[HourBankReport] Error:", error)
        }
        setLoading(false)
    }

    const exportToCSV = () => {
        const headers = ['Usuario', 'Banco de Horas Total']
        const rows = userStats.map(u => [
            u.fullName,
            u.bankHoursTotal
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `banco_de_horas_total.csv`
        link.click()
    }

    // Totals
    const totals = useMemo(() => ({
        bankHoursTotal: userStats.reduce((acc, u) => acc + u.bankHoursTotal, 0)
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
                    <h1 className="text-2xl font-bold dark:text-white">Acumulado Banco de Horas</h1>
                    <p className="text-slate-500">Vista general del acumulado de banco de horas por usuario</p>
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

            {/* Users Table */}
            <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                {userStats.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No se encontraron usuarios.
                    </div>
                ) : (
                    <div className="max-h-[calc(100vh-200px)] overflow-auto">
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
                                        Banco de Horas Total
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
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${user.bankHoursTotal >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                {user.bankHoursTotal > 0 ? '+' : ''}{user.bankHoursTotal}h
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
                                    <td className="px-4 py-3 text-right">
                                        <span className={totals.bankHoursTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                            {totals.bankHoursTotal > 0 ? '+' : ''}{totals.bankHoursTotal}h
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
