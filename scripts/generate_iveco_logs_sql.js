
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const CLIENT_ID = 'a57cbd7d-dade-4a1a-92be-fcb18689aee6' // IVECO
const CLIENT_NAME = 'IVECO'

const USER_MAP = {
    "ab74ae21-52f4-4552-a66c-bccc511edc32": "TORLETTI, Andres",
    "cd49e29a-01ef-49a2-bbc8-7a2b1239ebda": "BIANCHI, Nicolas",
    "0e8e1b65-3873-41be-b7bf-e20757cc7b5a": "DIAZ, Guadalupe",
    "b9b75e2d-8dea-4bde-a3a6-fca201f1e251": "ENCINAS, Gonzalo",
    "ad1257e1-6d83-47fc-9ea9-6759ef22408e": "MOTTURA, Gonzalo",
    "44bb75dd-d86b-4129-b6ce-8b2bde1d788c": "MARTINEZ, Javier",
    "41f90dd1-e4c8-4c37-8988-75c9602829a9": "LOPEZ, Lisandro",
    "d455c204-35ad-4823-88f9-65a651195ea5": "FONTEÑEZ, Lucas",
    "1619c086-b9c1-427a-aa7c-97a691f7b499": "MARTELLOTTO, Lucas",
    "bf10e3d7-068e-413f-90bd-bc2edd8550ed": "FAIVRE, Santiago",
    "35d89c47-8ab1-44f4-97bc-0dfc8fe6fa14": "ESPINAL, Ittala",
    "a99cebc8-083a-4932-8e0b-41a51a29507a": "SANCHEZ, Sergio",
    "72e81f8a-ad65-46d6-ae71-1437a3a490f2": "DOMINGUEZ, Pablo",
    "801f7d64-9bab-42ee-9cc9-43d665795415": "BURGESSER, Raul",
    "57948c69-2b65-42ea-b76f-cb89a52af509": "RIVAROLA, Fernanda",
    "f89ba55c-3afe-4776-a27b-109b56e649f8": "ARANEGA, Ezequiel",
    "8254b2c5-7167-4035-8123-cc0b57663ea8": "PISCIOTTA, Fabricio",
    "140f0092-0667-4699-8719-1e3b551cc131": "PICCOLI, Francisco",
    "ceeb086c-5918-4496-b1ce-7754a4276838": "AGUSTIN",
    "c0413fbe-9155-46da-9bef-5fd7332ec108": "ANDRADA, Santiago",
    "cbc0b7e7-079e-483f-a643-c7d82fd74af6": "BOASSO, Aylen",
    "28662a39-4e23-4ae8-b7cc-67fe1d044f8b": "GUSTAVO",
    "aee2d05a-212b-4aea-827f-62ea861de2db": "HORACIO"
}

// Reverse mapping for easier lookup
const NAME_TO_ID = {}
for (const [id, name] of Object.entries(USER_MAP)) {
    NAME_TO_ID[name.toUpperCase()] = id
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
            else if (char === ',' && !inQuotes) {
                row.push(current)
                current = ''
            } else current += char
        }
        row.push(current)
        if (row.length >= 4) result.push(row)
    }
    return result
}

function formatDate(dateStr) {
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null
    let day = parts[0].padStart(2, '0')
    let month = parts[1].padStart(2, '0')
    let year = parts[2]
    if (year.length === 2) year = '20' + year
    return `${year}-${month}-${day}`
}

function parseHours(hourStr) {
    if (!hourStr) return 0

    // Handle Excel date format like 08/01/1900
    if (hourStr.includes('/1900')) {
        const day = parseInt(hourStr.split('/')[0])
        return day
    }

    const val = hourStr.replace(',', '.')
    const num = parseFloat(val)
    return isNaN(num) ? 0 : num
}

const csvPath = path.join(rootDir, 'src/BD/csv_sources/REGISTRO HORAS IVECO - Hoja 1.csv')
const content = fs.readFileSync(csvPath, 'utf-8')
const rows = parseCSV(content)

const outputDir = path.join(rootDir, 'src/BD/iveco_batches')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

let batchIndex = 0
let currentBatchSql = "BEGIN;\n"
let recordsInCurrentBatch = 0

rows.forEach((row, i) => {
    let [nombre, fecha, tarea, horas] = row
    nombre = nombre?.trim().toUpperCase()
    tarea = tarea?.trim().replace(/'/g, "''")

    const userId = NAME_TO_ID[nombre]
    if (!userId) {
        // console.warn(`User not found: ${nombre}`)
        return
    }

    const isoDate = formatDate(fecha)
    if (!isoDate) return

    const numHours = parseHours(horas)
    if (numHours === 0) return

    // Task lookup by title and client_id
    const taskLookup = `(SELECT id FROM tasks WHERE TRIM(title) = '${tarea}' AND client_id = '${CLIENT_ID}' LIMIT 1)`

    currentBatchSql += `INSERT INTO time_logs (user_id, task_id, date, hours_worked, notes, type) \n`
    currentBatchSql += `SELECT '${userId}', ${taskLookup}, '${isoDate}', ${numHours}, '', 'regular' \n`
    currentBatchSql += `WHERE EXISTS ${taskLookup};\n\n`

    recordsInCurrentBatch++

    if (recordsInCurrentBatch >= 500) {
        currentBatchSql += "COMMIT;"
        fs.writeFileSync(path.join(outputDir, `iveco_batch_${batchIndex}.sql`), currentBatchSql)
        batchIndex++
        currentBatchSql = "BEGIN;\n"
        recordsInCurrentBatch = 0
    }
})

if (recordsInCurrentBatch > 0) {
    currentBatchSql += "COMMIT;"
    fs.writeFileSync(path.join(outputDir, `iveco_batch_${batchIndex}.sql`), currentBatchSql)
}

console.log(`Generated ${batchIndex + 1} batch files in ${outputDir}`)
