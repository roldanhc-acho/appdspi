// Service Worker para Notificaciones Push - DSPI
// Permite recibir notificaciones del sistema incluso cuando la app está cerrada

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler fetch para cumplimiento de criterios PWA instalable en navegadores móviles (Chrome/Edge)
self.addEventListener("fetch", (event) => {
  // Manejo de peticiones de red
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "DSPI - Recordatorio de Agenda",
    body: "Tienes un evento programado para hoy.",
    url: "/agenda",
    eventId: null,
  };

  try {
    const json = event.data.json();
    payload = { ...payload, ...json };
  } catch (e) {
    payload.body = event.data.text() || payload.body;
  }

  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    tag: payload.eventId ? `agenda-event-${payload.eventId}` : "agenda-general",
    renotify: true,
    data: {
      url: payload.url || "/agenda",
      eventId: payload.eventId,
    },
    actions: [
      {
        action: "open_agenda",
        title: "Ver en Agenda",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/agenda";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una pestaña abierta de la app, enfocarla y navegar
      for (const client of windowClients) {
        if ("focus" in client) {
          if (client.url.includes("/agenda")) {
            return client.focus();
          }
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Si la app estaba cerrada por completo, abrir nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
