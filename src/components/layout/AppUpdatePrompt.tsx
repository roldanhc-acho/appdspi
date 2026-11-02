import { useEffect, useState } from "react"
import { Sparkles, RefreshCw, Calendar, MousePointerClick, Zap } from "lucide-react"

const CURRENT_APP_VERSION = "2026.11.02-v1"
const STORAGE_KEY = "dspi_ack_app_version"

export function AppUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false)
    const [targetVersion, setTargetVersion] = useState(CURRENT_APP_VERSION)
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        const checkVersion = async () => {
            const ackVersion = localStorage.getItem(STORAGE_KEY)

            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
                if (res.ok) {
                    const data = await res.json()
                    const remoteVersion = data?.version || CURRENT_APP_VERSION
                    setTargetVersion(remoteVersion)
                    if (ackVersion !== remoteVersion) {
                        setShowPrompt(true)
                        return
                    }
                }
            } catch {
                // Fallback a la constante local si falla la red
            }

            if (ackVersion !== CURRENT_APP_VERSION) {
                setShowPrompt(true)
            }
        }

        checkVersion()

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkVersion()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
    }, [])

    const handleUpdateNow = async () => {
        setIsUpdating(true)
        try {
            localStorage.setItem(STORAGE_KEY, targetVersion)

            if ("serviceWorker" in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations()
                await Promise.all(registrations.map(r => r.update()))
            }

            if ("caches" in window) {
                const cacheKeys = await caches.keys()
                await Promise.all(cacheKeys.map(k => caches.delete(k)))
            }
        } catch (err) {
            console.warn("Error updating cache:", err)
        } finally {
            window.location.reload()
        }
    }

    if (!showPrompt) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white leading-tight">
                            Nueva actualización disponible
                        </h2>
                        <p className="text-xs text-slate-400">
                            Actualizá para aplicar las últimas mejoras en la plataforma
                        </p>
                    </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 mb-5 text-xs sm:text-sm">
                    <div className="flex items-start gap-2.5">
                        <Calendar className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-slate-300">
                            <strong className="text-white">Feriados en calendario:</strong> Nuevo fondo naranja difuminado con la descripción del feriado visible en la tarjeta.
                        </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                        <MousePointerClick className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-slate-300">
                            <strong className="text-white">Doble clic para cargar:</strong> Hacé doble clic en un día para abrir directo el formulario de nuevo registro (1 clic despliega el detalle).
                        </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                        <Zap className="h-4 w-4 text-emerald-400 fill-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-slate-300">
                            <strong className="text-white">Registro rápido (1 clic):</strong> Botón para completar el día al instante en usuarios con tarea y horario fijo diario.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={isUpdating}
                    onClick={handleUpdateNow}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-60"
                >
                    <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
                    <span>{isUpdating ? "Actualizando..." : "Actualizar ahora"}</span>
                </button>
            </div>
        </div>
    )
}
