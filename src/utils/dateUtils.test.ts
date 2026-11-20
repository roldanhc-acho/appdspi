import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getLocalTodayISO, parseLocalDate } from "./dateUtils.ts"

describe("utils/dateUtils", () => {
    it("getLocalTodayISO formats local calendar date without UTC shift", () => {
        const lateNightLocal = new Date(2026, 10, 20, 23, 30, 0)
        assert.equal(getLocalTodayISO(lateNightLocal), "2026-11-20")
    })

    it("parseLocalDate creates noon local date from YYYY-MM-DD", () => {
        const parsed = parseLocalDate("2026-11-20")
        assert.ok(parsed)
        assert.equal(parsed.getFullYear(), 2026)
        assert.equal(parsed.getMonth(), 10)
        assert.equal(parsed.getDate(), 20)
        assert.equal(parsed.getHours(), 12)
    })
})
