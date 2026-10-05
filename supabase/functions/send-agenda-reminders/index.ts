// Supabase Edge Function: send-agenda-reminders
// Se ejecuta diariamente a las 8:00 AM (hora Argentina) invocada por pg_cron
// o bajo demanda desde la app para pruebas de dispositivo y reintentos.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

interface ReminderRow {
  event_id: string;
  event_title: string;
  event_description: string | null;
  event_time: string | null;
  is_public: boolean;
  target_user_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:soporte@dspi.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Faltan configurar las variables de entorno VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en Supabase.");
    }

    // Configurar web-push con las claves VAPID
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Cliente con Service Role para invocar funciones seguras
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Leer cuerpo opcional de la petición
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      // cuerpo vacío o no-json (invocación regular por cron)
    }

    // =========================================================================
    // 1. MODO PRUEBA DE DISPOSITIVO (Envío inmediato a un usuario o dispositivo)
    // =========================================================================
    if (requestBody && requestBody.action === "test_device") {
      const targetUserId = requestBody.user_id;
      let query = supabaseAdmin.from("push_subscriptions").select("*");
      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      } else if (requestBody.endpoint) {
        query = query.eq("endpoint", requestBody.endpoint);
      }

      const { data: subs, error: subErr } = await query;
      if (subErr) throw subErr;

      if (!subs || subs.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "No se encontró suscripción push registrada para este usuario en la base de datos. Asegúrate de activar el switch de Avisos primero.",
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            status: 404,
          }
        );
      }

      const title = requestBody.title || "DSPI - Prueba de Notificación 🔔";
      const body = requestBody.body || "¡Tu dispositivo está correctamente conectado y listo para recibir avisos de Agenda!";
      const payload = JSON.stringify({
        title,
        body,
        url: "/agenda",
        test: true,
      });

      let sentCount = 0;
      let failedCount = 0;

      for (const sub of subs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 3600,
            urgency: "high",
          });
          sentCount++;
        } catch (err: any) {
          console.error(`Error enviando test push a sub ${sub.id}:`, err);
          failedCount++;
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: sentCount > 0,
          mode: "test_device",
          sent: sentCount,
          failed: failedCount,
          totalSubscribedDevices: subs.length,
          message: sentCount > 0 ? "Notificación de prueba enviada con éxito." : "Error al enviar la notificación.",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          status: 200,
        }
      );
    }

    // =========================================================================
    // 2. MODALIDAD BROADCAST (envío masivo a todos los dispositivos registrados)
    // =========================================================================
    if (requestBody && requestBody.broadcast) {
      console.log("[send-agenda-reminders] Iniciando envío BROADCAST");
      const { data: allSubscriptions, error: subError } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*");

      if (subError) throw subError;

      const title = requestBody.title || "DSPI - Actualización disponible 🚀";
      const body = requestBody.body || "Hay una nueva versión disponible. Refresca la app para ver las mejoras.";
      const url = requestBody.url || "/";

      const payload = JSON.stringify({
        title,
        body,
        url,
      });

      let sentCount = 0;
      let failedCount = 0;
      let expiredCount = 0;

      for (const sub of (allSubscriptions || [])) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 86400,
            urgency: "high",
          });
          sentCount++;
        } catch (err: any) {
          console.error(`Error enviando broadcast a sub ${sub.id}:`, err);
          failedCount++;
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            expiredCount++;
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "broadcast",
          totalRecipients: (allSubscriptions || []).length,
          sent: sentCount,
          failed: failedCount,
          expiredCleaned: expiredCount,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          status: 200,
        }
      );
    }

    // =========================================================================
    // 3. MODO RECORDATORIOS DIARIOS DE AGENDA (Cron regular o Forzado manual)
    // =========================================================================
    const argentinaDate = requestBody?.target_date || new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const isForceRun = requestBody && (requestBody.action === "force_today" || requestBody.force === true);

    // Si es ejecución forzada con reenvío, limpiar logs de hoy para permitir reenvío
    if (isForceRun && requestBody.ignore_logs) {
      console.log(`[send-agenda-reminders] Limpiando logs previos para forzar reenvío en fecha: ${argentinaDate}`);
      await supabaseAdmin.from("push_notification_logs").delete().eq("sent_for_date", argentinaDate);
    }

    console.log(`[send-agenda-reminders] Iniciando recordatorios para fecha: ${argentinaDate} (isForceRun: ${Boolean(isForceRun)})`);

    // Consultar recordatorios pendientes
    const { data: reminders, error: rpcError } = await supabaseAdmin.rpc(
      "get_agenda_reminders_for_date",
      { target_date: argentinaDate }
    );

    if (rpcError) {
      console.error("Error al invocar get_agenda_reminders_for_date:", rpcError);
      throw rpcError;
    }

    const rows = (reminders || []) as ReminderRow[];
    console.log(`[send-agenda-reminders] Encontrados ${rows.length} envíos pendientes.`);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No hay recordatorios pendientes para enviar en la fecha indicada.",
          date: argentinaDate,
          sentCount: 0,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          status: 200,
        }
      );
    }

    let successCount = 0;
    let failedCount = 0;
    let expiredSubscriptionsDeleted = 0;

    for (const row of rows) {
      const pushSubscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      // Formatear texto del mensaje
      const timePrefix = row.event_time ? `⏰ ${row.event_time.slice(0, 5)} hs` : "🗓️ Hoy";
      const scopePrefix = row.is_public ? "Evento público" : "Evento privado";

      const title = `${timePrefix} - ${row.event_title}`;
      const body = row.event_description
        ? `${scopePrefix}: ${row.event_description}`
        : `${scopePrefix} agendado para el día de hoy.`;

      const payload = JSON.stringify({
        title,
        body,
        url: "/agenda",
        eventId: row.event_id,
      });

      try {
        await webpush.sendNotification(pushSubscription, payload, {
          TTL: 86400, // 24 horas de vigencia
          urgency: "high",
        });

        // Registrar intento exitoso en logs
        await supabaseAdmin.rpc("log_push_notification_attempt", {
          p_event_id: row.event_id,
          p_user_id: row.target_user_id,
          p_sent_for_date: argentinaDate,
          p_status: "sent",
          p_error_message: null,
        });

        successCount++;
      } catch (err: any) {
        console.error(`Error enviando push a sub ${row.subscription_id}:`, err);
        failedCount++;

        // Si la suscripción ya no existe o caducó en el navegador (HTTP 404 o 410 Gone)
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.warn(`Suscripción expirada o inválida (${row.subscription_id}). Eliminando...`);
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", row.subscription_id);
          expiredSubscriptionsDeleted++;
        }

        // Registrar log de falla
        await supabaseAdmin.rpc("log_push_notification_attempt", {
          p_event_id: row.event_id,
          p_user_id: row.target_user_id,
          p_sent_for_date: argentinaDate,
          p_status: "failed",
          p_error_message: err.message || "Error al enviar push",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: argentinaDate,
        totalCandidates: rows.length,
        sent: successCount,
        failed: failedCount,
        expiredSubscriptionsCleaned: expiredSubscriptionsDeleted,
        message: `Procesados ${rows.length} avisos. Enviados con éxito: ${successCount}.`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error global en send-agenda-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 500,
      }
    );
  }
});
