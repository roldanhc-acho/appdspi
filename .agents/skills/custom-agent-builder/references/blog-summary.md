# Resumen del Blog Oficial: "Introducing Custom Agents"

**Fuente:** Google Antigravity Blog  
**URL:** [https://antigravity.google/blog/introducing-custom-agents](https://antigravity.google/blog/introducing-custom-agents)  
**Autor:** The Antigravity Team  
**Fecha:** 12 de Agosto de 2026  

---

## 1. El Problema que Resuelven los Custom Agents
En el desarrollo de software moderno con Inteligencia Artificial, delegar todas las tareas a un único asistente generalista suele provocar dos problemas graves:
1. **Contaminación de Contexto (*Context Pollution*)**: El historial del chat se llena con miles de líneas de logs de compilación, árboles de DOM o volcados de bases de datos que no son relevantes para el objetivo global.
2. **Sobrecarga de Herramientas (*Tool Overload*)**: Disponer de docenas de herramientas simultáneamente en el prompt incrementa la latencia, la probabilidad de errores de invocación (*tool hallucination*) y el costo de tokens.

Los **Custom Agents** resuelven esto permitiendo aislar roles especializados en subagentes autónomos que ejecutan un sub-objetivo con herramientas y contexto estrictamente delimitados.

---

## 2. Los 3 Pilares Distintivos de Antigravity Custom Agents

### 1. Simetría Real (Main Agent vs. Subagent)
A diferencia de otros entornos de IA donde los subagentes son versiones "recortadas" o limitadas a simples llamadas de texto:
- En Google Antigravity, un subagente tiene **simetría arquitectónica completa** con el agente principal.
- Puede ejecutar comandos en consola, abrir e interactuar con el navegador web, leer/escribir archivos, programar temporizadores, gestionar procesos en segundo plano y mantener su propio bloc de notas (`scratchpad`).
- Esto permite delegar tareas complejas de extremo a extremo sin perder capacidades de ejecución.

### 2. Políticas de Seguridad Acotadas (`commandExecutionPolicy`)
Cada agente puede configurarse con políticas de seguridad y ejecución precisas:
- **Modo Análisis / Lectura**: El agente puede examinar el código y buscar patrones sin riesgo de modificar archivos o ejecutar comandos peligrosos.
- **Auto-ejecución Segura**: Agentes de testing o integración continua pueden tener permisos preaprobados para ejecutar comandos seguros (ej. `npm test`, `pytest`, `npm run lint`) sin solicitar confirmación manual por cada paso.
- **Acceso Restringido**: Bloqueo de comandos que afecten configuraciones de red, variables de entorno sensibles o eliminaciones recursivas.

### 3. Habilidades Curadas y Conjuntos de Herramientas Acotadas (`skills` & `tools`)
- **Scoping de Herramientas**: Se define explícitamente la lista blanca de herramientas a las que tiene acceso el agente (por ejemplo, restringiendo un agente de pruebas web solo a herramientas de navegador).
- **Inyección Progresiva de Habilidades**: Los agentes solo cargan el contenido detallado de las habilidades (`skills`) cuando la tarea específica lo requiere, conservando la ventana de contexto.

---

## 3. Disponibilidad y Ecosistema
- Disponible tanto en la interfaz gráfica **Antigravity 2.0 (IDE)** como en la interfaz de línea de comandos **Antigravity CLI (`agy`)**.
- Los agentes se pueden compartir entre equipos mediante el sistema de extensiones y plugins (`plugins/`).
