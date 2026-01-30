
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const VETKIOSK_ID = '7fb22b64-307b-439e-a845-4847838b1240'

const userMap = {
    "TORLETTI, Andres": "ab74ae21-52f4-4552-a66c-bccc511edc32",
    "AGUSTIN": "ceeb086c-5918-4496-b1ce-7754a4276838",
    "HORACIO": "aee2d05a-212b-4aea-827f-62ea861de2db",
    "DOMINGUEZ, Pablo": "72e81f8a-ad65-46d6-ae71-1437a3a490f2",
    "SANCHEZ, Sergio": "a99cebc8-083a-4932-8e0b-41a51a29507a",
    "PISCIOTTA, Fabricio": "8254b2c5-7167-4035-8123-cc0b57663ea8"
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/)
    const result = []
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const row = []
        let current = ''
        let inQuotes = false
        for (let j = 0; j < line.length; j++) {
            const char = line[j]
            if (char === '"') inQuotes = !inQuotes
            else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
            else current += char
        }
        row.push(current)
        if (row.length > 0) result.push(row)
    }
    return result
}

const csvPath = path.join(rootDir, 'src/BD/registro horas vetkiosk - Hoja 1.csv')
const content = fs.readFileSync(csvPath, 'utf-8')
const rows = parseCSV(content)

let sql = "BEGIN;\n"
sql += "-- Mappings will be done inside the final query to avoid massive joins here if possible, but let's just generate standard inserts.\n"

rows.forEach((row, i) => {
    let [fecha, nombre, tarea, subtarea, horas] = row
    tarea = tarea?.trim().replace(/'/g, "''")
    subtarea = subtarea?.trim().replace(/'/g, "''")
    nombre = nombre?.trim()

    const userId = userMap[nombre]
    if (!userId) return

    const dateParts = fecha.split('/')
    if (dateParts.length !== 3) return
    const isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`
    const numHours = horas.replace(',', '.')

    // Use a CTE or subquery to find task_id
    // Logic: Look for task where title = subtarea AND parent has title = tarea.
    // Or if subtarea is empty, title = tarea.

    let taskLookup;
    if (tarea && subtarea) {
        taskLookup = `(SELECT t.id FROM tasks t JOIN tasks p ON t.parent_task_id = p.id WHERE t.title = '${subtarea}' AND p.title = '${tarea}' AND t.client_id = '${VETKIOSK_ID}' LIMIT 1)`
    } else if (tarea) {
        taskLookup = `(SELECT id FROM tasks WHERE title = '${tarea}' AND client_id = '${VETKIOSK_ID}' LIMIT 1)`
    } else {
        return
    }

    sql += `INSERT INTO time_logs (user_id, task_id, date, hours_worked, notes) VALUES ('${userId}', ${taskLookup}, '${isoDate}', ${numHours}, '');\n`

    if (i % 200 === 0 && i > 0) {
        sql += "COMMIT;\nBEGIN;\n"
    }
})

sql += "COMMIT;"
fs.writeFileSync('scripts/import_logs_vetkiosk.sql', sql)
console.log('SQL generated in scripts/import_logs_vetkiosk.sql')
