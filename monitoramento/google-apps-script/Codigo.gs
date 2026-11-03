/**
 * Monitoramento RF / AUVRIUN
 * Receptor seguro de incidentes do Cloudflare Worker.
 * Executa na conta Google do proprietario, usando MailApp.
 *
 * Nunca cole a chave em codigo nem envie a terceiros.
 * Execute configurarAlertas() uma vez. Depois implante como Web App.
 */

function configurarAlertas() {
  var properties = PropertiesService.getScriptProperties();
  var email = Session.getEffectiveUser().getEmail();
  if (!email) {
    throw new Error("Nao consegui obter seu email Google. Abra este projeto com a conta que enviara os avisos.");
  }
  var token = properties.getProperty("MONITOR_TOKEN");
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    properties.setProperty("MONITOR_TOKEN", token);
  }
  properties.setProperty("DESTINATARIO", email);
  Logger.log("DESTINATARIO: " + email);
  Logger.log("ALERT_WEBHOOK_TOKEN: " + token);
  Logger.log("Guarde o token no Cloudflare como Secret. Nao cole em chats ou arquivos publicos.");
  MailApp.sendEmail({
    to: email,
    subject: "[RF Monitor] Teste inicial do envio pelo Google",
    body: "O Google Apps Script esta autorizado a enviar alertas de queda e recuperacao.\n\nAgora publique este projeto como Aplicativo da Web e configure o endpoint no Cloudflare.",
    name: "Monitoramento RF"
  });
  Logger.log("E-mail de teste enviado para " + email);
}

function testarEnvio() {
  var to = PropertiesService.getScriptProperties().getProperty("DESTINATARIO");
  if (!to) throw new Error("Execute configurarAlertas primeiro.");
  MailApp.sendEmail({
    to: to,
    subject: "[RF Monitor] Teste de envio",
    body: "O envio de e-mail do Google Apps Script esta funcionando.",
    name: "Monitoramento RF"
  });
  Logger.log("Teste enviado para " + to);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var raw = e && e.postData && e.postData.contents || "";
    if (!raw || raw.length > 15000) return response_({ok:false, error:"INVALID_EVENT"});
    var req = JSON.parse(raw);
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty("MONITOR_TOKEN");
    if (!expected) return response_({ok:false, error:"NOT_CONFIGURED"});
    if (!req.token || !secureEquals_(String(req.token), expected)) {
      return response_({ok:false, error:"INVALID_TOKEN"});
    }

    var ev = req.event || {};
    var type = String(ev.tipo || "");
    var id = String(ev.id || "").slice(0, 80);
    var name = String(ev.nome || "").slice(0, 100);
    var when = String(ev.em || "").slice(0, 50);
    if ((type !== "queda" && type !== "recuperacao") || !id || !name ||
        !when || isNaN(Date.parse(when))) {
      return response_({ok:false, error:"INVALID_EVENT"});
    }
    var email = props.getProperty("DESTINATARIO");
    if (!email) return response_({ok:false, error:"NO_RECIPIENT"});

    lock.waitLock(15000);
    var key = "evento_" + digest_(id + "|" + type + "|" + when);
    if (props.getProperty(key)) {
      return response_({ok:true, duplicate:true});
    }
    var title = type === "queda" ? "API FORA DO AR" : "API RECUPERADA";
    var subject = "[RF Monitor] " + title + ": " + name;
    var url = String(ev.url || "").slice(0, 200);
    var reason = String(ev.detalhe || "").slice(0, 500);
    var localTime = Utilities.formatDate(new Date(when), "America/Sao_Paulo",
      "dd/MM/yyyy 'as' HH:mm:ss");
    var body = [
      title, "", "Cliente: " + name, "Data: " + localTime,
      "Endereco: " + url, "Detalhes: " + reason, "",
      "Painel: https://consultoriarf.net/monitoramento/"
    ].join("\n");
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      name: "Monitoramento RF"
    });
    props.setProperty(key, new Date().toISOString());
    return response_({ok:true, sent:true});
  } catch (error) {
    // Nao vazar o token nem enderecos em log ou resposta publica.
    console.error("Falha no envio pelo Google Apps Script: " +
      String(error && error.name || "Error"));
    return response_({ok:false, error:"FAILED"});
  } finally {
    try { if (lock.hasLock()) lock.releaseLock(); } catch (ignored) {}
  }
}

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function digest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    text, Utilities.Charset.UTF_8).map(function (b) {
      return ("0" + (b & 255).toString(16)).slice(-2);
    }).join("");
}

function secureEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
