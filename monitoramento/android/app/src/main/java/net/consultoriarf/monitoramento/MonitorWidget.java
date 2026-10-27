package net.consultoriarf.monitoramento;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

public final class MonitorWidget extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "net.consultoriarf.monitoramento.REFRESH";

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        RefreshJobService.schedule(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        super.onUpdate(context, manager, widgetIds);
        RefreshJobService.schedule(context);
        StatusRepository.showCached(context);
        updateAsync(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            updateAsync(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        RefreshJobService.cancel(context);
    }

    private void updateAsync(Context context) {
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                StatusRepository.refresh(app);
            } finally {
                pending.finish();
            }
        }, "rf-widget-refresh").start();
    }
}
