import { useEffect, useState } from "react"
import { Sparkles, RefreshCw, CheckCircle2 } from "lucide-react"

const CURRENT_APP_VERSION = __APP_VERSION__
const STORAGE_KEY = "dspi_ack_app_version"

interface VersionManifest {
    version: string
    title?: string
    highlights?: string[]
}

const DEFAULT_TITLE = "Nueva actualización disponible"
const DEFAULT_HIGHLIGHTS = [
    "Mejoras de estabilidad, rendimiento y correcciones generales en la plataforma.",
]

export function AppUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false)
    const [manifest, setManifest] = useState<VersionManifest>({
        version: CURRENT_APP_VERSION,
        title: DEFAULT_TITLE,
        highlights: DEFAULT_HIGHLIGHTS,
    })
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        const checkVersion = async () => {
            const ackVersion = localStorage.getItem(STORAGE_KEY)

            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
                if (res.ok) {
                    const data: Partial<VersionManifest> = await res.json()
                    const remoteVersion = data?.version || CURRENT_APP_VERSION
                    setManifest({
                        version: remoteVersion,
                        title: data?.title || DEFAULT_TITLE,
                        highlights: Array.isArray(data?.highlights) && data.highlights.length > 0
                            ? data.highlights
                            : DEFAULT_HIGHLIGHTS,
                    })
                    if (ackVersion !== remoteVersion) {
                        setShowPrompt(true)
                        return
                    }
                }
            } catch {
                // Fallback a la versión empaquetada si falla la red
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
            localStorage.setItem(STORAGE_KEY, manifest.version)

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

    const highlights = manifest.highlights ?? DEFAULT_HIGHLIGHTS

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg font-bold text-white leading-tight truncate">
                                {manifest.title || DEFAULT_TITLE}
                            </h2>
                            <span className="shrink-0 rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                v{manifest.version}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">
                            Actualizá para aplicar las últimas mejoras en la plataforma
                        </p>
                    </div>
                </div>

                <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 mb-5 text-xs sm:text-sm">
                    {highlights.map((item, idx) => (
                        <div key={`${manifest.version}-${idx}`} className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-slate-300 leading-relaxed">{item}</p>
                        </div>
                    ))}
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

