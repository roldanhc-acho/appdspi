import csv
import os
import re
from datetime import datetime

# ── Mapeo de nombre CSV → user_id en Supabase ─────────────────────────────────
USER_MAP = {
    "AGUSTIN":               "ceeb086c-5918-4496-b1ce-7754a4276838",
    "ANDRADA, SANTIAGO":     "c0413fbe-9155-46da-9bef-5fd7332ec108",
    "ARANEGA, EZEQUIEL":     "f89ba55c-3afe-4776-a27b-109b56e649f8",
    "BIANCHI, NICOLAS":      "cd49e29a-01ef-49a2-bbc8-7a2b1239ebda",
    "BOASSO, AYLEN":         "cbc0b7e7-079e-483f-a643-c7d82fd74af6",
    "BURGESSER, RAUL":       "801f7d64-9bab-42ee-9cc9-43d665795415",
    "BURGESSER,RAUL":        "801f7d64-9bab-42ee-9cc9-43d665795415",
    "DOMINGUEZ, PABLO":      "72e81f8a-ad65-46d6-ae71-1437a3a490f2",
    "ENCINAS, GONZALO":      "b9b75e2d-8dea-4bde-a3a6-fca201f1e251",
    "ESPINAL, ITTALA":       "35d89c47-8ab1-44f4-97bc-0dfc8fe6fa14",
    "FAIVRE, SANTIAGO":      "bf10e3d7-068e-413f-90bd-bc2edd8550ed",
    "FONTEÑEZ, LUCAS":       "d455c204-35ad-4823-88f9-65a651195ea5",
    "FONTEZ, LUCAS":         "d455c204-35ad-4823-88f9-65a651195ea5",
    "LOPEZ, LISANDRO":       "41f90dd1-e4c8-4c37-8988-75c9602829a9",
    "MARTELLOTTO, LUCAS":    "1619c086-b9c1-427a-aa7c-97a691f7b499",
    "MARTINEZ, JAVIER":      "44bb75dd-d86b-4129-b6ce-8b2bde1d788c",
    "MOTTURA, GONZALO":      "ad1257e1-6d83-47fc-9ea9-6759ef22408e",
    "PICCOLI, FRANCISCO":    "140f0092-0667-4699-8719-1e3b551cc131",
    "PISCIOTTA, FABRICIO":   "8254b2c5-7167-4035-8123-cc0b57663ea8",
    "PISCIOTTA, FABRIZIO":   "8254b2c5-7167-4035-8123-cc0b57663ea8",
    "RIVAROLA, FERNANDA":    "57948c69-2b65-42ea-b76f-cb89a52af509",
    "SANCHEZ, SERGIO":       "a99cebc8-083a-4932-8e0b-41a51a29507a",
    "TORLETTI, ANDRES":      "ab74ae21-52f4-4552-a66c-bccc511edc32",
}

# ── Mapeo de tipo CSV → enum absence_type ────────────────────────────────────
TYPE_MAP = {
    "VACACIONES": "vacation",
    "ENFERMEDAD": "sickness",
    "ESTUDIO":    "study",
    "STUDY":      "study",
    "EXAMEN":     "study",
    "SUSPENSION": "suspension",
    "OTRO":       "other",
    "OTHER":      "other",
}

def parse_date(raw: str) -> str:
    """Convierte dd/mm/yyyy o d/m/yyyy a yyyy-mm-dd."""
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%-d/%-m/%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    # fallback manual
    parts = raw.split("/")
    if len(parts) == 3:
        d, m, y = parts
        return f"{y.zfill(4)}-{m.zfill(2)}-{d.zfill(2)}"
    raise ValueError(f"Fecha no reconocida: {raw}")

def parse_hours(raw: str) -> float:
    """Convierte '9', '3,75', '1.5' a float."""
    return float(raw.strip().replace(",", "."))

def escape(s: str) -> str:
    return s.replace("'", "''")


csv_path = os.path.join(
    os.path.dirname(__file__),
    "..", "src", "BD", "csv_sources", "REGISTRO Horas RRHH - Hoja 1.csv"
)

rows = []
skipped = []

with open(csv_path, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader, start=2):
        fecha_raw  = row["FECHA"].strip()
        nombre_raw = row["NOMBRE"].strip()
        razon_raw  = row["RAZON"].strip()
        horas_raw  = row["HORAS"].strip()

        # Normalizar nombre
        nombre_key = nombre_raw.upper()

        user_id = USER_MAP.get(nombre_key)
        if not user_id:
            skipped.append(f"Línea {i}: nombre no encontrado → '{nombre_raw}'")
            continue

        abs_type = TYPE_MAP.get(razon_raw.upper(), "other")

        try:
            date_str = parse_date(fecha_raw)
        except Exception as e:
            skipped.append(f"Línea {i}: fecha inválida → '{fecha_raw}' ({e})")
            continue

        try:
            hours = parse_hours(horas_raw)
        except Exception as e:
            skipped.append(f"Línea {i}: horas inválidas → '{horas_raw}' ({e})")
            continue

        rows.append({
            "user_id":    user_id,
            "start_date": date_str,
            "end_date":   date_str,
            "type":       abs_type,
            "reason":     f"{razon_raw} ({hours}h)",
            "status":     "approved",
        })

# ── Generar SQL ───────────────────────────────────────────────────────────────
sql_lines = [
    "-- Importación automática desde REGISTRO Horas RRHH",
    "INSERT INTO absences (user_id, start_date, end_date, type, reason, status) VALUES"
]

value_parts = []
for r in rows:
    value_parts.append(
        f"  ('{r['user_id']}', '{r['start_date']}', '{r['end_date']}', "
        f"'{r['type']}', '{escape(r['reason'])}', 'approved')"
    )

sql_lines.append(",\n".join(value_parts) + ";")

sql_out = os.path.join(os.path.dirname(__file__), "import_absences.sql")
with open(sql_out, "w", encoding="utf-8") as f:
    f.write("\n".join(sql_lines))

print(f"✅ SQL generado: {sql_out}")
print(f"   Registros a insertar : {len(rows)}")
if skipped:
    print(f"\n⚠️  Registros omitidos ({len(skipped)}):")
    for s in skipped:
        print("   ", s)
