package net.consultoriarf.monitoramento;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public final class MonitorWidget extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "net.consultoriarf.monitoramento.REFRESH";
    @Override public void onEnabled(Context ctx) {
        super.onEnabled(ctx);
        RefreshSchedule.schedule(ctx); RefreshJobService.schedule(ctx);
    }
    @Override public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        super.onUpdate(ctx,m,ids);
        RefreshSchedule.schedule(ctx); RefreshJobService.schedule(ctx);
        StatusRepository.showCached(ctx); refreshAsync(ctx);
    }
    @Override public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx,intent);
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) {
            RefreshSchedule.schedule(ctx); RefreshJobService.schedule(ctx);
            refreshAsync(ctx);
        }
    }
    @Override public void onDisabled(Context ctx) {
        super.onDisabled(ctx);
        RefreshSchedule.cancel(ctx); RefreshJobService.cancel(ctx);
    }
    private void refreshAsync(Context ctx) {
        PendingResult pending = goAsync();
        Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try { StatusRepository.refresh(app); }
            catch (Exception ex) { Log.w("MonitoramentoRF","Refresh falhou", ex); }
            finally { pending.finish(); }
        }, "rf-widget-refresh").start();
    }
}
