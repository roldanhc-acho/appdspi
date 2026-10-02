import { useState } from "react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { Bell, BellOff, BellRing, Loader2, AlertTriangle, CheckCircle } from "lucide-react"

interface PushNotificationToggleProps {
  compact?: boolean
  className?: string
}

export function PushNotificationToggle({ compact = false, className = "" }: PushNotificationToggleProps) {
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications()
  const [showInfoModal, setShowInfoModal] = useState(false)

  const handleToggle = async () => {
    if (!isSupported) {
      setShowInfoModal(true)
      return
    }
    if (isSubscribed) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  // Vista compacta para el Header
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={(!isSupported || permission === "denied") ? () => setShowInfoModal(true) : handleToggle}
          disabled={isLoading}
          className={`relative p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
            isSubscribed
              ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 dark:hover:bg-indigo-900/60"
              : (!isSupported || permission === "denied")
              ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
          title={
            !isSupported
              ? "Notificaciones no soportadas en este navegador - Clic para más información"
              : isSubscribed
              ? "Recordatorios de agenda activos (8:00 AM) - Clic para desactivar"
              : permission === "denied"
              ? "Notificaciones bloqueadas en el navegador - Clic para ver cómo activarlas"
              : "Activar avisos de agenda a las 8:00 AM en este dispositivo"
          }
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            <>
              <BellRing className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </>
          ) : permission === "denied" ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </button>

        {/* Modal de ayuda si el navegador tiene los permisos bloqueados o falta soporte */}
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-left">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span>{!isSupported ? "Requisitos de Notificaciones" : "Notificaciones bloqueadas"}</span>
              </div>
              {!isSupported ? (
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-4 leading-relaxed">
                  <p>Tu navegador actual no admite notificaciones en segundo plano en esta pestaña.</p>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-1">
                    <li>Asegúrate de acceder a la web mediante <strong>HTTPS</strong>.</li>
                    <li>En teléfonos <strong>iPhone (iOS)</strong>: Toca en <em>Compartir</em> y luego en <em>"Agregar a pantalla de inicio"</em>.</li>
                    <li>En <strong>Android</strong>: Usa Chrome, Edge o Firefox estándar.</li>
                  </ul>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                    El navegador tiene los permisos bloqueados para este sitio. Para recibir los avisos a las 8:00 AM:
                  </p>
                  <ol className="text-xs text-slate-600 dark:text-slate-400 list-decimal pl-5 space-y-1.5 mb-4">
                    <li>Haz clic en el icono de <strong>candado o configuración</strong> a la izquierda de la URL.</li>
                    <li>Busca la opción <strong>Notificaciones</strong> y cámbiala a <strong>Permitir</strong>.</li>
                    <li>Recarga la página y vuelve a pulsar la campana.</li>
                  </ol>
                </>
              )}
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Vista en tarjeta/banner (para AgendaPage)
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 ${
        isSubscribed
          ? "bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/50"
          : permission === "denied"
          ? "bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/50"
          : "bg-indigo-50/70 border-indigo-200/80 dark:bg-indigo-950/20 dark:border-indigo-900/50"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 mt-0.5 sm:mt-0 ${
              isSubscribed
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                : permission === "denied"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
            }`}
          >
            {isSubscribed ? (
              <CheckCircle className="h-5 w-5" />
            ) : permission === "denied" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <BellRing className="h-5 w-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isSubscribed
                ? "Recordatorios automáticos activados"
                : permission === "denied"
                ? "Notificaciones bloqueadas por el navegador"
                : "Avisos a las 8:00 AM en tu dispositivo"}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
              {isSubscribed
                ? "Recibirás una notificación a las 8:00 AM el día de cada evento (público o privado al que estés convocado), incluso con la app cerrada."
                : permission === "denied"
                ? "Debes habilitar las notificaciones desde el icono del candado en la barra del navegador para recibir avisos."
                : "Activa las notificaciones para que el sistema te avise a las 8:00 AM sobre tus eventos del día aunque no tengas la app abierta."}
            </p>
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 self-end sm:self-center">
          {permission === "denied" ? (
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 transition-colors"
            >
              Cómo desbloquear
            </button>
          ) : (
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-medium shadow-sm transition-all duration-150 ${
                isSubscribed
                  ? "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : isSubscribed ? (
                <>
                  <BellOff className="h-3.5 w-3.5 text-slate-500" />
                  <span>Desactivar</span>
                </>
              ) : (
                <>
                  <Bell className="h-3.5 w-3.5" />
                  <span>Activar avisos</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
