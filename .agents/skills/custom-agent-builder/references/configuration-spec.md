# Especificación de Configuración de Custom Agents

Los agentes personalizados se definen mediante manifiestos en formato **YAML** o **JSON**.

---

## 1. Estructura del Manifiesto

A continuación se detalla el esquema estándar para la declaración de un agente en `.agents/agents/<nombre>.yaml`:

```yaml
# Identificador único del agente (kebab-case)
name: my-specialized-agent

# Versión del esquema del agente
version: "1.0"

# Descripción clara del propósito del agente y en qué situaciones debe invocarse
description: >-
  Especialista en auditoría de código estático, rendimiento y cumplimiento de directrices de seguridad.

# Nivel de modelo preferido (e.g., "gemini-3.8-flash", "gemini-3-pro", etc.)
model: "gemini-3.8-flash"

# Lista blanca de herramientas permitidas para este agente
tools:
  - view_file
  - grep_search
  - list_dir
  - search_web
  # Si no se define 'tools', el agente hereda las herramientas del entorno según su política de seguridad.

# Habilidades requeridas que el agente cargará automáticamente
skills:
  - custom-agent-builder
  # Agrega habilidades del proyecto según el dominio

# Política de ejecución de comandos en terminal
commandExecutionPolicy:
  # Opciones: "read_only" (sin terminal), "pre_approved" (permite comandos seguros), "prompt_user" (pregunta siempre)
  mode: "pre_approved"
  # Comandos o patrones autorizados para auto-ejecución si el modo es pre_approved
  allowedPatterns:
    - "^npm test"
    - "^npm run lint"
    - "^pytest"
  # Comandos explícitamente bloqueados
  deniedPatterns:
    - "rm -rf"
    - "git push"
    - "DROP TABLE"

# Instrucciones del sistema y definición de la persona
instructions: |
  Eres un agente especializado en auditoría y revisión de código.
  Tu misión es:
  1. Analizar el código suministrado en busca de malas prácticas o vulnerabilidades.
  2. Proponer correcciones concretas y explicadas con claridad.
  3. No modificar archivos directamente a menos que se te solicite explícitamente.
  4. Devolver siempre un reporte estructurado en formato Markdown.
```

---

## 2. Tipos de Políticas de Ejecución (`commandExecutionPolicy`)

| Modo | Descripción | Uso Recomendado |
| :--- | :--- | :--- |
| `read_only` | Deshabilita completamente `run_command` y herramientas de modificación de archivos. | Agentes de revisión de código, analistas de arquitectura y exploradores. |
| `pre_approved` | Permite ejecutar comandos que coincidan con la lista blanca de `allowedPatterns` de forma autónoma. | Agentes de pruebas automatizadas (QA), compilación y formateo de código. |
| `prompt_user` | Requiere que el usuario autorice interactivamente cada comando en la shell. | Agentes de despliegue, refactorización masiva o migraciones de bases de datos. |

---

## 3. Integración en Plugins (`plugin.json`)

Si un agente forma parte de un paquete de plugin (`.agents/plugins/<plugin_name>/`), se referencia en el archivo `plugin.json`:

```json
{
  "name": "quality-assurance-pack",
  "version": "1.0.0",
  "description": "Herramientas y subagentes para testing y control de calidad",
  "agents": [
    "agents/qa-browser.yaml",
    "agents/code-reviewer.yaml"
  ],
  "skills": [
    "skills/qa-workflows"
  ]
}
```
