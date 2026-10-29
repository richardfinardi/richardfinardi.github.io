package net.consultoriarf.monitoramento;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

public final class RefreshSchedule {
    private static final int ALARM_ID = 72616;
    private static final long PERIOD = 15L * 60 * 1000;
    private RefreshSchedule() {}

    public static boolean hasWidget(Context ctx) {
        int[] ids = AppWidgetManager.getInstance(ctx)
            .getAppWidgetIds(new ComponentName(ctx, MonitorWidget.class));
        return ids != null && ids.length > 0;
    }
    private static PendingIntent intent(Context ctx, int flags) {
        Intent i = new Intent(ctx, MonitorAlarmReceiver.class);
        i.setAction(MonitorAlarmReceiver.ACTION_ALARM);
        return PendingIntent.getBroadcast(ctx, ALARM_ID, i,
            flags | PendingIntent.FLAG_IMMUTABLE);
    }
    public static void schedule(Context ctx) {
        if (!hasWidget(ctx)) return;
        AlarmManager alarm = (AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
        if (alarm != null) alarm.setAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + PERIOD,
            intent(ctx, PendingIntent.FLAG_UPDATE_CURRENT));
    }
    public static void cancel(Context ctx) {
        AlarmManager alarm = (AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent p = intent(ctx, PendingIntent.FLAG_NO_CREATE);
        if (alarm != null && p != null) { alarm.cancel(p); p.cancel(); }
    }
}
