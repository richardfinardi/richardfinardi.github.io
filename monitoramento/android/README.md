# Monitoramento RF — widget Android nativo

Widget Android para `https://consultoriarf.net/monitoramento/data/status.json`.

- Mostra Sintercan, PSTEC, Anfeer, Columbia e Brastorno na tela inicial.
- Atualiza por JobScheduler aproximadamente a cada 15 minutos (não garantidos pelo Android; economia de bateria pode atrasar), e por toque em ↻.
- Reaproveita o último resultado offline e sinaliza dados atrasados após 20 minutos.
- Tocar em “Abrir” abre o painel completo.
- Não exige senha nem login; consulta somente dados públicos do monitoramento.
- A versão inicial do APK é assinada com certificado de debug temporário gerado no GitHub Actions. Builds futuros poderão exigir desinstalar a versão anterior caso o certificado mude. Uma assinatura estável requer chave de assinatura guardada em GitHub Actions Secrets, nunca no repositório público.

## Compilar

Com Java 17, Android SDK 35 e Gradle 8.11.1:

```
gradle -p monitoramento/android :app:assembleDebug
```

APK em `monitoramento/android/app/build/outputs/apk/debug/app-debug.apk`.
