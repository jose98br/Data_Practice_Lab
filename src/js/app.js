import { exercises, topicLabels, levelLabels, difficultyRank } from "../data/exercises.js";

const STORAGE_KEY = "data_practice_completed_v1";
const REPORTED_STORAGE_KEY = "data_practice_reported_completed_v1";
const THEME_STORAGE_KEY = "data_practice_theme_v1";
const LOCAL_VISIT_FALLBACK_KEY = "data_practice_local_visits_v1";
const LOCAL_COMMUNITY_FALLBACK_KEY = "data_practice_local_community_exercises_v1";
const DEFAULT_THEME = "tokyo-night";
const COUNTER_NAMESPACE = "jose98br_data_practice_lab";
const VISITS_COUNTER_KEY = "visits";
const EXERCISES_COUNTER_KEY = "community_exercises";
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
let completedExercises = loadCompletedExercises();
let reportedCompletedExercises = loadReportedCompletedExercises();

const ui = {
  topicFilters: document.getElementById("topicFilters"),
  exerciseList: document.getElementById("exerciseList"),
  exerciseTitle: document.getElementById("exerciseTitle"),
  exerciseDescription: document.getElementById("exerciseDescription"),
  exerciseLevel: document.getElementById("exerciseLevel"),
  exerciseTopic: document.getElementById("exerciseTopic"),
  runBtn: document.getElementById("runBtn"),
  checkBtn: document.getElementById("checkBtn"),
  solveBtn: document.getElementById("solveBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  themeSelect: document.getElementById("themeSelect"),
  hintBtn: document.getElementById("hintBtn"),
  visitCount: document.getElementById("visitCount"),
  communityExerciseCount: document.getElementById("communityExerciseCount"),
  docsPanel: document.getElementById("docsPanel"),
  docsTabs: document.getElementById("docsTabs"),
  docsViewer: document.getElementById("docsViewer"),
  runOutput: document.getElementById("runOutput"),
  checkOutput: document.getElementById("checkOutput"),
  hintOutput: document.getElementById("hintOutput")
};

function loadCompletedExercises() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistCompletedExercises() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedExercises]));
}

function loadReportedCompletedExercises() {
  try {
    const raw = localStorage.getItem(REPORTED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistReportedCompletedExercises() {
  localStorage.setItem(REPORTED_STORAGE_KEY, JSON.stringify([...reportedCompletedExercises]));
}

function setCounterText(node, value) {
  if (!node) return;
  if (typeof value === "number" && Number.isFinite(value)) {
    node.textContent = value.toLocaleString("es-ES");
    return;
  }
  node.textContent = "-";
}

async function countApiHit(key) {
  const response = await fetch(`https://api.countapi.xyz/hit/${COUNTER_NAMESPACE}/${key}`);
  if (!response.ok) throw new Error(`Counter API error: ${response.status}`);
  return response.json();
}

async function countApiGet(key) {
  const response = await fetch(`https://api.countapi.xyz/get/${COUNTER_NAMESPACE}/${key}`);
  if (!response.ok) throw new Error(`Counter API error: ${response.status}`);
  return response.json();
}

function increaseLocalFallback(key) {
  const current = Number(localStorage.getItem(key) || 0) || 0;
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return next;
}

function getLocalFallback(key) {
  return Number(localStorage.getItem(key) || 0) || 0;
}

async function initCommunityCounters() {
  try {
    const visitData = await countApiHit(VISITS_COUNTER_KEY);
    setCounterText(ui.visitCount, visitData.value);
  } catch {
    setCounterText(ui.visitCount, increaseLocalFallback(LOCAL_VISIT_FALLBACK_KEY));
  }

  try {
    const exerciseData = await countApiGet(EXERCISES_COUNTER_KEY);
    setCounterText(ui.communityExerciseCount, exerciseData.value || 0);
  } catch {
    setCounterText(ui.communityExerciseCount, getLocalFallback(LOCAL_COMMUNITY_FALLBACK_KEY));
  }
}

async function reportCommunityExerciseCompletion(exerciseId) {
  if (reportedCompletedExercises.has(exerciseId)) return;
  try {
    const result = await countApiHit(EXERCISES_COUNTER_KEY);
    setCounterText(ui.communityExerciseCount, result.value);
    reportedCompletedExercises.add(exerciseId);
    persistReportedCompletedExercises();
  } catch {
    const next = increaseLocalFallback(LOCAL_COMMUNITY_FALLBACK_KEY);
    setCounterText(ui.communityExerciseCount, next);
    reportedCompletedExercises.add(exerciseId);
    persistReportedCompletedExercises();
  }
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
  return editor ? editor.getValue() : "";
}

function editorSetValue(code) {
  if (!editor) return;
  editor.setValue(code, -1);
}

function applyTheme(themeName) {
  const theme = THEME_MAP[themeName] ? themeName : DEFAULT_THEME;
  document.body.dataset.theme = theme;
  if (editor) {
    editor.setTheme(THEME_MAP[theme]);
  }
  if (ui.themeSelect) {
    ui.themeSelect.value = theme;
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function initThemeSelector() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
  applyTheme(savedTheme);

  if (!ui.themeSelect) return;
  ui.themeSelect.addEventListener("change", (event) => {
    applyTheme(event.target.value);
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
  ui.solveBtn.disabled = !hasExercise;
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

  persistCompletedExercises();
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

function solveExercise() {
  if (!currentExercise) return;

  editorSetValue(currentExercise.solutionCode);
  ui.checkOutput.textContent = 'Se cargo una solucion de referencia. Pulsa "Validar solucion" para comprobarla.';
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
ui.solveBtn.addEventListener("click", solveExercise);
ui.downloadBtn.addEventListener("click", downloadCurrentExerciseCode);
ui.hintBtn.addEventListener("click", showHint);

initEditor();
initThemeSelector();
initCommunityCounters();
selectedTopic = uniqueTopics()[0];
renderTopics();
renderExercises();
selectFirstExerciseForTopic();
initPyodideRuntime();
