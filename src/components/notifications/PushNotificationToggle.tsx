import { useState } from "react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { Bell, BellOff, BellRing, Loader2, AlertTriangle, CheckCircle, Send } from "lucide-react"

interface PushNotificationToggleProps {
  variant?: "compact" | "banner" | "switch"
  compact?: boolean
  className?: string
}

export function PushNotificationToggle({
  variant,
  compact = false,
  className = ""
}: PushNotificationToggleProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications()

  const [showInfoModal, setShowInfoModal] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const isSwitchVariant = variant === "switch"
  const isCompactVariant = variant === "compact" || (compact && !isSwitchVariant)

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

  const handleSendTest = async () => {
    setIsTesting(true)
    setTestMessage(null)
    const result = await sendTestNotification()
    setIsTesting(false)
    setTestMessage(result.message)
    setTimeout(() => setTestMessage(null), 5000)
  }

  const renderInfoModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-left">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold mb-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{!isSupported ? "Requisitos de Notificaciones" : isSubscribed ? "Avisos de Agenda" : "Notificaciones bloqueadas"}</span>
        </div>
        {!isSupported ? (
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-4 leading-relaxed">
            <p>Tu navegador actual no admite notificaciones en segundo plano en esta pestaña.</p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-1">
              <li>Asegúrate de acceder a la web mediante <strong>HTTPS</strong>.</li>
              <li>En teléfonos <strong>iPhone (iOS)</strong>: Toca en <em>Compartir</em> y luego en <em>"Agregar a pantalla de inicio"</em>. Las notificaciones Web Push de Apple requieren abrir la app desde el icono de inicio.</li>
              <li>En <strong>Android</strong>: Usa Chrome, Edge o Firefox estándar.</li>
            </ul>
          </div>
        ) : isSubscribed ? (
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3 mb-4 leading-relaxed">
            <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" />
              Notificaciones activas en este dispositivo.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Recibirás recordatorios a las <strong>8:00 AM</strong> el día de cada evento agendado (público o privado al que pertenezcas).
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enviando prueba...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar notificación de prueba ahora</span>
                  </>
                )}
              </button>
            </div>
            {testMessage && (
              <p className="text-xs text-center text-primary font-medium mt-1">
                {testMessage}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              El navegador tiene los permisos bloqueados para este sitio. Para recibir los avisos a las 8:00 AM:
            </p>
            <ol className="text-xs text-slate-600 dark:text-slate-400 list-decimal pl-5 space-y-1.5 mb-4">
              <li>Haz clic en el icono de <strong>candado o configuración</strong> a la izquierda de la URL.</li>
              <li>Busca la opción <strong>Notificaciones</strong> y cámbiala a <strong>Permitir</strong>.</li>
              <li>Recarga la página y vuelve a pulsar el switch de Avisos.</li>
            </ol>
          </>
        )}
        <button
          onClick={() => setShowInfoModal(false)}
          className="w-full py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Cerrar
        </button>
      </div>
    </div>
  )

  // 1. Vista SWITCH ON/OFF ("Avisos")
  if (isSwitchVariant) {
    return (
      <div className={`relative inline-flex items-center gap-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-sm ${className}`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : isSubscribed ? (
            <BellRing className="h-3.5 w-3.5 text-primary animate-pulse" />
          ) : (
            <Bell className="h-3.5 w-3.5 text-slate-400" />
          )}
          <span>Avisos</span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isSubscribed}
          disabled={isLoading}
          onClick={(!isSupported || permission === "denied") ? () => setShowInfoModal(true) : handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isSubscribed ? "bg-primary shadow-sm shadow-primary/30" : "bg-slate-300 dark:bg-slate-700"
          }`}
          title={isSubscribed ? "Avisos activados a las 8:00 AM (clic para desactivar)" : "Toca para activar avisos a las 8:00 AM"}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isSubscribed ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>

        {isSubscribed && (
          <button
            type="button"
            onClick={handleSendTest}
            disabled={isTesting}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors ml-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-primary/40"
            title="Enviar notificación de prueba a este dispositivo"
          >
            {isTesting ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : (
              <Send className="h-3 w-3 text-slate-500 dark:text-slate-400" />
            )}
            <span className="hidden sm:inline">Probar</span>
          </button>
        )}

        {testMessage && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-slate-900 text-white text-[11px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap animate-in fade-in">
            {testMessage}
          </div>
        )}

        {showInfoModal && renderInfoModal()}
      </div>
    )
  }


  // 2. Vista compacta para el Header (Campanita)
  if (isCompactVariant) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={(!isSupported || permission === "denied") ? () => setShowInfoModal(true) : handleToggle}
          disabled={isLoading}
          className={`relative p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
            isSubscribed
              ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-900/60"
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
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            </>
          ) : permission === "denied" ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </button>

        {showInfoModal && renderInfoModal()}
      </div>
    )
  }

  // 3. Vista en tarjeta/banner tradicional
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 ${
        isSubscribed
          ? "bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/50"
          : permission === "denied"
          ? "bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/50"
          : "bg-red-50/70 border-red-200/80 dark:bg-red-950/20 dark:border-red-900/50"
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
                : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
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

        <div className="shrink-0 self-end sm:self-center flex items-center gap-2">
          {isSubscribed && (
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              title="Enviar notificación de prueba a este dispositivo"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Probando...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Probar</span>
                </>
              )}
            </button>
          )}

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
                  : "bg-primary text-white hover:bg-primary/90"
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


      {showInfoModal && renderInfoModal()}
    </div>
  )
}
