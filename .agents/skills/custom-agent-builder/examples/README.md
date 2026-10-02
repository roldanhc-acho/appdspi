# Ejemplos de Implementación de Custom Agents

Este directorio contiene ejemplos de cómo orquestar e invocar agentes personalizados y subagentes en flujos reales de desarrollo con Google Antigravity.

---

## Ejemplo 1: Delegación a un Subagente de Pruebas en Navegador (QA)

En este escenario, el agente principal delega una sesión intensiva de testing de frontend al subagente `qa-browser-agent`.

### Prompt del Agente Principal para el Subagente
```markdown
Tarea: Probar el flujo de reserva de canchas en http://localhost:3000/reservas.
1. Navega a la URL y maximiza la ventana.
2. Comprueba que el calendario cargue los horarios disponibles.
3. Haz clic en el horario de las 18:00 y completa los campos del formulario de reserva.
4. Captura una captura de pantalla del modal de confirmación.
5. Inspecciona los registros de la consola del navegador para verificar que no haya excepciones.
6. Retorna un informe con:
   - Estado del flujo (Éxito / Fallo).
   - Rutas de las capturas guardadas en la carpeta de artefactos.
   - Lista de errores detectados (si los hay).
```

### Beneficio
El agente principal no satura su contexto con 50 llamadas de DOM y coordenadas de píxeles; únicamente recibe el informe final consolidado.

---

## Ejemplo 2: Auditoría de Seguridad Automatizada

El subagente `security-auditor-agent` opera en modo `read_only` sobre el repositorio antes de un despliegue:

```markdown
Tarea: Analizar las rutas API en `src/api/` y los controladores de autenticación.
1. Buscar patrones de tokens o claves fijas en el código.
2. Comprobar que todos los endpoints que modifiquen datos requieran sesión activa.
3. Emitir el reporte clasificado por severidad (Crítica, Alta, Media, Baja).
```

---

## Ejemplo 3: Revisor de Código Pre-Commit

Configurado como hook o subagente previo a la creación de un commit o pull request:

```markdown
Tarea: Revisar los cambios introducidos en `git diff HEAD~1`.
1. Validar el cumplimiento de la guía de estilos del proyecto.
2. Identificar funciones complejas que requieran refactorización.
3. Sugerir mejoras de legibilidad y rendimiento con bloques de código `diff`.
```
