import { useMemo } from "react"
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import type { Task } from "@/types/database.types"
import { Clock, Pencil, AlertCircle } from "lucide-react"
import { useDroppable, useDraggable } from "@dnd-kit/core"
import { format } from "date-fns"
import { parseLocalDate } from "@/utils/dateUtils"

type KanbanTask = Task & {
    projects?: { name: string; client_id: string } | null
    task_assignments?: {
        profiles: { full_name: string } | null
    }[]
}

type TaskKanbanProps = {
    tasks: KanbanTask[]
    onUpdateStatus: (taskId: string, newStatus: Task["status"]) => void
    taskProgress?: Record<string, number>
    onEdit?: (task: KanbanTask) => void
}

const statusMap = {
    pending: "Pendiente",
    in_progress: "En Proceso",
    finished: "Finalizado",
    cancelled: "Suspendido/Cancelado"
}

const containerStyles = {
    pending: "bg-slate-50/50 dark:bg-slate-900/50",
    in_progress: "bg-blue-50/30 dark:bg-blue-900/10",
    finished: "bg-green-50/30 dark:bg-green-900/10",
    cancelled: "bg-red-50/30 dark:bg-red-900/10"
}

export function TaskKanban({ tasks, onUpdateStatus, taskProgress = {}, onEdit }: TaskKanbanProps) {
    const columns = useMemo(() => {
        const cols = {
            pending: [] as KanbanTask[],
            in_progress: [] as KanbanTask[],
            finished: [] as KanbanTask[],
            cancelled: [] as KanbanTask[]
        }
        tasks.forEach(task => {


            const status = (task.status || "pending") as keyof typeof cols
            if (cols[status]) {
                cols[status].push(task)
            }
        })
        return cols
    }, [tasks])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over) return

        const taskId = active.id as string
        const overId = over.id as string

        // Si el overId es uno de los estados, actualizar directamente
        const validStatuses = Object.keys(statusMap)
        let newStatus = validStatuses.includes(overId) ? overId : null

        // Si soltamos sobre otra tarea, buscar a qué columna pertenece esa tarea
        if (!newStatus) {
            const targetTask = tasks.find(t => t.id === overId)
            if (targetTask) {
                newStatus = targetTask.status
            }
        }

        if (taskId && newStatus) {
            const task = tasks.find(t => t.id === taskId)
            if (task && task.status !== newStatus) {
                onUpdateStatus(taskId, newStatus as Task["status"])
            }
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-4 h-[calc(100vh-250px)] gap-4 pb-4 w-full">
                {(Object.keys(columns) as Array<keyof typeof columns>).map((status) => (
                    <DroppableColumn
                        key={status}
                        id={status}
                        title={statusMap[status]}
                        tasks={columns[status]}
                        colorClass={containerStyles[status]}
                        progressMap={taskProgress}
                        onEdit={onEdit}
                    />
                ))}
            </div>
        </DndContext>
    )
}

function DroppableColumn({ id, title, tasks, colorClass, progressMap, onEdit }: {
    id: string,
    title: string,
    tasks: KanbanTask[],
    colorClass: string,
    progressMap: Record<string, number>,
    onEdit?: (task: KanbanTask) => void
}) {
    const { isOver, setNodeRef } = useDroppable({ id })

    return (
        <div
            ref={setNodeRef}
            className={`flex h-full flex-col rounded-xl border-2 transition-colors ${colorClass} 
            ${isOver ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20' : 'border-transparent'}`}
        >
            <div className="flex items-center justify-between p-4 flex-shrink-0">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                    {tasks.length}
                </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3 min-h-[100px]">
                {tasks.map(task => (
                    <DraggableTask
                        key={task.id}
                        task={task}
                        progress={progressMap[task.id] || 0}
                        onEdit={onEdit}
                    />
                ))}
                {tasks.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg h-24 flex items-center justify-center">
                        <p className="text-xs text-slate-400 italic">Soltar aquí</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function DraggableTask({ task, progress, onEdit }: { task: KanbanTask, progress: number, onEdit?: (task: KanbanTask) => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
    })

    const dueDateParsed = parseLocalDate(task.due_date)
    const isOverdue = dueDateParsed && dueDateParsed < new Date(new Date().setHours(0, 0, 0, 0)) && task.status !== 'finished'

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 100 : 50,
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grabbing'
    } : undefined

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`group cursor-grab rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-800 dark:border-slate-700 
                ${isOverdue ? 'border-red-500/50 bg-red-50 dark:bg-red-900/10' : ''}
                ${isDragging ? 'shadow-xl ring-2 ring-indigo-500 ring-opacity-50' : ''}`}
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase
                        ${task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                            task.priority === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}
                    `}>
                        {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media'}
                    </span>
                    {task.parent_task_id && (
                        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300 uppercase">
                            Subtarea
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(task);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all text-slate-400 pointer-events-auto"
                    >
                        <Pencil className="h-3 w-3" />
                    </button>
                    <div className="flex -space-x-2">
                        {task.task_assignments && task.task_assignments.map((assignment, idx) => (
                            <div
                                key={idx}
                                className="h-6 w-6 rounded-full bg-white dark:bg-slate-800 text-[8px] flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border-2 border-slate-50 dark:border-slate-900 shadow-sm uppercase shrink-0"
                                title={assignment.profiles?.full_name || "???"}
                            >
                                {(assignment.profiles?.full_name || "??").slice(0, 2).toUpperCase()}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <h4 className={`mb-1 text-sm font-semibold dark:text-white line-clamp-2 ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-800'}`}>
                {task.title}
            </h4>
            <div className="mb-3 text-[10px] text-slate-400 font-medium truncate uppercase">
                {task.projects?.name || 'Tarea General'}
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className={`text-[10px] font-bold min-w-[30px] ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                        {progress}%
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                        {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {isOverdue ? 'VENCIDA' : (dueDateParsed ? format(dueDateParsed, 'd MMM') : '-')}
                    </div>
                </div>
            </div>
        </div>
    )
}
