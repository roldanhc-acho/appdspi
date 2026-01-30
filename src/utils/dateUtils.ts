/**
 * Date utilities for handling timezone-safe date operations.
 * 
 * The main problem: When a date like "2026-01-09" is stored in the database,
 * it gets interpreted as UTC midnight. When displayed in Argentina (UTC-3),
 * that becomes 21:00 of the PREVIOUS day (2026-01-08).
 * 
 * Solution: Parse dates by extracting just the date part and treating it as local.
 */

/**
 * Safely parses a date string to get a Date object at noon local time.
 * This prevents timezone issues when displaying dates.
 * 
 * @param dateString - ISO date string or date-only string (e.g., "2026-01-09" or "2026-01-09T00:00:00Z")
 * @returns Date object at noon local time, or null if invalid
 */
export function parseLocalDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null

    // Extract just the date part (YYYY-MM-DD)
    const datePart = dateString.split('T')[0]

    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null

    // Create date at noon local time to avoid timezone edge cases
    const [year, month, day] = datePart.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0)
}

/**
 * Formats a date string for display using local timezone.
 * 
 * @param dateString - ISO date string or date-only string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string, or empty string if invalid
 */
export function formatLocalDate(
    dateString: string | null | undefined,
    options?: Intl.DateTimeFormatOptions
): string {
    const date = parseLocalDate(dateString)
    if (!date) return ''

    return date.toLocaleDateString('es-AR', options || {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    })
}

/**
 * Formats a date for input[type="date"] fields (YYYY-MM-DD format).
 * 
 * @param dateString - ISO date string or date-only string
 * @returns Date string in YYYY-MM-DD format, or empty string if invalid
 */
export function formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return ''

    // Extract just the date part (YYYY-MM-DD)
    const datePart = dateString.split('T')[0]

    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return ''

    return datePart
}

/**
 * Prepares a date for saving to the database.
 * Adds T12:00:00 to prevent UTC conversion issues.
 * 
 * @param dateString - Date string in YYYY-MM-DD format (from input[type="date"])
 * @returns ISO string with time at noon, or null if empty
 */
export function prepareDateForSave(dateString: string): string | null {
    if (!dateString) return null
    return `${dateString}T12:00:00`
}
