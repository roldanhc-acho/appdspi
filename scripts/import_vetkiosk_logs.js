
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(rootDir, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const VETKIOSK_ID = '7fb22b64-307b-439e-a845-4847838b1240'

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

async function main() {
    console.log('Fetching profiles and tasks...')
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id, full_name')
    if (pError) { console.error('Profiles Error:', pError); return; }

    const { data: tasks, error: tError } = await supabase.from('tasks').select('id, title, parent_task_id').eq('client_id', VETKIOSK_ID)
    if (tError) { console.error('Tasks Error:', tError); return; }

    console.log(`Found ${profiles.length} profiles and ${tasks.length} tasks.`)

    const profileMap = new Map()
    profiles.forEach(p => {
        if (p.full_name) profileMap.set(p.full_name.trim().toLowerCase(), p.id)
    })

    const taskMap = new Map() // title -> id OR "parentTitle|subTitle" -> id
    const parentIdToTitle = new Map()

    tasks.forEach(t => {
        if (!t.parent_task_id) parentIdToTitle.set(t.id, t.title.trim().toLowerCase())
    })

    tasks.forEach(t => {
        const title = t.title.trim().toLowerCase()
        if (t.parent_task_id) {
            const parentTitle = parentIdToTitle.get(t.parent_task_id)
            if (parentTitle) {
                taskMap.set(`${parentTitle}|${title}`, t.id)
            }
        } else {
            taskMap.set(title, t.id)
        }
    })

    const csvPath = path.join(rootDir, 'src/BD/registro horas vetkiosk - Hoja 1.csv')
    const content = fs.readFileSync(csvPath, 'utf-8')
    const rows = parseCSV(content)
    console.log(`Processing ${rows.length} rows...`)

    const logsToInsert = []
    let skipped = 0

    for (let i = 0; i < rows.length; i++) {
        let [fecha, nombre, tarea, subtarea, horas] = rows[i]
        tarea = tarea?.trim().toLowerCase()
        subtarea = subtarea?.trim().toLowerCase()
        nombre = nombre?.trim().toLowerCase()

        // 1. Match User
        const userId = profileMap.get(nombre)
        if (!userId) {
            if (i < 10) console.log(`Skip Row ${i}: User not found "${nombre}"`)
            skipped++; continue;
        }

        // 2. Parse Date
        const dateParts = fecha.split('/')
        if (dateParts.length !== 3) { skipped++; continue; }
        const isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`

        // 3. Parse Hours
        const numHours = parseFloat(horas.replace(',', '.'))
        if (isNaN(numHours)) { skipped++; continue; }

        // 4. Match Task
        let taskId = null
        if (tarea && subtarea) {
            taskId = taskMap.get(`${tarea}|${subtarea}`)
        }

        if (!taskId && tarea) {
            taskId = taskMap.get(tarea)
        }

        if (!taskId && subtarea) {
            taskId = taskMap.get(subtarea)
        }

        if (!taskId) {
            if (i < 10) console.log(`Skip Row ${i}: Task not found "${tarea}" / "${subtarea}"`)
            skipped++
            continue
        }

        logsToInsert.push({
            user_id: userId,
            task_id: taskId,
            date: isoDate,
            hours_worked: numHours,
            notes: ''
        })

        if (logsToInsert.length >= 100) {
            const { error } = await supabase.from('time_logs').insert(logsToInsert)
            if (error) console.error('Error inserting block:', error.message)
            logsToInsert.length = 0
            process.stdout.write('.')
        }
    }

    if (logsToInsert.length > 0) {
        const { error } = await supabase.from('time_logs').insert(logsToInsert)
        if (error) console.error('Error inserting final block:', error.message)
    }

    console.log(`\nFinished. Imported ${rows.length - skipped} logs. Skipped ${skipped} rows.`)
}

main()
