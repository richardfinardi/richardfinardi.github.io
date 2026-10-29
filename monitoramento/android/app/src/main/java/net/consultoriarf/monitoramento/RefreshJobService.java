package net.consultoriarf.monitoramento;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.util.Log;

public final class RefreshJobService extends JobService {
    private static final int PERIODIC_ID = 72615;
    private static final int IMMEDIATE_ID = 72617;
    private static final long FIFTEEN_MIN = 15L * 60 * 1000;
    public static void schedule(Context ctx) {
        if (!RefreshSchedule.hasWidget(ctx)) return;
        JobScheduler jobs = (JobScheduler)ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (jobs == null) return;
        jobs.schedule(new JobInfo.Builder(PERIODIC_ID,
            new ComponentName(ctx, RefreshJobService.class))
            .setPeriodic(FIFTEEN_MIN, 5L * 60 * 1000)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPersisted(true).build());
    }
    public static void requestNow(Context ctx) {
        if (!RefreshSchedule.hasWidget(ctx)) return;
        JobScheduler jobs = (JobScheduler)ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (jobs == null) return;
        ComponentName service = new ComponentName(ctx, RefreshJobService.class);
        try {
            JobInfo.Builder b = new JobInfo.Builder(IMMEDIATE_ID, service)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY);
            if (Build.VERSION.SDK_INT >= 31) b.setExpedited(true);
            else b.setOverrideDeadline(0);
            if (jobs.schedule(b.build()) == JobScheduler.RESULT_SUCCESS) return;
        } catch (Exception ex) { Log.w("MonitoramentoRF", "Job expedito falhou", ex); }
        try {
            jobs.schedule(new JobInfo.Builder(IMMEDIATE_ID, service)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setOverrideDeadline(0).build());
        } catch (Exception ex) { Log.w("MonitoramentoRF", "Job fallback falhou", ex); }
    }
    public static void cancel(Context ctx) {
        JobScheduler jobs = (JobScheduler)ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (jobs != null) { jobs.cancel(PERIODIC_ID); jobs.cancel(IMMEDIATE_ID); }
    }
    @Override public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try { StatusRepository.refresh(getApplicationContext()); }
            catch (Exception ex) { Log.e("MonitoramentoRF", "Erro no job automatico", ex); }
            finally { jobFinished(params, false); }
        }, "rf-background-check").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) { return true; }
}
