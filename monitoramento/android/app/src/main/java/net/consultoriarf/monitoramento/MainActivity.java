package net.consultoriarf.monitoramento;

import android.app.Activity;
import android.Manifest;
import android.os.Build;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        RefreshSchedule.schedule(this);
        RefreshJobService.schedule(this);
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 200);
        }


        Button add = findViewById(R.id.button_add);
        Button refresh = findViewById(R.id.button_refresh);
        Button panel = findViewById(R.id.button_panel);
        Button test = findViewById(R.id.button_test_alert);
        Button battery = findViewById(R.id.button_battery);
        test.setOnClickListener(v -> {
            IncidentNotifier.test(this);
            Toast.makeText(this, "Teste de notificação enviado.", Toast.LENGTH_SHORT).show();
        });
        battery.setOnClickListener(v -> startActivity(new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getPackageName()))));


        add.setOnClickListener(v -> {
            AppWidgetManager manager = getSystemService(AppWidgetManager.class);
            ComponentName provider = new ComponentName(this, MonitorWidget.class);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                boolean requested = manager.requestPinAppWidget(provider, null, null);
                if (!requested) Toast.makeText(this, "Adicione pelo menu Widgets da tela inicial.", Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "Segure na tela inicial → Widgets → Monitoramento RF.", Toast.LENGTH_LONG).show();
            }
        });

        refresh.setOnClickListener(v -> {
            sendBroadcast(new Intent(this, MonitorWidget.class).setAction(MonitorWidget.ACTION_REFRESH));
            Toast.makeText(this, "Atualizando widget…", Toast.LENGTH_SHORT).show();
        });

        panel.setOnClickListener(v -> {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(StatusRepository.PANEL_URL)));
        });
    }
}
