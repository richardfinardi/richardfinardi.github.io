package net.consultoriarf.monitoramento;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

public final class IncidentNotifier {
    private static final String CHANNEL = "rf_monitor_alertas";
    private static final String PREF = "rf_widget";
    private static final String KEY = "incident_seen";
    private static final long DAY = 86400000L;

    private IncidentNotifier() {}

    public static void process(Context ctx, String rawJson) {
        try {
            JSONArray events = new JSONObject(rawJson).optJSONArray("eventos");
            if (events == null) return;
            SharedPreferences prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            Set<String> old = prefs.getStringSet(KEY, null);
            Set<String> known = old == null ? new HashSet<>() : new HashSet<>(old);
            Set<String> recent = new HashSet<>();
            boolean first = old == null;
            long now = System.currentTimeMillis();
            int alerts = 0;
            for (int i=0;i<events.length();i++) {
                JSONObject event = events.optJSONObject(i);
                if (event == null) continue;
                String type = event.optString("tipo");
                if (!"queda".equals(type) && !"recuperacao".equals(type)) continue;
                String when = event.optString("em");
                long created;
                try { created = Instant.parse(when).toEpochMilli(); }
                catch (Exception ignored) { continue; }
                if (now - created > DAY || created - now > 120000) continue;
                String key = event.optString("id") + "|" + type + "|" + when;
                recent.add(key);
                if (!first && !known.contains(key) && alerts < 8) {
                    String name = event.optString("nome", "API");
                    notifyEvent(ctx, key.hashCode(), name, type,
                       "queda".equals(type) ? "Indisponibilidade confirmada no Cloudflare."
                           : "O serviço voltou a responder normalmente.");
                    alerts++;
                }
            }
            // Inicialização não envia incidentes antigos. Nos próximos testes,
            // as novas quedas são notificadas mesmo se a API já se recuperou.
            prefs.edit().putStringSet(KEY, recent).apply();
        } catch (Exception ex) {
            Log.w("MonitoramentoRF", "Erro ao processar alertas", ex);
        }
    }

    public static void test(Context ctx) {
        notifyEvent(ctx, 999000, "Monitoramento RF", "teste",
            "Notificações de queda e recuperação habilitadas.");
    }

    private static void notifyEvent(Context ctx, int id, String name,
                                    String type, String description) {
        if (Build.VERSION.SDK_INT >= 33 &&
                ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager =
            (NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL,
                "Quedas e recuperações", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Avisos de incidentes das APIs monitoradas.");
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(ctx, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String title = "queda".equals(type) ? "API fora do ar: " + name :
            "recuperacao".equals(type) ? "API recuperada: " + name :
            "Monitoramento RF — teste";
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        Notification n = builder.setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title).setContentText(description)
            .setContentIntent(pending).setAutoCancel(true)
            .setPriority(Notification.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_STATUS).build();
        manager.notify(id, n);
    }
}
