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

## Versão 1.1.0 — compacto e translúcido

- Layout compacto com cinco linhas, altura mínima de 172dp e largura de 210dp; bordas arredondadas.
- Fundo azul escuro a 60% de opacidade (40% de transparência), permitindo ver o papel de parede.
- Widget pode ser redimensionado pela tela inicial do Android.
- Atenção: o APK debug compilado pelo GitHub Actions recebe nova assinatura a cada execução. Para instalar esta versão no lugar da anterior, pode ser preciso remover o widget, desinstalar o aplicativo antigo e instalar novamente, adicionando o novo widget. Os dados permanecem disponíveis online no painel.

## Atualizacao 1.2.0 (widget de 2 x 2 celulas)

- Altura real do cartao compacta, sem o vazio superior/inferior.
- Fundo com 50% de opacidade e bordas discretas.
- Grade de 2x2 celulas, linhas de 16dp, card com altura natural.
- Atualizacoes futuras tentam reutilizar a mesma assinatura de teste via cache do GitHub Actions.
- Remova o widget antigo da tela e adicione o novo. Devido a assinatura da versao anterior, podera ser preciso desinstalar o APK anterior uma ultima vez.
