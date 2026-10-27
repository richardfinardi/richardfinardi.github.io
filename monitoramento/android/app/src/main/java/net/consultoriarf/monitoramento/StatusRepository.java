package net.consultoriarf.monitoramento;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

public final class StatusRepository {
    public static final String STATUS_URL = "https://consultoriarf.net/monitoramento/data/status.json";
    public static final String PANEL_URL = "https://consultoriarf.net/monitoramento/";
    private static final String PREF = "rf_widget";
    private static final int GREEN = Color.rgb(76, 218, 159);
    private static final int YELLOW = Color.rgb(255, 195, 86);
    private static final int RED = Color.rgb(255, 111, 127);
    private static final int GREY = Color.rgb(151, 169, 193);

    private static final String[] IDS = {"sintercan", "pstec", "anfeer", "columbia", "brastorno"};
    private static final int[] LABEL_VIEWS = {
            R.id.status_sintercan, R.id.status_pstec, R.id.status_anfeer,
            R.id.status_columbia, R.id.status_brastorno
    };

    private StatusRepository() { }

    public static void showCached(Context context) {
        String cached = context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString("last_json", "");
        render(context, cached, false);
    }

    public static void refresh(Context context) {
        String received = null;
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(STATUS_URL).openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "MonitoramentoRF-Android/1.0");
            try {
                if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
                try (InputStream in = conn.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = in.read(buffer)) != -1 && bytes.size() < 524288) {
                        bytes.write(buffer, 0, read);
                    }
                    received = bytes.toString(StandardCharsets.UTF_8.name());
                }
                JSONObject payload = new JSONObject(received);
                if (!payload.has("monitores") || !payload.get("monitores").getClass().equals(JSONArray.class)) {
                    throw new Exception("Status invalido");
                }
            } finally {
                conn.disconnect();
            }
            context.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit()
                    .putString("last_json", received).apply();
            render(context, received, false);
        } catch (Exception error) {
            String cached = context.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString("last_json", "");
            render(context, cached, true);
        }
    }

    private static void render(Context context, String json, boolean networkError) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] widgets = manager.getAppWidgetIds(new ComponentName(context, MonitorWidget.class));
        if (widgets == null || widgets.length == 0) return;

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget);
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent openAction = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent refresh = new Intent(context, MonitorWidget.class).setAction(MonitorWidget.ACTION_REFRESH);
        PendingIntent refreshAction = PendingIntent.getBroadcast(context, 1, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_title, openAction);
        views.setOnClickPendingIntent(R.id.widget_open, openAction);
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshAction);

        Map<String, String> states = new HashMap<>();
        String last = null;
        try {
            JSONObject body = new JSONObject(json);
            last = body.optString("atualizado_em", "");
            JSONArray monitors = body.optJSONArray("monitores");
            if (monitors != null) {
                for (int i = 0; i < monitors.length(); i++) {
                    JSONObject item = monitors.optJSONObject(i);
                    if (item != null) states.put(item.optString("id"), item.optString("estado"));
                }
            }
        } catch (Exception ignored) { }

        int healthy = 0;
        int degraded = 0;
        for (int i = 0; i < IDS.length; i++) {
            String state = states.get(IDS[i]);
            String caption = "AGUARDANDO";
            int color = GREY;
            if ("online".equals(state)) {
                caption = "● ONLINE";
                color = GREEN;
                healthy++;
            } else if ("lento".equals(state)) {
                caption = "● LENTO";
                color = YELLOW;
                degraded++;
            } else if ("instavel".equals(state)) {
                caption = "● INSTÁVEL";
                color = YELLOW;
                degraded++;
            } else if ("offline".equals(state)) {
                caption = "● OFFLINE";
                color = RED;
                degraded++;
            }
            views.setTextViewText(LABEL_VIEWS[i], caption);
            views.setTextColor(LABEL_VIEWS[i], color);
        }

        String summary;
        if (networkError) summary = "Sem conexão • último resultado";
        else if (states.isEmpty()) summary = "Aguardando primeira verificação";
        else summary = healthy + " online • " + degraded + " em atenção";
        views.setTextViewText(R.id.widget_summary, summary);

        String updated = "Atualização pendente";
        if (last != null && !last.isEmpty() && !"null".equals(last)) {
            try {
                OffsetDateTime time = OffsetDateTime.parse(last);
                String formatted = time.atZoneSameInstant(ZoneId.systemDefault())
                        .format(DateTimeFormatter.ofPattern("dd/MM HH:mm"));
                long elapsed = Duration.between(time.toInstant(), java.time.Instant.now()).toMinutes();
                updated = (elapsed > 20 ? "Atrasado • " : "Verificado ") + formatted;
            } catch (Exception ignored) { }
        }
        views.setTextViewText(R.id.widget_updated, updated);
        manager.updateAppWidget(widgets, views);
    }
}
