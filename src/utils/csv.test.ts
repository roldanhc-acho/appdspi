import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { escapeCsvCell } from "./csv.ts"

describe("utils/csv", () => {
    it("neutralizes formula injection prefixes (CWE-1236)", () => {
        assert.equal(escapeCsvCell("=CMD()"), "\"'=CMD()\"")
        assert.equal(escapeCsvCell("+1+1"), "\"'+1+1\"")
        assert.equal(escapeCsvCell("-10"), "\"'-10\"")
        assert.equal(escapeCsvCell("@SUM(A1)"), "\"'@SUM(A1)\"")
    })

    it("escapes double quotes and handles nullish values", () => {
        assert.equal(escapeCsvCell('Hola "mundo"'), '"Hola ""mundo"""')
        assert.equal(escapeCsvCell(null), '""')
        assert.equal(escapeCsvCell(undefined), '""')
    })
})
