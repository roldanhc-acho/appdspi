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
                    return parsed
                }
            }
        } catch (e) {
            console.error("Error reading holidays from localStorage", e)
        }
        return DEFAULT_HOLIDAYS
    })
    const [loading, setLoading] = useState(true)

    // Save to localStorage whenever state changes
    const updateLocalHolidays = (newList: HolidayItem[]) => {
        setHolidays(newList)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newList))
        } catch (e) {
            console.error("Error writing holidays to localStorage", e)
        }
    }

    const fetchHolidays = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from("holidays")
                .select("*")
                .order("date", { ascending: true })

            if (!error && data && data.length > 0) {
                // Merge database holidays with defaults (ensure defaults exist if not explicitly deleted)
                const dbHolidays: HolidayItem[] = data.map((item: any) => ({
                    id: item.id,
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
                updateLocalHolidays(merged)
            } else {
                // If table doesn't exist yet or has no data, ensure we use cached or default list
                if (holidays.length === 0) {
                    updateLocalHolidays(DEFAULT_HOLIDAYS)
                }
            }
        } catch (err) {
            console.warn("Could not fetch holidays from Supabase, using local fallback", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchHolidays()
    }, [fetchHolidays])

    const addHoliday = async (newHoliday: Omit<HolidayItem, "id">) => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const itemToAdd: HolidayItem = {
            ...newHoliday,
            id,
            is_custom: true,
            created_at: new Date().toISOString()
        }

        // Try persisting to Supabase
        try {
            await supabase.from("holidays").insert([{
                id,
                date: itemToAdd.date,
                name: itemToAdd.name,
                type: itemToAdd.type,
                is_custom: true
            }])
        } catch (err) {
            console.warn("Could not insert holiday into Supabase table", err)
        }

        const updated = [...holidays.filter(h => h.id !== id && h.date !== itemToAdd.date), itemToAdd]
            .sort((a, b) => a.date.localeCompare(b.date))
        updateLocalHolidays(updated)
    }

    const updateHoliday = async (id: string, updatedData: Partial<HolidayItem>) => {
        try {
            await supabase.from("holidays").update(updatedData).eq("id", id)
        } catch (err) {
            console.warn("Could not update holiday in Supabase", err)
        }

        const updated = holidays.map(h => h.id === id ? { ...h, ...updatedData } : h)
            .sort((a, b) => a.date.localeCompare(b.date))
        updateLocalHolidays(updated)
    }

    const deleteHoliday = async (id: string) => {
        try {
            await supabase.from("holidays").delete().eq("id", id)
        } catch (err) {
            console.warn("Could not delete holiday from Supabase", err)
        }

        const updated = holidays.filter(h => h.id !== id)
        updateLocalHolidays(updated)
    }

    const resetToDefaults = async () => {
        updateLocalHolidays(DEFAULT_HOLIDAYS)
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
