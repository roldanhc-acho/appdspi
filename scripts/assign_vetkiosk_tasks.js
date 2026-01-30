
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../src/BD/csv_sources/TAREA VETKIOSK - Hoja 1.csv');
const OUTPUT_FILE = path.join(__dirname, 'migration_vetkiosk_assignment.sql');
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
        // Simple analysis to find TAREA index (usually 1, but let's check header)
        const header = lines[0].split(',').map(h => h.trim().toUpperCase());
        let colIndex = header.indexOf('TAREA');
        if (colIndex === -1) colIndex = 1; // Fallback to 2nd column

        const titles = new Set();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // CSV parsing considering quotes
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
                // Remove surrounding quotes and trim
                title = title.trim();
                if (title.startsWith('"') && title.endsWith('"')) {
                    title = title.slice(1, -1);
                }
                title = title.replace(/""/g, '"'); // Unescape double quotes
                title = title.replace(/'/g, "''").trim(); // Escape single quotes for SQL

                if (title) titles.add(title);
            }
        }

        if (titles.size > 0) {
            const titleList = Array.from(titles).map(t => `'${t}'`).join(',');
            sqlOutput += `
    -- Update for VETKIOSK
    UPDATE tasks 
    SET client_id = client_vetkiosk
    WHERE project_id IS NULL 
    AND title IN (${titleList});
    `;
            console.log(`Found ${titles.size} unique tasks for VETKIOSK.`);
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
