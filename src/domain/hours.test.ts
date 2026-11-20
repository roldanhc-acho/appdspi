import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { calculateMonthlyUserMetrics, isValidHoursInput, roundHours, sumHourBank } from "./hours.ts"

describe("domain/hours", () => {
    it("roundHours avoids IEEE-754 float drift", () => {
        assert.equal(roundHours(0.1 + 0.2), 0.3)
        assert.equal(roundHours(1.005), 1.01)
        assert.equal(roundHours(NaN), 0)
    })

    it("sumHourBank sums and rounds hours_saved", () => {
        assert.equal(sumHourBank([{ hours_saved: 1.1 }, { hours_saved: 2.2 }, { hours_saved: null }]), 3.3)
    })

    it("isValidHoursInput enforces (0, 24]", () => {
        assert.equal(isValidHoursInput(0), false)
        assert.equal(isValidHoursInput(-1), false)
        assert.equal(isValidHoursInput(24.5), false)
        assert.equal(isValidHoursInput(8.5), true)
        assert.equal(isValidHoursInput(24), true)
    })

    it("calculateMonthlyUserMetrics computes productivity, bank, and manual productive hours", () => {
        const result = calculateMonthlyUserMetrics({
            dailyHours: 9,
            workingDaysCount: 20,
            hoursRegistered: 175.5,
            absenceHoursInWorkingDays: 9,
            bankHoursUsed: 2.5,
            manualProductiveHours: 3,
        })
        assert.equal(result.expectedHours, 180)
        assert.equal(result.effectiveHours, 184.5)
        assert.equal(result.rawProductivity, 4.5)
        assert.equal(result.productivityHours, 5)
    })
})
