import { isWeekend, format } from "date-fns"

export interface HolidayItem {
    id: string
    date: string // YYYY-MM-DD
    name: string
    type: "feriado" | "no_laborable"
    is_custom?: boolean
    created_at?: string
}

export const DEFAULT_HOLIDAYS: HolidayItem[] = [
    { id: "default-2026-01-01", date: "2026-01-01", name: "Año Nuevo", type: "feriado" },
    { id: "default-2026-02-16", date: "2026-02-16", name: "Carnaval", type: "feriado" },
    { id: "default-2026-02-17", date: "2026-02-17", name: "Carnaval", type: "feriado" },
    { id: "default-2026-03-24", date: "2026-03-24", name: "Día Nacional de la Memoria por la Verdad y la Justicia", type: "feriado" },
    { id: "default-2026-04-02", date: "2026-04-02", name: "Día del Veterano y de los Caídos en la Guerra de Malvinas", type: "feriado" },
    { id: "default-2026-04-03", date: "2026-04-03", name: "Viernes Santo", type: "feriado" },
    { id: "default-2026-05-01", date: "2026-05-01", name: "Día del Trabajador", type: "feriado" },
    { id: "default-2026-05-25", date: "2026-05-25", name: "Día de la Revolución de Mayo", type: "feriado" },
    { id: "default-2026-06-15", date: "2026-06-15", name: "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes", type: "feriado" },
    { id: "default-2026-06-20", date: "2026-06-20", name: "Paso a la Inmortalidad del General Manuel Belgrano", type: "feriado" },
    { id: "default-2026-07-09", date: "2026-07-09", name: "Día de la Independencia", type: "feriado" },
    { id: "default-2026-08-17", date: "2026-08-17", name: "Paso a la Inmortalidad del Gral. José de San Martín", type: "feriado" },
    { id: "default-2026-12-08", date: "2026-12-08", name: "Día de la Inmaculada Concepción de María", type: "feriado" },
    { id: "default-2026-12-25", date: "2026-12-25", name: "Navidad", type: "feriado" },
]

export const HOLIDAYS_2026 = DEFAULT_HOLIDAYS.map(h => h.date)

/**
 * Helper to get active dates list from items or strings
 */
export function extractHolidayDates(holidaysList?: (string | HolidayItem)[]): string[] {
    if (!holidaysList) return HOLIDAYS_2026
    return holidaysList.map(item => typeof item === "string" ? item : item.date)
}

/**
 * Checks if a given date is a holiday or a weekend.
 */
export function isNonWorkingDay(date: Date, holidaysList?: (string | HolidayItem)[]): boolean {
    if (isWeekend(date)) return true
    const dateStr = format(date, "yyyy-MM-dd")
    const dates = extractHolidayDates(holidaysList)
    return dates.includes(dateStr)
}

/**
 * Calculates the number of working days between two dates (inclusive).
 */
export function countWorkingDays(start: Date, end: Date, holidaysList?: (string | HolidayItem)[]): number {
    let count = 0
    const current = new Date(start)
    current.setHours(0, 0, 0, 0)
    const last = new Date(end)
    last.setHours(0, 0, 0, 0)

    while (current <= last) {
        if (!isNonWorkingDay(current, holidaysList)) {
            count++
        }
        current.setDate(current.getDate() + 1)
    }
    return count
}
