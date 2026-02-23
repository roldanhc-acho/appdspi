"""
Lee el archivo import_absences.sql y ejecuta los inserts
en lotes de 50 filas contra Supabase via HTTP REST.
"""
import re, json, urllib.request, urllib.error

SUPABASE_URL = "https://ewlxcpgbavfvgnohtkuq.supabase.co"
# Usamos la service-role key si está disponible, sino anon
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bHhjcGdiYXZmdmdub2h0a3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcyNDMsImV4cCI6MjA4NDMzMzI0M30"
    ".d6zQpak_F9G12DG7_ZKdoYPyfPL8YQTbhnAQVltcHxs"
)

import os, sys

SQL_FILE = os.path.join(os.path.dirname(__file__), "import_absences.sql")

# ── leer todas las filas del SQL ─────────────────────────────────────────────
with open(SQL_FILE, encoding="utf-8") as f:
    content = f.read()

# Extraer los values individuales entre la primera '(' y el ';' final
values_block = re.search(r"VALUES\s*(.*);", content, re.DOTALL)
if not values_block:
    sys.exit("No se encontró el bloque VALUES en el SQL.")

raw = values_block.group(1).strip()
# cada fila es  ('...', '...', ...) separada por coma+newline
row_pattern = re.compile(r"\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)")
rows = row_pattern.findall(raw)
print(f"Filas a insertar: {len(rows)}")

# ── convertir a lista de dicts ───────────────────────────────────────────────
records = [
    {
        "user_id":    r[0],
        "start_date": r[1],
        "end_date":   r[2],
        "type":       r[3],
        "reason":     r[4],
        "status":     r[5],
    }
    for r in rows
]

# ── insertar en lotes via REST ───────────────────────────────────────────────
BATCH = 50
endpoint = f"{SUPABASE_URL}/rest/v1/absences"
headers = {
    "apikey":        ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

inserted = 0
for i in range(0, len(records), BATCH):
    batch = records[i : i + BATCH]
    data  = json.dumps(batch).encode()
    req   = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            inserted += len(batch)
            print(f"  ✅ Lote {i//BATCH+1}: {len(batch)} filas insertadas (total {inserted})")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ❌ Lote {i//BATCH+1} error {e.code}: {body[:300]}")

print(f"\nFinalizado. Total insertadas: {inserted}/{len(records)}")
