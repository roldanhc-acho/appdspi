/**
 * Functional Core: Pure domain calculations for hours, productivity, and hour bank.
 * No side effects, no Supabase/network dependencies.
 */

export function roundHours(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.round((value + Number.EPSILON) * 100) / 100
}

export function sumHourBank(entries: ReadonlyArray<{ hours_saved?: number | null }>): number {
    const total = entries.reduce((acc, item) => acc + (item.hours_saved || 0), 0)
    return roundHours(total)
}

export function isValidHoursInput(hours: number): boolean {
    return Number.isFinite(hours) && hours > 0 && hours <= 24
}

export interface MonthlyUserCalcInput {
    dailyHours: number | null | undefined
    workingDaysCount: number
    hoursRegistered: number
    absenceHoursInWorkingDays: number
    bankHoursUsed: number
    manualProductiveHours?: number
}

export interface MonthlyUserCalcResult {
    dailyHours: number
    expectedHours: number
    hoursRegistered: number
    absenceHours: number
    effectiveHours: number
    rawProductivity: number
    bankHoursUsed: number
    manualProductiveHours: number
    productivityHours: number
}

export function calculateMonthlyUserMetrics(input: MonthlyUserCalcInput): MonthlyUserCalcResult {
    const dailyHours = input.dailyHours ?? 9
    const expectedHours = roundHours(input.workingDaysCount * dailyHours)
    const hoursRegistered = roundHours(input.hoursRegistered)
    const absenceHours = roundHours(input.absenceHoursInWorkingDays)
    const effectiveHours = roundHours(hoursRegistered + absenceHours)
    const rawProductivity = roundHours(effectiveHours - expectedHours)
    const bankHoursUsed = roundHours(input.bankHoursUsed)
    const manualProductiveHours = roundHours(input.manualProductiveHours ?? 0)
    const productivityHours = roundHours(rawProductivity - bankHoursUsed + manualProductiveHours)

    return {
        dailyHours,
        expectedHours,
        hoursRegistered,
        absenceHours,
        effectiveHours,
        rawProductivity,
        bankHoursUsed,
        manualProductiveHours,
        productivityHours,
    }
}
