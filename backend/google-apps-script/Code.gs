/**
 * Data Practice Lab - Backend gratuito con Google Apps Script + Google Sheets.
 *
 * REQUISITOS EN EL SHEET:
 * - Hoja 'visits' con columnas: timestamp, user
 * - Hoja 'completions' con columnas: timestamp, user, exerciseId
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "snapshot";

  if (action === "snapshot") {
    return jsonResponse(snapshot_());
  }

  return jsonResponse({ ok: false, error: "action_no_valida" });
}

function doPost(e) {
  var payload = {};
  try {
    payload = JSON.parse(e.postData.contents || "{}");
  } catch (_) {
    return jsonResponse({ ok: false, error: "json_invalido" });
  }

  var action = payload.action;
  if (action === "visit") {
    return jsonResponse(registerVisit_(payload.user || "anonimo"));
  }

  if (action === "exercise") {
    return jsonResponse(registerExercise_(payload.user || "anonimo", payload.exerciseId || ""));
  }

  return jsonResponse({ ok: false, error: "action_no_valida" });
}

function registerVisit_(user) {
  var visitsSheet = getOrCreateSheet_("visits", ["timestamp", "user"]);
  visitsSheet.appendRow([new Date(), user]);

  var snap = snapshot_();
  return {
    ok: true,
    visits: snap.visits,
    completedTotal: snap.completedTotal,
    leaderboard: snap.leaderboard
  };
}

function registerExercise_(user, exerciseId) {
  if (!exerciseId) return { ok: false, error: "exerciseId_requerido" };

  var completions = getOrCreateSheet_("completions", ["timestamp", "user", "exerciseId"]);
  var rows = completions.getDataRange().getValues();

  var exists = false;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(user) && String(rows[i][2]) === String(exerciseId)) {
      exists = true;
      break;
    }
  }

  if (!exists) {
    completions.appendRow([new Date(), user, exerciseId]);
  }

  var snap = snapshot_();
  return {
    ok: true,
    duplicated: exists,
    visits: snap.visits,
    completedTotal: snap.completedTotal,
    leaderboard: snap.leaderboard
  };
}

function snapshot_() {
  var visitsSheet = getOrCreateSheet_("visits", ["timestamp", "user"]);
  var completions = getOrCreateSheet_("completions", ["timestamp", "user", "exerciseId"]);

  var visitRows = visitsSheet.getLastRow();
  var completionRows = completions.getDataRange().getValues();

  var scoreByUser = {};
  for (var i = 1; i < completionRows.length; i++) {
    var user = String(completionRows[i][1] || "anonimo");
    scoreByUser[user] = (scoreByUser[user] || 0) + 1;
  }

  var leaderboard = Object.keys(scoreByUser)
    .map(function (userName) {
      return { name: userName, score: scoreByUser[userName] };
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, 20);

  return {
    ok: true,
    visits: Math.max(0, visitRows - 1),
    completedTotal: Math.max(0, completionRows.length - 1),
    leaderboard: leaderboard
  };
}

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
