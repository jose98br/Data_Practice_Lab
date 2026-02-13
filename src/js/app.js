import { exercises, topicLabels, levelLabels, difficultyRank } from "../data/exercises.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./app-config.js";

const STORAGE_KEY = "data_practice_completed_v1";
const REPORTED_STORAGE_KEY = "data_practice_reported_completed_v1";
const THEME_STORAGE_KEY = "data_practice_theme_v1";
const USER_NAME_KEY = "data_practice_user_name_v1";
const LOCAL_VISIT_FALLBACK_KEY = "data_practice_local_visits_v1";
const LOCAL_COMMUNITY_FALLBACK_KEY = "data_practice_local_community_exercises_v1";
const SUPABASE_REST_PATH = "/rest/v1";
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

const DEFAULT_THEME = "tokyo-night";
const THEME_MAP = {
  "tokyo-night": "ace/theme/tomorrow_night_eighties",
  dark: "ace/theme/monokai",
  light: "ace/theme/github",
  dracula: "ace/theme/dracula"
};

let pyodide;
let selectedTopic = null;
let currentExercise = null;
let hintIndex = 0;
let editor;
let fallbackEditor;
let userName = "";
let profileId = null;
let completedExercises = loadSet(STORAGE_KEY);
let reportedCompletedExercises = loadSet(REPORTED_STORAGE_KEY);

const ui = {
  topicFilters: document.getElementById("topicFilters"),
  exerciseList: document.getElementById("exerciseList"),
  exerciseTitle: document.getElementById("exerciseTitle"),
  exerciseDescription: document.getElementById("exerciseDescription"),
  exerciseLevel: document.getElementById("exerciseLevel"),
  exerciseTopic: document.getElementById("exerciseTopic"),
  runBtn: document.getElementById("runBtn"),
  checkBtn: document.getElementById("checkBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  themeSelect: document.getElementById("themeSelect"),
  hintBtn: document.getElementById("hintBtn"),
  visitCount: document.getElementById("visitCount"),
  communityExerciseCount: document.getElementById("communityExerciseCount"),
  leaderboardBody: document.getElementById("leaderboardBody"),
  docsPanel: document.getElementById("docsPanel"),
  docsTabs: document.getElementById("docsTabs"),
  docsViewer: document.getElementById("docsViewer"),
  runOutput: document.getElementById("runOutput"),
  checkOutput: document.getElementById("checkOutput"),
  hintOutput: document.getElementById("hintOutput"),
  userModal: document.getElementById("userModal"),
  userNameInput: document.getElementById("userNameInput"),
  saveUserBtn: document.getElementById("saveUserBtn")
};

function safeGetLocal(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function loadSet(key) {
  try {
    const raw = safeGetLocal(key, "[]");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistSet(key, dataSet) {
  safeSetLocal(key, JSON.stringify([...dataSet]));
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function initEditor() {
  if (typeof ace === "undefined") {
    const container = document.getElementById("codeEditor");
    if (!container) return;
    fallbackEditor = document.createElement("textarea");
    fallbackEditor.className = "fallback-editor";
    fallbackEditor.spellcheck = false;
    container.innerHTML = "";
    container.appendChild(fallbackEditor);
    return;
  }

  editor = ace.edit("codeEditor");
  editor.session.setMode("ace/mode/python");
  editor.setTheme(THEME_MAP[DEFAULT_THEME]);
  editor.setOptions({
    fontFamily: "IBM Plex Mono",
    fontSize: "13px",
    showPrintMargin: false,
    tabSize: 4,
    useSoftTabs: true,
    wrap: true,
    highlightActiveLine: true
  });
}

function editorGetValue() {
  if (editor) return editor.getValue();
  if (fallbackEditor) return fallbackEditor.value;
  return "";
}

function editorSetValue(code) {
  if (editor) {
    editor.setValue(code, -1);
    return;
  }
  if (fallbackEditor) {
    fallbackEditor.value = code;
  }
}

function applyTheme(themeName) {
  const theme = THEME_MAP[themeName] ? themeName : DEFAULT_THEME;
  document.body.dataset.theme = theme;
  if (editor) editor.setTheme(THEME_MAP[theme]);
  if (ui.themeSelect) ui.themeSelect.value = theme;
  safeSetLocal(THEME_STORAGE_KEY, theme);
}

function initThemeSelector() {
  const savedTheme = safeGetLocal(THEME_STORAGE_KEY, DEFAULT_THEME) || DEFAULT_THEME;
  applyTheme(savedTheme);

  if (!ui.themeSelect) return;
  ui.themeSelect.addEventListener("change", (event) => {
    applyTheme(event.target.value);
  });
}

function setCounterText(node, value) {
  if (!node) return;
  if (typeof value === "number" && Number.isFinite(value)) {
    node.textContent = value.toLocaleString("es-ES");
    return;
  }
  node.textContent = "-";
}

function renderLeaderboard(rows = []) {
  if (!ui.leaderboardBody) return;

  if (!rows.length) {
    ui.leaderboardBody.innerHTML = '<tr><td colspan="3">Sin datos todavía</td></tr>';
    return;
  }

  ui.leaderboardBody.innerHTML = rows
    .slice(0, 8)
    .map(
      (row, idx) =>
        `<tr><td>${idx + 1}</td><td>${row.name}</td><td>${row.score}</td></tr>`
    )
    .join("");
}

function localIncreaseCounter(key) {
  const next = (Number(safeGetLocal(key, "0")) || 0) + 1;
  safeSetLocal(key, String(next));
  return next;
}

function localGetCounter(key) {
  return Number(safeGetLocal(key, "0")) || 0;
}

function buildLocalLeaderboard() {
  if (!userName) return [];
  return [{ name: userName, score: completedExercises.size }];
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    ...extra
  };
}

function buildSupabaseUrl(tableOrView, params = {}) {
  const base = `${SUPABASE_URL}${SUPABASE_REST_PATH}/${tableOrView}`;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}?${qs}` : base;
}

function parseCountFromContentRange(contentRange) {
  if (!contentRange) return 0;
  const slashIndex = contentRange.lastIndexOf("/");
  if (slashIndex === -1) return 0;
  const total = Number(contentRange.slice(slashIndex + 1));
  return Number.isFinite(total) ? total : 0;
}

async function supabaseGetCount(tableName) {
  const url = buildSupabaseUrl(tableName, { select: "id" });
  const res = await fetch(url, {
    method: "HEAD",
    headers: supabaseHeaders({ Prefer: "count=exact" })
  });
  if (!res.ok) throw new Error(`SUPABASE_COUNT_${res.status}`);
  return parseCountFromContentRange(res.headers.get("content-range"));
}

async function supabaseGetLeaderboard() {
  const url = buildSupabaseUrl("leaderboard", {
    select: "name,score",
    order: "score.desc,name.asc",
    limit: "8"
  });
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`SUPABASE_LEADERBOARD_${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function ensureProfileId() {
  if (profileId) return profileId;
  if (!userName) return null;

  const getUrl = buildSupabaseUrl("profiles", {
    select: "id",
    name: `eq.${userName}`,
    limit: "1"
  });
  const getRes = await fetch(getUrl, { headers: supabaseHeaders() });
  if (!getRes.ok) throw new Error(`SUPABASE_PROFILE_GET_${getRes.status}`);
  const existing = await getRes.json();
  if (Array.isArray(existing) && existing[0]?.id) {
    profileId = existing[0].id;
    return profileId;
  }

  const createUrl = buildSupabaseUrl("profiles");
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify([{ name: userName }])
  });
  if (!createRes.ok) throw new Error(`SUPABASE_PROFILE_CREATE_${createRes.status}`);
  const created = await createRes.json();
  profileId = created?.[0]?.id || null;
  return profileId;
}

async function refreshCommunitySnapshot() {
  if (!SUPABASE_ENABLED) {
    setCounterText(ui.visitCount, localGetCounter(LOCAL_VISIT_FALLBACK_KEY));
    setCounterText(ui.communityExerciseCount, localGetCounter(LOCAL_COMMUNITY_FALLBACK_KEY));
    renderLeaderboard(buildLocalLeaderboard());
    return;
  }

  try {
    const [visitsCount, completionsCount, leaderboard] = await Promise.all([
      supabaseGetCount("visits"),
      supabaseGetCount("completions"),
      supabaseGetLeaderboard()
    ]);
    setCounterText(ui.visitCount, visitsCount);
    setCounterText(ui.communityExerciseCount, completionsCount);
    renderLeaderboard(leaderboard);
  } catch {
    setCounterText(ui.visitCount, localGetCounter(LOCAL_VISIT_FALLBACK_KEY));
    setCounterText(ui.communityExerciseCount, localGetCounter(LOCAL_COMMUNITY_FALLBACK_KEY));
    renderLeaderboard(buildLocalLeaderboard());
  }
}

async function registerVisit() {
  if (!SUPABASE_ENABLED) {
    setCounterText(ui.visitCount, localIncreaseCounter(LOCAL_VISIT_FALLBACK_KEY));
    return;
  }

  try {
    const pid = await ensureProfileId();
    const url = buildSupabaseUrl("visits");
    const res = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify([{ profile_id: pid }])
    });
    if (!res.ok) throw new Error(`SUPABASE_VISIT_${res.status}`);
    const visitsCount = await supabaseGetCount("visits");
    setCounterText(ui.visitCount, visitsCount);
  } catch {
    setCounterText(ui.visitCount, localIncreaseCounter(LOCAL_VISIT_FALLBACK_KEY));
  }
}

async function reportCommunityExerciseCompletion(exerciseId) {
  if (!userName || reportedCompletedExercises.has(exerciseId)) return;

  if (!SUPABASE_ENABLED) {
    const next = localIncreaseCounter(LOCAL_COMMUNITY_FALLBACK_KEY);
    setCounterText(ui.communityExerciseCount, next);
    renderLeaderboard(buildLocalLeaderboard());
    reportedCompletedExercises.add(exerciseId);
    persistSet(REPORTED_STORAGE_KEY, reportedCompletedExercises);
    return;
  }

  try {
    const pid = await ensureProfileId();
    if (!pid) throw new Error("NO_PROFILE");
    const url = buildSupabaseUrl("completions", { on_conflict: "profile_id,exercise_id" });
    const res = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates"
      }),
      body: JSON.stringify([{ profile_id: pid, exercise_id: exerciseId }])
    });
    if (!res.ok) throw new Error(`SUPABASE_COMPLETION_${res.status}`);

    const [completionsCount, leaderboard] = await Promise.all([
      supabaseGetCount("completions"),
      supabaseGetLeaderboard()
    ]);
    setCounterText(ui.communityExerciseCount, completionsCount);
    renderLeaderboard(leaderboard);
  } catch {
    const next = localIncreaseCounter(LOCAL_COMMUNITY_FALLBACK_KEY);
    setCounterText(ui.communityExerciseCount, next);
    renderLeaderboard(buildLocalLeaderboard());
  }

  reportedCompletedExercises.add(exerciseId);
  persistSet(REPORTED_STORAGE_KEY, reportedCompletedExercises);
}

function openUserModal() {
  if (!ui.userModal) return;
  ui.userModal.classList.remove("hidden");
}

function closeUserModal() {
  if (!ui.userModal) return;
  ui.userModal.classList.add("hidden");
}

function saveUserName() {
  const value = (ui.userNameInput?.value || "").trim();
  if (!value) return;

  userName = value;
  safeSetLocal(USER_NAME_KEY, userName);
  closeUserModal();
  registerVisit();
  refreshCommunitySnapshot();
}

function initUserFlow() {
  userName = safeGetLocal(USER_NAME_KEY, "").trim();
  refreshCommunitySnapshot();

  if (!userName) {
    openUserModal();
  } else {
    closeUserModal();
    registerVisit();
    refreshCommunitySnapshot();
  }

  ui.saveUserBtn?.addEventListener("click", saveUserName);
  ui.userNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveUserName();
  });
}

function uniqueTopics() {
  return [...new Set(exercises.map((exercise) => exercise.topic))];
}

function sortByDifficulty(list) {
  return [...list].sort((a, b) => {
    const levelDiff = (difficultyRank[a.level] || 999) - (difficultyRank[b.level] || 999);
    if (levelDiff !== 0) return levelDiff;
    return a.title.localeCompare(b.title, "es");
  });
}

function renderTopics() {
  ui.topicFilters.innerHTML = "";

  uniqueTopics().forEach((topic) => {
    const btn = document.createElement("button");
    const allDone = isTopicCompleted(topic);
    const checkClass = allDone ? "topic-check checked" : "topic-check";
    const checkMark = allDone ? "✓" : "";

    btn.className = `topic-btn ${topic === selectedTopic ? "active" : ""} ${allDone ? "done" : ""}`;
    btn.innerHTML = `<span>${topicLabels[topic] || topic}</span><span class="${checkClass}">${checkMark}</span>`;
    btn.onclick = () => {
      selectedTopic = topic;
      renderTopics();
      renderExercises();
      selectFirstExerciseForTopic();
    };
    ui.topicFilters.appendChild(btn);
  });
}

function isTopicCompleted(topic) {
  const byTopic = exercises.filter((exercise) => exercise.topic === topic);
  if (!byTopic.length) return false;
  return byTopic.every((exercise) => completedExercises.has(exercise.id));
}

function filteredExercises() {
  const exercisesByTopic = exercises.filter((exercise) => exercise.topic === selectedTopic);
  return sortByDifficulty(exercisesByTopic);
}

function renderExercises() {
  const data = filteredExercises();
  ui.exerciseList.innerHTML = "";

  if (!data.length) {
    ui.exerciseList.innerHTML = "<p>No hay ejercicios en este tema.</p>";
    return;
  }

  data.forEach((exercise) => {
    const row = document.createElement("div");
    const toggle = document.createElement("button");
    const btn = document.createElement("button");
    const isDone = completedExercises.has(exercise.id);

    row.className = `exercise-row ${currentExercise?.id === exercise.id ? "active" : ""}`;

    toggle.type = "button";
    toggle.className = `exercise-check ${isDone ? "checked" : ""}`;
    toggle.textContent = isDone ? "✓" : "";
    toggle.onclick = (event) => {
      event.stopPropagation();
      markExerciseDone(exercise.id, !isDone);
    };

    btn.className = `exercise-btn ${currentExercise?.id === exercise.id ? "active" : ""} ${isDone ? "done" : ""}`;
    btn.innerHTML = `${exercise.title}<small>${topicLabels[exercise.topic]}</small><small><span class="level-pill level-${exercise.level}">${levelLabels[exercise.level] || exercise.level}</span></small>`;
    btn.onclick = () => selectExercise(exercise.id);

    row.appendChild(toggle);
    row.appendChild(btn);
    ui.exerciseList.appendChild(row);
  });
}

function selectFirstExerciseForTopic() {
  const data = filteredExercises();
  if (!data.length) return;
  selectExercise(data[0].id);
}

function selectExercise(id) {
  const exercise = exercises.find((item) => item.id === id);
  if (!exercise) return;

  currentExercise = exercise;
  hintIndex = 0;

  ui.exerciseTitle.textContent = exercise.title;
  ui.exerciseDescription.textContent = exercise.description;
  ui.exerciseLevel.textContent = `Nivel: ${levelLabels[exercise.level] || exercise.level}`;
  ui.exerciseTopic.textContent = `Tema: ${topicLabels[exercise.topic] || exercise.topic}`;
  editorSetValue(exercise.starterCode);
  renderExerciseDocuments(exercise);

  ui.hintOutput.textContent = 'Pulsa "Mostrar pista" si te atascas.';
  ui.runOutput.textContent = "Aqui veras la salida de tu codigo.";
  ui.checkOutput.textContent = "Aqui veras si tu solucion pasa los tests.";

  renderExercises();
  enableWorkspaceActions();
}

function formatDocumentContent(resource) {
  if (!resource) return "";
  if (resource.type === "json") {
    try {
      return JSON.stringify(JSON.parse(resource.content), null, 2);
    } catch {
      return resource.content;
    }
  }
  return resource.content;
}

function renderExerciseDocuments(exercise) {
  const resources = exercise.resources || [];
  if (!resources.length) {
    ui.docsPanel.classList.add("hidden");
    ui.docsTabs.innerHTML = "";
    ui.docsViewer.textContent = "Este ejercicio no tiene archivos de apoyo.";
    return;
  }

  ui.docsPanel.classList.remove("hidden");
  ui.docsTabs.innerHTML = "";

  const setActiveResource = (resource, activeBtn) => {
    ui.docsViewer.textContent = formatDocumentContent(resource);
    [...ui.docsTabs.querySelectorAll(".doc-tab")].forEach((btn) => btn.classList.remove("active"));
    activeBtn.classList.add("active");
  };

  resources.forEach((resource, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `doc-tab ${index === 0 ? "active" : ""}`;
    tab.textContent = resource.name || `documento_${index + 1}`;
    tab.onclick = () => setActiveResource(resource, tab);
    ui.docsTabs.appendChild(tab);
  });

  ui.docsViewer.textContent = formatDocumentContent(resources[0]);
}

function enableWorkspaceActions() {
  const canRun = Boolean(currentExercise && pyodide);
  const hasExercise = Boolean(currentExercise);

  ui.runBtn.disabled = !canRun;
  ui.checkBtn.disabled = !canRun;
  ui.downloadBtn.disabled = !hasExercise;
  ui.hintBtn.disabled = !hasExercise;
}

function indentBlock(code, level) {
  const spaces = "    ".repeat(level);
  return code
    .split("\n")
    .map((line) => `${spaces}${line}`)
    .join("\n");
}

function extractExceptionType(detail) {
  const match = detail.match(/([A-Za-z_]*Error)\b/);
  return match ? match[1] : "Error";
}

function extractRelevantTechnicalLine(detail) {
  const lines = detail
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const direct = lines.find((line) =>
    /(AssertionError|SyntaxError|IndentationError|NameError|TypeError|ValueError|KeyError|IndexError|AttributeError|ZeroDivisionError)/.test(
      line
    )
  );
  if (direct) return direct;

  const last = lines[lines.length - 1];
  return last || "Sin detalle tecnico adicional.";
}

function buildSpanishErrorGuide(errorType) {
  const guides = {
    AssertionError:
      "Tu codigo se ejecuta, pero el resultado no coincide con lo esperado en este ejercicio.",
    SyntaxError:
      "Hay un error de sintaxis. Revisa parentesis, dos puntos, comas y comillas.",
    IndentationError:
      "Hay un problema de indentacion. Revisa los bloques despues de `if`, `for`, `while`, `def` o `try`.",
    TabError:
      "Hay mezcla de tabs y espacios en la indentacion. Usa un unico estilo de indentacion.",
    NameError:
      "Se esta usando un nombre que no existe. Revisa variables o funciones no definidas.",
    TypeError:
      "Hay una operacion con tipos incompatibles. Revisa que los datos sean del tipo correcto.",
    ValueError:
      "Se esta usando un valor invalido para alguna operacion.",
    KeyError:
      "Se intento acceder a una clave que no existe en un diccionario o DataFrame.",
    IndexError:
      "Se intento acceder a una posicion que no existe (lista, array o DataFrame).",
    AttributeError:
      "Se intento usar un atributo o metodo que no existe para ese objeto.",
    ZeroDivisionError:
      "Se esta dividiendo entre cero en algun punto del ejercicio."
  };
  return guides[errorType] || "Hay un error en la solucion. Revisa el codigo y vuelve a validar.";
}

function formatValidationFeedback(errorDetail, failHelp) {
  const errorType = extractExceptionType(errorDetail);
  const guide = buildSpanishErrorGuide(errorType);
  const technicalLine = extractRelevantTechnicalLine(errorDetail);

  return [
    "Todavia no pasa los tests.",
    "",
    `Que esta fallando: ${guide}`,
    `Que debes corregir: ${failHelp}`,
    "",
    `Detalle tecnico: ${technicalLine}`
  ].join("\n");
}

async function runUserCode() {
  if (!currentExercise || !pyodide) return;

  const code = editorGetValue();
  ui.runOutput.textContent = "Ejecutando...";

  const wrapped = `
import io
import contextlib
_buffer = io.StringIO()
with contextlib.redirect_stdout(_buffer):
${indentBlock(code, 1)}
_result_stdout = _buffer.getvalue()
_result_stdout
`;

  try {
    const stdout = await pyodide.runPythonAsync(wrapped);
    ui.runOutput.textContent = stdout || "(Sin salida por consola)";
  } catch (err) {
    ui.runOutput.textContent = `Error al ejecutar:\n${String(err)}`;
  }
}

function markExerciseDone(exerciseId, done) {
  if (done) {
    completedExercises.add(exerciseId);
    reportCommunityExerciseCompletion(exerciseId);
  } else {
    completedExercises.delete(exerciseId);
  }

  persistSet(STORAGE_KEY, completedExercises);
  renderTopics();
  renderExercises();
}

function markCurrentExerciseDone(done) {
  if (!currentExercise) return;
  markExerciseDone(currentExercise.id, done);
}

async function checkUserCode() {
  if (!currentExercise || !pyodide) return;

  const code = editorGetValue();
  ui.checkOutput.textContent = "Validando...";

  const wrapped = `
${code}
${currentExercise.testCode}
"OK"
`;

  try {
    await pyodide.runPythonAsync(wrapped);
    ui.checkOutput.textContent = "Correcto: tu solucion pasa los tests de este ejercicio.";
    markCurrentExerciseDone(true);
  } catch (err) {
    ui.checkOutput.textContent = formatValidationFeedback(String(err), currentExercise.failHelp);
  }
}

function downloadCurrentExerciseCode() {
  if (!currentExercise) return;

  const content = editorGetValue();
  const filename = `${currentExercise.id}.py`;
  downloadTextFile(filename, content);
}

function showHint() {
  if (!currentExercise) return;

  if (hintIndex >= currentExercise.hints.length) {
    ui.hintOutput.textContent = "Ya mostraste todas las pistas de este ejercicio.";
    return;
  }

  ui.hintOutput.textContent = `Pista ${hintIndex + 1}: ${currentExercise.hints[hintIndex]}`;
  hintIndex += 1;
}

async function initPyodideRuntime() {
  try {
    pyodide = await loadPyodide();
    await pyodide.loadPackage(["numpy", "pandas"]);
    enableWorkspaceActions();
  } catch (err) {
    ui.runOutput.textContent = `Error de runtime:\n${String(err)}`;
    ui.checkOutput.textContent =
      "No se puede validar hasta que el runtime Python este disponible.";
  }
}

ui.runBtn.addEventListener("click", runUserCode);
ui.checkBtn.addEventListener("click", checkUserCode);
ui.downloadBtn.addEventListener("click", downloadCurrentExerciseCode);
ui.hintBtn.addEventListener("click", showHint);

try {
  initEditor();
} catch (err) {
  console.error("Error iniciando editor:", err);
}

try {
  initThemeSelector();
} catch (err) {
  console.error("Error iniciando selector de temas:", err);
}

initUserFlow();
selectedTopic = uniqueTopics()[0];
renderTopics();
renderExercises();
selectFirstExerciseForTopic();
initPyodideRuntime();
