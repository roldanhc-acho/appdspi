import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported"

export function usePushNotifications() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [permission, setPermission] = useState<PushPermissionState>("unsupported")
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Registrar el Service Worker y verificar soporte inicial
  useEffect(() => {
    const checkSupport = async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
          setIsSupported(false)
          setPermission("unsupported")
          setIsLoading(false)
          return
        }

        setIsSupported(true)
        setPermission(Notification.permission as PushPermissionState)

        // Registrar o esperar a que el SW esté activo
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        await navigator.serviceWorker.ready

        // Verificar si este navegador ya tiene una suscripción activa
        const existingSubscription = await registration.pushManager.getSubscription()
        if (existingSubscription && user) {
          setIsSubscribed(true)
        } else {
          setIsSubscribed(false)
        }
      } catch (err: any) {
        console.error("Error al inicializar Push / Service Worker:", err)
      } finally {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [user])

  // Suscribir al usuario
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError("Tu navegador o dispositivo no soporta notificaciones push.")
      return false
    }

    if (!user) {
      setError("Debes iniciar sesión para activar las notificaciones.")
      return false
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BGqYn2lYU8LbjInLZXTCWJXqncSWE6QgcnuKFioZYGULDWzR4hbbBWxHdNHZFd9QsHTtGHtLK___3QijJ_eaoCU"
    if (!vapidKey) {
      setError("Falta configurar VITE_VAPID_PUBLIC_KEY en el entorno.")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Solicitar permisos al usuario si aún no los tiene
      const permResult = await Notification.requestPermission()
      setPermission(permResult as PushPermissionState)

      if (permResult !== "granted") {
        if (permResult === "denied") {
          setError("Has bloqueado las notificaciones en el navegador. Por favor habilítalas desde el icono del candado en la barra de direcciones.")
        }
        setIsLoading(false)
        return false
      }

      // 2. Obtener registro de Service Worker
      const registration = await navigator.serviceWorker.ready

      // 3. Suscribir en el PushManager del navegador
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey)
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
        })
      }

      // 4. Extraer claves de cifrado del navegador
      const rawKey = subscription.getKey ? subscription.getKey("p256dh") : null
      const rawAuth = subscription.getKey ? subscription.getKey("auth") : null

      if (!rawKey || !rawAuth) {
        throw new Error("No se pudieron obtener las claves criptográficas de la suscripción.")
      }

      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      // 5. Guardar en Supabase vinculado al usuario actual
      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )

      if (dbError) throw dbError

      setIsSubscribed(true)
      return true
    } catch (err: any) {
      console.error("Error al suscribirse a notificaciones push:", err)
      setError(err.message || "Error al activar las notificaciones.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, user])

  // Desuscribir al usuario
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          // Eliminar de Supabase
          if (user) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", subscription.endpoint)
          }

          // Desuscribir en el navegador
          await subscription.unsubscribe()
        }
      }

      setIsSubscribed(false)
      return true
    } catch (err: any) {
      console.error("Error al desuscribirse de notificaciones:", err)
      setError(err.message || "Error al desactivar notificaciones.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [user])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  }
}
