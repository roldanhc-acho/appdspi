import { Gantt, ViewMode } from 'gantt-task-react'
import type { Task as GanttTask } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import type { Task } from "@/types/database.types"
import { useMemo, useState, useRef, useEffect } from 'react'
import { Maximize, Minimize } from "lucide-react"
import { isNonWorkingDay } from '@/utils/holidays'
import { startOfDay, addDays, isWeekend, subDays } from 'date-fns'

type TaskGanttProps = {
    tasks: Task[]
    onDateChange: (task: Task) => void
}

export function TaskGantt({ tasks, onDateChange }: TaskGanttProps) {
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())
    const [view, setView] = useState<ViewMode>(ViewMode.Day)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Drag Refs
    const dragStart = useRef({ x: 0, y: 0 })
    const scrollStart = useRef({ left: 0, top: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    // Helper to find the scrollable container
    const getScrollContainer = (): HTMLDivElement | null => {
        if (!containerRef.current) return null
        // The gantt library wraps the SVG in a div with overflow
        // Look for the specific wrapper that contains the SVG
        const ganttWrapper = containerRef.current.querySelector('.gantt-task-react-container') as HTMLDivElement
        if (ganttWrapper) {
            // The actual scrollable element is the direct parent of the SVG
            const svg = ganttWrapper.querySelector('svg')
            if (svg?.parentElement) {
                return svg.parentElement as HTMLDivElement
            }
        }
        // Fallback: try to find any element with overflow
        const svg = containerRef.current.querySelector('svg')
        return svg?.parentElement as HTMLDivElement || null
    }

    // Full Screen Logic
    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement)
        }
        document.addEventListener("fullscreenchange", handleFullScreenChange)
        return () => document.removeEventListener("fullscreenchange", handleFullScreenChange)
    }, [])

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`)
            })
        } else {
            document.exitFullscreen()
        }
    }

    // Drag Logic with global mouse capture for fullscreen
    const handleMouseDown = (e: React.MouseEvent) => {
        // Ignore if clicking on interactive elements (like expanders or task bars)
        const target = e.target as HTMLElement
        if (target.tagName === 'rect' || target.closest('.gantt-task-react-bar')) {
            return // Let the library handle task interactions
        }

        const scrollContainer = getScrollContainer()
        if (!scrollContainer) return

        scrollContainerRef.current = scrollContainer
        setIsDragging(true)
        dragStart.current = { x: e.clientX, y: e.clientY }
        scrollStart.current = {
            left: scrollContainer.scrollLeft,
            top: scrollContainer.scrollTop
        }
        scrollContainer.style.cursor = 'grabbing'
        scrollContainer.style.userSelect = 'none'
        e.preventDefault()
    }

    // Use global mouse events for reliable drag in fullscreen
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isDragging || !scrollContainerRef.current) return

            e.preventDefault()
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y

            scrollContainerRef.current.scrollLeft = scrollStart.current.left - dx
            scrollContainerRef.current.scrollTop = scrollStart.current.top - dy
        }

        const handleGlobalMouseUp = () => {
            if (!isDragging) return
            setIsDragging(false)

            if (scrollContainerRef.current) {
                scrollContainerRef.current.style.cursor = 'grab'
                scrollContainerRef.current.style.userSelect = 'auto'
            }
            scrollContainerRef.current = null
        }

        if (isDragging) {
            document.addEventListener('mousemove', handleGlobalMouseMove)
            document.addEventListener('mouseup', handleGlobalMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove)
            document.removeEventListener('mouseup', handleGlobalMouseUp)
        }
    }, [isDragging])

    // Transform tasks to Gantt format
    const ganttTasks: GanttTask[] = useMemo(() => {
        const motherTasks = tasks.filter(t => !t.parent_task_id)
        const subtasksByParent = tasks.reduce((acc, t) => {
            if (t.parent_task_id) {
                if (!acc[t.parent_task_id]) acc[t.parent_task_id] = []
                acc[t.parent_task_id].push(t)
            }
            return acc
        }, {} as Record<string, Task[]>)

        // Create a list of mother tasks with their effective start dates for sorting
        const motherTasksWithDates = motherTasks.map(mother => {
            const children = subtasksByParent[mother.id] || []
            let start = mother.start_date ? new Date(mother.start_date) : new Date(mother.created_at || Date.now())
            if (children.length > 0) {
                const childStarts = children.map(c => c.start_date ? new Date(c.start_date).getTime() : new Date(c.created_at || Date.now()).getTime())
                start = new Date(Math.min(...childStarts))
            }
            return { mother, start }
        })

        // Sort mother tasks by start date
        motherTasksWithDates.sort((a, b) => a.start.getTime() - b.start.getTime())

        const result: GanttTask[] = []

        motherTasksWithDates.forEach(({ mother }) => {
            const children = [...(subtasksByParent[mother.id] || [])]

            // Sort children by start date
            children.sort((a, b) => {
                const aStart = a.start_date ? new Date(a.start_date).getTime() : new Date(a.created_at || Date.now()).getTime()
                const bStart = b.due_date ? new Date(b.due_date).getTime() : new Date(b.created_at || Date.now()).getTime()
                return aStart - bStart
            })

            const isCollapsed = collapsedParents.has(mother.id)

            // Calculate mother dates based on children if they exist
            let motherStart = mother.start_date ? new Date(mother.start_date) : new Date(mother.created_at || Date.now())
            let motherEnd = mother.due_date ? new Date(mother.due_date) : new Date(motherStart.getTime() + 86400000)

            if (children.length > 0) {
                const childDates = children.map(c => ({
                    start: c.start_date ? new Date(c.start_date) : new Date(c.created_at || Date.now()),
                    end: c.due_date ? new Date(c.due_date) : new Date((c.start_date ? new Date(c.start_date) : new Date()).getTime() + 86400000)
                }))
                motherStart = new Date(Math.min(...childDates.map(d => d.start.getTime())))
                motherEnd = new Date(Math.max(...childDates.map(d => d.end.getTime())))
            }

            // Add Mother Task
            result.push({
                id: mother.id,
                name: mother.title,
                start: motherStart,
                end: motherEnd,
                type: 'project',
                progress: children.length > 0
                    ? (children.reduce((sum, c) => sum + (c.status === 'finished' ? 100 : (c.status === 'review' ? 75 : (c.status === 'in_progress' ? 50 : 0))), 0) / children.length)
                    : (mother.status === 'finished' ? 100 : (mother.status === 'review' ? 75 : (mother.status === 'in_progress' ? 50 : 0))),
                isDisabled: children.length > 0,
                hideChildren: isCollapsed,
                styles: {
                    progressColor: '#3B82F6',
                    progressSelectedColor: '#3B82F6',
                    backgroundSelectedColor: '#BFDBFE',
                }
            })

            // Add Children
            if (!isCollapsed) {
                children.forEach(child => {
                    const cStart = child.start_date ? new Date(child.start_date) : new Date(child.created_at || Date.now())
                    const cEnd = child.due_date ? new Date(child.due_date) : new Date(cStart.getTime() + 86400000)

                    let color = '#E2E8F0'
                    if (child.status === 'in_progress') color = '#3B82F6'
                    if (child.status === 'finished') color = '#22C55E'
                    if (child.status === 'review') color = '#A855F7'
                    if (child.status === 'pending') color = '#EAB308'

                    result.push({
                        id: child.id,
                        name: `↳ ${child.title}`,
                        start: cStart,
                        end: cEnd,
                        type: 'task',
                        progress: child.status === 'finished' ? 100 : (child.status === 'review' ? 75 : (child.status === 'in_progress' ? 50 : 0)),
                        project: mother.id,
                        styles: {
                            progressColor: color,
                            progressSelectedColor: color,
                        }
                    })
                })
            }
        })

        return result
    }, [tasks, collapsedParents])

    // Calculate background shading
    const backgroundStyle = useMemo(() => {
        if (ganttTasks.length === 0 || view !== ViewMode.Day) return null

        // Gantt chart v0.3.9 starts 1 day before the first task by default
        const minDate = new Date(Math.min(...ganttTasks.map(t => t.start.getTime())))
        const chartStart = startOfDay(subDays(minDate, 1))

        const columnWidth = 60
        const totalDays = 120 // 4 months of coverage
        const stops: string[] = []

        for (let i = 0; i < totalDays; i++) {
            const date = addDays(chartStart, i)
            const isWeekendDay = isWeekend(date)
            const isHoliday = isNonWorkingDay(date) && !isWeekendDay

            const color = isWeekendDay
                ? 'rgba(0,0,0,0.12)'  // Visible grey for weekends
                : (isHoliday ? 'rgba(255,165,0,0.3)' : 'transparent') // Visible orange for holidays

            stops.push(`${color} ${i * columnWidth}px`)
            stops.push(`${color} ${(i + 1) * columnWidth}px`)
        }

        return {
            backgroundImage: `linear-gradient(to right, ${stops.join(', ')})`,
            backgroundSize: `${totalDays * columnWidth}px 100%`,
        }
    }, [ganttTasks, view])

    // Apply background to the actual scroll container
    useEffect(() => {
        if (!containerRef.current || !backgroundStyle) return

        // Delay slightly to ensure library has rendered its internal structure
        const timer = setTimeout(() => {
            const svg = containerRef.current?.querySelector('svg')
            if (!svg) return

            const scrollContainer = svg.parentElement as HTMLDivElement
            if (scrollContainer) {
                scrollContainer.style.backgroundImage = backgroundStyle ? backgroundStyle.backgroundImage : 'none'
                scrollContainer.style.backgroundSize = backgroundStyle ? backgroundStyle.backgroundSize : '0 0'
                scrollContainer.style.backgroundAttachment = 'local'
                scrollContainer.style.backgroundRepeat = 'no-repeat'
                scrollContainer.style.backgroundPosition = '0 0'
                // Ensure the container itself doesn't have a background
                scrollContainer.style.backgroundColor = 'transparent'
            }
        }, 100)

        return () => clearTimeout(timer)
    }, [backgroundStyle])

    // Apply cursor and overflow settings to the internal container
    useEffect(() => {
        const timer = setTimeout(() => {
            const scrollContainer = getScrollContainer()
            if (scrollContainer) {
                scrollContainer.style.cursor = 'grab'
                scrollContainer.style.overflow = 'auto' // Ensure visible scrollbars
                // In fullscreen, ensure the container fills available space
                if (isFullScreen) {
                    scrollContainer.style.maxHeight = `${window.innerHeight - 60}px`
                    scrollContainer.style.height = '100%'
                }
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [ganttTasks, view, isFullScreen])

    const handleDateChange = (task: GanttTask) => {
        const originalTask = tasks.find(t => t.id === task.id)
        if (originalTask) {
            const updatedTask = {
                ...originalTask,
                start_date: task.start.toISOString(),
                due_date: task.end.toISOString()
            }
            onDateChange(updatedTask)
        }
    }

    const handleExpanderClick = (task: GanttTask) => {
        setCollapsedParents(prev => {
            const next = new Set(prev)
            if (next.has(task.id)) {
                next.delete(task.id)
            } else {
                next.add(task.id)
            }
            return next
        })
    }

    if (ganttTasks.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-slate-500">
                No hay tareas con fechas para mostrar en el cronograma.
            </div>
        )
    }

    return (
        <div ref={containerRef} className={`flex flex-col bg-white dark:bg-slate-900 ${isFullScreen ? '' : 'rounded-xl border dark:border-slate-800 relative'}`}>
            {/* Scale Selector & Full Screen */}
            <div className="flex justify-end p-2 border-b dark:border-slate-800 gap-1 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                {[
                    { label: 'Días', value: ViewMode.Day },
                    { label: 'Semanas', value: ViewMode.Week },
                    { label: 'Meses', value: ViewMode.Month },
                ].map((item) => (
                    <button
                        key={item.value}
                        onClick={() => setView(item.value)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === item.value
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {item.label}
                    </button>
                ))}

                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-2 self-center" />

                <button
                    onClick={toggleFullScreen}
                    className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
                >
                    {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
            </div>

            <div
                className="relative z-10 bg-transparent flex-1"
                onMouseDown={handleMouseDown}
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    overflow: 'auto',
                    maxHeight: isFullScreen ? `calc(100vh - 60px)` : '500px'
                }}
            >
                <Gantt
                    tasks={ganttTasks}
                    viewMode={view}
                    onDateChange={handleDateChange}
                    onExpanderClick={handleExpanderClick}
                    listCellWidth=""
                    columnWidth={view === ViewMode.Day ? 60 : view === ViewMode.Week ? 100 : 125}
                    barFill={view === ViewMode.Day ? 60 : view === ViewMode.Week ? 70 : 80}
                    ganttHeight={0}
                    locale="es"
                    fontSize="12px"
                />
            </div>

            <style>{`
                /* Hide the task list (Nombre, De, A) */
                .gantt-task-react-list {
                    display: none !important;
                }
                
                /* CRITICAL: Force scroll on gantt containers */
                .gantt-task-react-wrapper,
                .gantt-task-react-container > div {
                    overflow: auto !important;
                }
                
                /* CRITICAL: Force transparency on ALL library components that might have white backgrounds */
                .gantt-task-react-container svg rect[fill="#fff"], 
                .gantt-task-react-container svg rect[fill="#f5f5f5"],
                .gantt-task-react-container svg rect[fill="#ffffff"] {
                    fill: transparent !important;
                }
                
                /* Grid row backgrounds */
                .gantt-task-react-grid-row {
                    fill: transparent !important;
                }

                /* Grid ticks (vertical lines background) */
                .gantt-task-react-grid-tick {
                    fill: transparent !important;
                }
                
                /* Keep grid lines subtle */
                .gantt-task-react-container svg line {
                    stroke: rgba(0,0,0,0.08) !important;
                }

                /* Ensure parent projects are semi-transparent */
                svg rect[fill="#BFDBFE"] {
                    fill-opacity: 0.5 !important;
                }
                
                /* Ensure bars are visible but don't hide the background completely */
                .gantt-task-react-bar-background {
                    fill-opacity: 0.8 !important;
                }

                /* Fix overlapping header labels in narrow columns */
                /* Target the day labels (e.g., "Sáb, 17") */
                .gantt-task-react-calendar-bottom-text {
                    font-size: 10px !important;
                    fill: #64748b !important;
                }

                /* Change text to only 2 letters and stack it for Day view */
                .gantt-task-react-container svg g[data-view-mode="Day"] .gantt-task-react-calendar-bottom-text {
                    /* Since we can't easily change the text content via CSS in SVG, 
                       we'll use a trick or simply make it very clean. 
                       Actually, the library provides the string. Let's try to limit width and stack. */
                    letter-spacing: -0.5px;
                }
                
                /* Fullscreen specific styles */
                :fullscreen .gantt-task-react-wrapper,
                :fullscreen .gantt-task-react-container,
                :fullscreen .gantt-task-react-container > div {
                    max-height: calc(100vh - 60px) !important;
                    overflow: auto !important;
                }
            `}</style>
        </div>
    )
}
