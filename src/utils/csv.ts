/**
 * Sanitizes and escapes a cell value for safe CSV export.
 * Prevents CSV Formula Injection (CWE-1236) by prefixing dangerous leading characters.
 */
export function escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '""'
    let str = String(value)
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`
    }
    return `"${str.replace(/"/g, '""')}"`
}

/**
 * Serializes rows into a UTF-8 BOM CSV file and triggers a safe browser download,
 * revoking the object URL afterwards to avoid memory leaks.
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
    const csvLines = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ]
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
