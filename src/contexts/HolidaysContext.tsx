import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
    DEFAULT_HOLIDAYS,
    type HolidayItem,
    isNonWorkingDay as checkIsNonWorkingDay,
    countWorkingDays as checkCountWorkingDays
} from "@/utils/holidays"

const STORAGE_KEY = "dspi_holidays_v1"

interface HolidaysContextType {
    holidays: HolidayItem[]
    loading: boolean
    isTableMissing: boolean
    addHoliday: (holiday: Omit<HolidayItem, "id">) => Promise<void>
    updateHoliday: (id: string, updated: Partial<HolidayItem>) => Promise<void>
    deleteHoliday: (id: string) => Promise<void>
    resetToDefaults: () => Promise<void>
    isNonWorkingDay: (date: Date) => boolean
    countWorkingDays: (start: Date, end: Date) => number
    refetch: () => Promise<void>
}

const HolidaysContext = createContext<HolidaysContextType | undefined>(undefined)

export function HolidaysProvider({ children }: { children: React.ReactNode }) {
    const [holidays, setHolidays] = useState<HolidayItem[]>(() => {
        try {
            const cached = localStorage.getItem(STORAGE_KEY)
            if (cached) {
                const parsed: HolidayItem[] = JSON.parse(cached)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Ensure all default holidays are included alongside cached custom ones
                    const cachedDates = new Set(parsed.map(h => h.date))
                    const missingDefaults = DEFAULT_HOLIDAYS.filter(dh => !cachedDates.has(dh.date))
                    return [...parsed, ...missingDefaults].sort((a, b) => a.date.localeCompare(b.date))
                }
            }
        } catch (e) {
            console.error("Error reading holidays from localStorage", e)
        }
        return DEFAULT_HOLIDAYS
    })
    const [loading, setLoading] = useState(true)
    const [isTableMissing, setIsTableMissing] = useState(false)

    // Helper to persist list in localStorage and state
    const saveHolidaysState = useCallback((newList: HolidayItem[]) => {
        setHolidays(newList)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newList))
        } catch (e) {
            console.error("Error writing holidays to localStorage", e)
        }
    }, [])

    const fetchHolidays = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from("holidays")
                .select("*")
                .order("date", { ascending: true })

            if (error) {
                if (error.code === "PGRST205" || error.message?.includes("holidays")) {
                    console.warn("Tabla 'holidays' no encontrada en Supabase. Usando respaldo local.")
                    setIsTableMissing(true)
                } else {
                    console.warn("Error consultando holidays en Supabase:", error)
                }
                
                // If DB query fails, ensure DEFAULT_HOLIDAYS (including Oct 12) are merged with any existing custom ones
                setHolidays(prev => {
                    const existingDates = new Set(prev.map(h => h.date))
                    const missingDefaults = DEFAULT_HOLIDAYS.filter(dh => !existingDates.has(dh.date))
                    if (missingDefaults.length > 0) {
                        const merged = [...prev, ...missingDefaults].sort((a, b) => a.date.localeCompare(b.date))
                        try {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
                        } catch {}
                        return merged
                    }
                    return prev
                })
            } else if (data && data.length > 0) {
                setIsTableMissing(false)
                const dbHolidays: HolidayItem[] = data.map((item: any) => ({
                    id: String(item.id),
                    date: item.date,
                    name: item.name,
                    type: item.type || "feriado",
                    is_custom: item.is_custom !== undefined ? item.is_custom : true,
                    created_at: item.created_at
                }))
                
                // Keep default holidays that aren't overwritten
                const dbDates = new Set(dbHolidays.map(h => h.date))
                const missingDefaults = DEFAULT_HOLIDAYS.filter(dh => !dbDates.has(dh.date))
                const merged = [...dbHolidays, ...missingDefaults].sort((a, b) => a.date.localeCompare(b.date))
                saveHolidaysState(merged)
            } else {
                // Table exists but is empty -> seed with defaults
                setIsTableMissing(false)
                saveHolidaysState(DEFAULT_HOLIDAYS)
            }
        } catch (err) {
            console.warn("Could not fetch holidays from Supabase, using local fallback", err)
        } finally {
            setLoading(false)
        }
    }, [saveHolidaysState])

    useEffect(() => {
        fetchHolidays()
    }, [fetchHolidays])

    const addHoliday = async (newHoliday: Omit<HolidayItem, "id">) => {
        let insertedId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        let createdAt = new Date().toISOString()
        let dbWarning: string | null = null

        // Try persisting to Supabase
        try {
            const { data, error } = await supabase.from("holidays").insert([{
                date: newHoliday.date,
                name: newHoliday.name,
                type: newHoliday.type,
                is_custom: true
            }]).select("id, created_at").maybeSingle()

            if (error) {
                console.error("Error insertando feriado en Supabase:", error)
                if (error.code === "PGRST205" || error.message?.includes("holidays")) {
                    setIsTableMissing(true)
                    dbWarning = "La tabla 'holidays' aún no existe en Supabase. El feriado se guardó temporalmente en este navegador, pero debes crear la tabla en Supabase para que sea visible por todos los usuarios."
                } else {
                    dbWarning = `Error de base de datos: ${error.message}`
                }
            } else if (data?.id) {
                insertedId = String(data.id)
                if (data.created_at) createdAt = data.created_at
                setIsTableMissing(false)
            }
        } catch (err: any) {
            console.warn("Could not insert holiday into Supabase table", err)
            dbWarning = err?.message || "No se pudo conectar a la base de datos."
        }

        const itemToAdd: HolidayItem = {
            ...newHoliday,
            id: insertedId,
            is_custom: true,
            created_at: createdAt
        }

        setHolidays(prev => {
            const updated = [...prev.filter(h => h.id !== insertedId && h.date !== itemToAdd.date), itemToAdd]
                .sort((a, b) => a.date.localeCompare(b.date))
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            } catch (e) {
                console.error("Error writing holidays to localStorage", e)
            }
            return updated
        })

        if (dbWarning) {
            // Throw so caller UI can display feedback if desired
            throw new Error(dbWarning)
        }
    }

    const updateHoliday = async (id: string, updatedData: Partial<HolidayItem>) => {
        try {
            const { error } = await supabase.from("holidays").update(updatedData).eq("id", id)
            if (error) {
                console.warn("Could not update holiday in Supabase", error)
                if (error.code === "PGRST205") setIsTableMissing(true)
            }
        } catch (err) {
            console.warn("Could not update holiday in Supabase", err)
        }

        setHolidays(prev => {
            const updated = prev.map(h => h.id === id ? { ...h, ...updatedData } : h)
                .sort((a, b) => a.date.localeCompare(b.date))
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            } catch (e) {
                console.error("Error writing holidays to localStorage", e)
            }
            return updated
        })
    }

    const deleteHoliday = async (id: string) => {
        try {
            const { error } = await supabase.from("holidays").delete().eq("id", id)
            if (error) {
                console.warn("Could not delete holiday from Supabase", error)
                if (error.code === "PGRST205") setIsTableMissing(true)
            }
        } catch (err) {
            console.warn("Could not delete holiday from Supabase", err)
        }

        setHolidays(prev => {
            const updated = prev.filter(h => h.id !== id)
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            } catch (e) {
                console.error("Error writing holidays to localStorage", e)
            }
            return updated
        })
    }

    const resetToDefaults = async () => {
        saveHolidaysState(DEFAULT_HOLIDAYS)
    }

    const isNonWorkingDay = (date: Date) => {
        return checkIsNonWorkingDay(date, holidays)
    }

    const countWorkingDays = (start: Date, end: Date) => {
        return checkCountWorkingDays(start, end, holidays)
    }

    return (
        <HolidaysContext.Provider
            value={{
                holidays,
                loading,
                isTableMissing,
                addHoliday,
                updateHoliday,
                deleteHoliday,
                resetToDefaults,
                isNonWorkingDay,
                countWorkingDays,
                refetch: fetchHolidays
            }}
        >
            {children}
        </HolidaysContext.Provider>
    )
}

export function useHolidays() {
    const context = useContext(HolidaysContext)
    if (!context) {
        throw new Error("useHolidays must be used within a HolidaysProvider")
    }
    return context
}
