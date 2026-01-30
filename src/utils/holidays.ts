import { isWeekend, format } from "date-fns"

export const HOLIDAYS_2026 = [
    "2026-01-01", // Año Nuevo
    "2026-02-16", // Carnaval
    "2026-02-17", // Carnaval
    "2026-03-24", // Día Nacional de la Memoria por la Verdad y la Justicia
    "2026-04-02", // Día del Veterano y de los Caídos en la Guerra de Malvinas
    "2026-04-03", // Viernes Santo
    "2026-05-01", // Día del Trabajador
    "2026-05-25", // Día de la Revolución de Mayo
    "2026-06-20", // Paso a la Inmortalidad del General Manuel Belgrano
    "2026-07-09", // Día de la Independencia
    "2026-12-08", // Día de la Inmaculada Concepción de María
    "2026-12-25", // Navidad
]

/**
 * Checks if a given date is a holiday or a weekend.
 */
export function isNonWorkingDay(date: Date): boolean {
    if (isWeekend(date)) return true
    const dateStr = format(date, "yyyy-MM-dd")
    return HOLIDAYS_2026.includes(dateStr)
}

/**
 * Calculates the number of working days between two dates (inclusive).
 */
export function countWorkingDays(start: Date, end: Date): number {
    let count = 0
    const current = new Date(start)
    current.setHours(0, 0, 0, 0)
    const last = new Date(end)
    last.setHours(0, 0, 0, 0)

    while (current <= last) {
        if (!isNonWorkingDay(current)) {
            count++
        }
        current.setDate(current.getDate() + 1)
    }
    return count
}
