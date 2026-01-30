
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to reliably parse CSV lines handling quotes
function parseCSVLine(line) {
    const row = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuote && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            row.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    row.push(current);
    return row;
}

const CSV_PATH = path.join(__dirname, '../src/BD/csv_sources/TAREA VETKIOSK - Hoja 1.csv');
const OUTPUT_FILE = path.join(__dirname, 'migration_vetkiosk_subtasks.sql');
const VETKIOSK_ID = '7fb22b64-307b-439e-a845-4847838b1240';

let sqlOutput = `DO $$
DECLARE
    client_vetkiosk uuid := '${VETKIOSK_ID}';
BEGIN
`;

try {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/);

    if (lines.length > 1) {
        // Assume structure: CLIENTE, TAREA, SUBTAREA, ...
        // Index 1: TAREA
        // Index 2: SUBTAREA

        const subtasks = new Set();

        // Start from 1 to skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = parseCSVLine(line);

            // Get Subtarea (index 2)
            if (row.length > 2) {
                let sub = row[2].trim();
                // Clean up quotes if present (parseCSVLine usually handles internal quotes but check wrapping)
                if (sub.startsWith('"') && sub.endsWith('"')) sub = sub.slice(1, -1);

                if (sub) subtasks.add(sub);
            }
            // Get Tarea (index 1) - Add as well just in case
            if (row.length > 1) {
                let task = row[1].trim();
                if (task.startsWith('"') && task.endsWith('"')) task = task.slice(1, -1);
                if (task) subtasks.add(task);
            }
        }

        if (subtasks.size > 0) {
            // Escape single quotes
            const titleList = Array.from(subtasks)
                .map(t => `'${t.replace(/'/g, "''")}'`)
                .join(',');

            // We update tasks matching these titles that are currently Unassigned (project_id IS NULL)
            // We do NOT filter by current client_id to ensure we move them if they are wrongly assigned
            // But we trust the user knows what they are asking for (VETKIOSK tasks)
            sqlOutput += `
    -- Update for VETKIOSK Subtasks
    UPDATE tasks 
    SET client_id = client_vetkiosk
    WHERE project_id IS NULL 
    AND title IN (${titleList});
    `;
            console.log(`Found ${subtasks.size} unique task/subtask names for VETKIOSK.`);
        }
    }

} catch (err) {
    console.error("Error reading CSV:", err);
}

sqlOutput += `
END $$;
`;

fs.writeFileSync(OUTPUT_FILE, sqlOutput);
console.log(`Generated SQL to ${OUTPUT_FILE}`);
