package net.consultoriarf.monitoramento;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class MonitorAlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_ALARM = "net.consultoriarf.monitoramento.AUTO_REFRESH";
    @Override public void onReceive(Context ctx, Intent intent) {
        if (!RefreshSchedule.hasWidget(ctx)) return;
        RefreshSchedule.schedule(ctx);
        RefreshJobService.schedule(ctx);
        String action = intent == null ? "" : intent.getAction();
        if (ACTION_ALARM.equals(action) ||
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            RefreshJobService.requestNow(ctx);
        }
    }
}
