
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_DIR = path.join(__dirname, '../src/BD/csv_sources');
const OUTPUT_FILE = path.join(__dirname, 'migration_csv_assignment.sql');

const FILES = [
    { name: 'TAREAS IVECO - Hoja 1.csv', clientId: 'a57cbd7d-dade-4a1a-92be-fcb18689aee6', col: 'TAREAS' },
    { name: 'TAREAS TT - Hoja 1.csv', clientId: '62fe6693-25b8-4d68-b89e-816cae5c3f88', col: 'TAREAS' },
    { name: 'TAREAS FPT - Hoja 1.csv', clientId: '1bb9c344-de3c-47b7-9a84-4954a2885ce3', col: 'tarea' }
];

let sqlOutput = `DO $$
DECLARE
    client_iveco uuid := 'a57cbd7d-dade-4a1a-92be-fcb18689aee6';
    client_tt uuid := '62fe6693-25b8-4d68-b89e-816cae5c3f88';
    client_fpt uuid := '1bb9c344-de3c-47b7-9a84-4954a2885ce3';
BEGIN
`;

FILES.forEach(file => {
    try {
        const content = fs.readFileSync(path.join(CSV_DIR, file.name), 'utf8');
        const lines = content.split(/\r?\n/);

        if (lines.length < 2) return;

        // Find header index
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
        const colIndex = headers.findIndex(h => h === file.col.toLowerCase());

        if (colIndex === -1) {
            console.error(`Column ${file.col} not found in ${file.name}`);
            return;
        }

        const titles = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Simple CSV split (handling quotes crudely but likely sufficient for this specific data)
            // If the title contains commas, it might be quoted.
            // Regex match for CSV:
            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');

            // Better manual split to handle commas inside quotes
            let row = [];
            let current = '';
            let inQuote = false;
            for (let char of line) {
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    row.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            row.push(current);

            let title = row[colIndex];
            if (title) {
                // Remove surrounding quotes if present
                title = title.trim();
                if (title.startsWith('"') && title.endsWith('"')) {
                    title = title.slice(1, -1);
                }
                // Escape single quotes for SQL
                title = title.replace(/'/g, "''").trim();

                if (title) titles.push(title);
            }
        }

        if (titles.length > 0) {
            const titleList = titles.map(t => `'${t}'`).join(',');
            sqlOutput += `
    -- Update for ${file.name}
    UPDATE tasks 
    SET client_id = '${file.clientId}'
    WHERE project_id IS NULL 
    AND title IN (${titleList});
    `;
        }
    } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
    }
});

sqlOutput += `
END $$;
`;

fs.writeFileSync(OUTPUT_FILE, sqlOutput);
console.log(`Generated SQL to ${OUTPUT_FILE}`);
