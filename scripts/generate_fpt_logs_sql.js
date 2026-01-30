
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../src/BD/REGISTRO HORAS FPT - Hoja 1.csv');
const OUTPUT_DIR = path.join(__dirname, '../src/BD/fpt_batches');
const FPT_CLIENT_ID = '1bb9c344-de3c-47b7-9a84-4954a2885ce3';

const USER_MAP = {
    'torletti, andres': 'ab74ae21-52f4-4552-a66c-bccc511edc32',
    'agustin': 'ceeb086c-5918-4496-b1ce-7754a4276838',
    'boccetto, matias': 'ceeb086c-5918-4496-b1ce-7754a4276838',
    'horacio': 'aee2d05a-212b-4aea-827f-62ea861de2db',
    'rossi, horacio': 'aee2d05a-212b-4aea-827f-62ea861de2db',
    'pisciotta, fabricio': '8254b2c5-7167-4035-8123-cc0b57663ea8',
    'martinez, javier': '44bb75dd-d86b-4129-b6ce-8b2bde1d788c',
    'bianchi, nicolas': 'cd49e29a-01ef-49a2-bbc8-7a2b1239ebda',
    'sanchez, sergio': 'a99cebc8-083a-4932-8e0b-41a51a29507a',
    'mottura, gonzalo': 'ad1257e1-6d83-47fc-9ea9-6759ef22408e',
    'dominguez, pablo': '72e81f8a-ad65-46d6-ae71-1437a3a490f2',
    'burgesser, raul': '801f7d64-9bab-42ee-9cc9-43d665795415',
    'rivarola, fernanda': '57948c69-2b65-42ea-b76f-cb89a52af509',
    'faivre, santiago': 'bf10e3d7-068e-413f-90bd-bc2edd8550ed'
};

function parseCSVLine(line) {
    const row = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    row.push(current.trim());
    return row;
}

async function generate() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

    const inserts = [];
    for (let i = 1; i < lines.length; i++) {
        const [fecha, nombre, proyecto, horas] = parseCSVLine(lines[i]);

        if (!nombre) continue;
        const userId = USER_MAP[nombre.toLowerCase().replace(/"/g, '')];
        if (!userId) {
            console.warn(`User not found: ${nombre} at line ${i + 1}`);
            continue;
        }

        const dateParts = fecha.split('/');
        if (dateParts.length !== 3) continue;
        const isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;

        const numHours = parseFloat(horas.replace(/"/g, '').replace(',', '.'));
        if (isNaN(numHours)) continue;

        const cleanProyecto = proyecto.replace(/'/g, "''").trim();

        const taskQuery = `(SELECT id FROM tasks WHERE title = '${cleanProyecto}' AND client_id = '${FPT_CLIENT_ID}' LIMIT 1)`;

        inserts.push(`INSERT INTO time_logs (user_id, task_id, date, hours_worked, notes) VALUES ('${userId}', ${taskQuery}, '${isoDate}', ${numHours}, '');`);
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        const fileName = `fpt_batch_${Math.floor(i / BATCH_SIZE)}.sql`;
        const filePath = path.join(OUTPUT_DIR, fileName);
        fs.writeFileSync(filePath, `BEGIN;\n${batch.join('\n')}\nCOMMIT;`);
    }

    console.log(`Generated ${Math.ceil(inserts.length / BATCH_SIZE)} files in ${OUTPUT_DIR}`);
}

generate();
