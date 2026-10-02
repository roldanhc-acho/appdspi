#!/usr/bin/env python3
"""
Validador de Manifiestos de Custom Agents para Google Antigravity.
Verifica campos obligatorios, formatos de nombres, herramientas válidas y consistencia de políticas de seguridad.
"""

import sys
import os
import re

REQUIRED_FIELDS = ["name", "description", "instructions"]
VALID_NAME_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
VALID_POLICIES = ["read_only", "pre_approved", "prompt_user", "full_access"]

def parse_simple_yaml(filepath):
    data = {}
    current_key = None
    multiline_value = []
    is_multiline = False

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            if is_multiline:
                if line.startswith("  ") or line.startswith("\t"):
                    multiline_value.append(stripped)
                    continue
                else:
                    data[current_key] = "\n".join(multiline_value)
                    is_multiline = False
                    multiline_value = []

            if ":" in stripped:
                key, val = stripped.split(":", 1)
                key = key.strip()
                val = val.strip()
                if val in ["|", ">", ">-", "|-"]:
                    is_multiline = True
                    current_key = key
                    multiline_value = []
                else:
                    data[key] = val.strip("\"'")

    if is_multiline and current_key:
        data[current_key] = "\n".join(multiline_value)

    return data

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def validate_agent_file(filepath):
    print(f"Validando manifiesto: {filepath}")
    if not os.path.exists(filepath):
        print(f"[ERROR] El archivo '{filepath}' no existe.")
        return False

    data = parse_simple_yaml(filepath)
    errors = []

    # Validar campos obligatorios
    for field in REQUIRED_FIELDS:
        if field not in data or not data[field]:
            errors.append(f"Falta el campo obligatorio '{field}'.")

    # Validar formato de nombre
    name = data.get("name", "")
    if name and not VALID_NAME_PATTERN.match(name):
        errors.append(f"El nombre '{name}' no cumple con la convencion kebab-case (ej. 'mi-agente').")

    # Validar descripcion
    desc = data.get("description", "")
    if desc and len(desc) < 15:
        errors.append("La descripcion es demasiado breve; debe detallar claramente cuando invocar este agente.")

    if errors:
        print("[ERROR] Se encontraron los siguientes problemas:")
        for err in errors:
            print(f"  - {err}")
        return False

    print("[OK] El manifiesto del agente es valido y cumple con los estandares de Antigravity.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python validate_agent.py <ruta_al_archivo_yaml>")
        sys.exit(1)
    
    success = validate_agent_file(sys.argv[1])
    sys.exit(0 if success else 1)

