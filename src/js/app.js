import { exercises, topicLabels, levelLabels, difficultyRank } from "../data/exercises.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./app-config.js";

const COMPLETED_STORAGE_KEY_PREFIX = "data_practice_completed_v2";
const REPORTED_STORAGE_KEY_PREFIX = "data_practice_reported_completed_v2";
const THEME_STORAGE_KEY = "data_practice_theme_v1";
const USER_NAME_KEY = "data_practice_user_name_v1";
const CLASSIFICATION_MODE_KEY = "data_practice_classification_mode_v1";
const LOCAL_VISIT_FALLBACK_KEY = "data_practice_local_visits_v1";
const LOCAL_COMMUNITY_FALLBACK_KEY = "data_practice_local_community_exercises_v1";
const LEVEL_PROGRESS_KEY_PREFIX = "data_practice_level_progress_v1";
const SUPABASE_REST_PATH = "/rest/v1";
const SUPABASE_AUTH_PATH = "/auth/v1";
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const MAX_LEVEL = 100;
const LINE_EXP = 3;
const EXERCISE_BONUS_EXP = {
  basico: 28,
  intermedio: 52,
  avanzado: 88
};

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
let editorExpScanTimer;
let userName = "";
let classificationEnabled = false;
let profileId = null;
let exerciseProgressScope = "";
let completedExercises = new Set();
let reportedCompletedExercises = new Set();
let currentExerciseBaselineLines = new Set();
let levelProgressScope = "";
let levelProgress = createDefaultLevelProgress();
let levelToastTimer;
let pendingExpDelta = 0;
let expFlushTimer;

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
  currentRankText: document.getElementById("currentRankText"),
  levelUserName: document.getElementById("levelUserName"),
  levelNumber: document.getElementById("levelNumber"),
  levelExpText: document.getElementById("levelExpText"),
  levelBarFill: document.getElementById("levelBarFill"),
  levelToast: document.getElementById("levelToast"),
  leaderboardModalBody: document.getElementById("leaderboardModalBody"),
  openSessionBtn: document.getElementById("openSessionBtn"),
  sessionStateText: document.getElementById("sessionStateText"),
  expandLeaderboardBtn: document.getElementById("expandLeaderboardBtn"),
  leaderboardModal: document.getElementById("leaderboardModal"),
  closeLeaderboardModalBtn: document.getElementById("closeLeaderboardModalBtn"),
  sessionModal: document.getElementById("sessionModal"),
  closeSessionModalBtn: document.getElementById("closeSessionModalBtn"),
  docsPanel: document.getElementById("docsPanel"),
  docsTabs: document.getElementById("docsTabs"),
  docsViewer: document.getElementById("docsViewer"),
  runOutput: document.getElementById("runOutput"),
  checkOutput: document.getElementById("checkOutput"),
  hintOutput: document.getElementById("hintOutput"),
  userNameInput: document.getElementById("userNameInput"),
  userPasswordInput: document.getElementById("userPasswordInput"),
  registerUserBtn: document.getElementById("registerUserBtn"),
  loginUserBtn: document.getElementById("loginUserBtn"),
  logoutUserBtn: document.getElementById("logoutUserBtn"),
  authUserText: document.getElementById("authUserText"),
  authStatusText: document.getElementById("authStatusText")
};

function createDefaultLevelProgress() {
  return {
    exp: 0,
    level: 1,
    awarded_lines: {},
    exercise_bonus_awarded: []
  };
}

function levelExpRequired(level) {
  return 120 + (level - 1) * 30;
}

function totalExpFromProgress(progress) {
  const p = sanitizeLevelProgress(progress);
  let total = p.exp;
  for (let lvl = 1; lvl < p.level; lvl += 1) {
    total += levelExpRequired(lvl);
  }
  return total;
}

function normalizeUserScope(rawName) {
  return (rawName || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getLevelProgressScope() {
  if (classificationEnabled && userName) {
    const normalized = normalizeUserScope(userName);
    if (normalized) return `user_${normalized}`;
  }
  return "anon";
}

function getExerciseProgressScope() {
  if (classificationEnabled && userName) {
    const normalized = normalizeUserScope(userName);
    if (normalized) return `user_${normalized}`;
  }
  return "anon";
}

function getLevelProgressStorageKey(scope) {
  return `${LEVEL_PROGRESS_KEY_PREFIX}_${scope}`;
}

function getCompletedStorageKey(scope) {
  return `${COMPLETED_STORAGE_KEY_PREFIX}_${scope}`;
}

function getReportedStorageKey(scope) {
  return `${REPORTED_STORAGE_KEY_PREFIX}_${scope}`;
}

function sanitizeLevelProgress(raw) {
  if (!raw || typeof raw !== "object") return createDefaultLevelProgress();
  const exp = Math.max(0, Number(raw.exp) || 0);
  const level = Math.min(MAX_LEVEL, Math.max(1, Number(raw.level) || 1));
  const awardedLines = raw.awarded_lines && typeof raw.awarded_lines === "object" ? raw.awarded_lines : {};
  const exerciseBonusAwarded = Array.isArray(raw.exercise_bonus_awarded)
    ? raw.exercise_bonus_awarded.filter((id) => typeof id === "string")
    : [];
  return {
    exp,
    level,
    awarded_lines: awardedLines,
    exercise_bonus_awarded: exerciseBonusAwarded
  };
}

function loadLevelProgressForScope(scope) {
  const key = getLevelProgressStorageKey(scope);
  try {
    const raw = safeGetLocal(key, "");
    if (!raw) return createDefaultLevelProgress();
    return sanitizeLevelProgress(JSON.parse(raw));
  } catch {
    return createDefaultLevelProgress();
  }
}

function persistLevelProgress() {
  const key = getLevelProgressStorageKey(levelProgressScope || "anon");
  safeSetLocal(key, JSON.stringify(levelProgress));
}

function persistCompletedExercises() {
  const key = getCompletedStorageKey(exerciseProgressScope || "anon");
  persistSet(key, completedExercises);
}

function persistReportedExercises() {
  const key = getReportedStorageKey(exerciseProgressScope || "anon");
  persistSet(key, reportedCompletedExercises);
}

function syncExerciseProgressScope(options = {}) {
  const clearAnon = Boolean(options.clearAnon);
  if (clearAnon) {
    persistSet(getCompletedStorageKey("anon"), new Set());
    persistSet(getReportedStorageKey("anon"), new Set());
  }

  const nextScope = getExerciseProgressScope();
  if (!clearAnon && nextScope === exerciseProgressScope) return;
  exerciseProgressScope = nextScope;
  completedExercises = loadSet(getCompletedStorageKey(nextScope));
  reportedCompletedExercises = loadSet(getReportedStorageKey(nextScope));

  if (selectedTopic) {
    renderTopics();
    renderExercises();
  }
}

function syncLevelProgressScope(force = false) {
  const nextScope = getLevelProgressScope();
  if (!force && nextScope === levelProgressScope) return;
  levelProgressScope = nextScope;
  levelProgress = loadLevelProgressForScope(nextScope);
  renderLevelCard();
  captureCurrentExerciseBaseline();
}

function showFallbackToast(message) {
  if (!ui.levelToast) return;
  ui.levelToast.textContent = message;
  ui.levelToast.classList.remove("hidden");
  clearTimeout(levelToastTimer);
  levelToastTimer = setTimeout(() => {
    ui.levelToast?.classList.add("hidden");
  }, 2600);
}

function dispatchToastEvent(detail) {
  try {
    if (typeof window.__dplabSileoNotify === "function") {
      return Boolean(window.__dplabSileoNotify(detail));
    }
    if (!window.__dplabSileoReady) return false;
    window.dispatchEvent(new CustomEvent("dplab:notify", { detail }));
    return true;
  } catch {
    return false;
  }
}

function showAppToast({ title, description = "", type = "info" }) {
  const sentToSileo = dispatchToastEvent({ title, description, type });
  if (sentToSileo) return;
  const text = description ? `${title}: ${description}` : title;
  showFallbackToast(text);
}

function showLevelToast(message) {
  showAppToast({
    title: "Subida de nivel",
    description: message,
    type: "success"
  });
}

function renderLevelCard() {
  const level = Math.min(MAX_LEVEL, levelProgress.level || 1);
  const exp = Math.max(0, levelProgress.exp || 0);
  const required = levelExpRequired(level);
  const displayName = classificationEnabled && userName ? userName : "Invitado";
  const progressRatio = level >= MAX_LEVEL ? 1 : Math.min(1, exp / required);

  if (ui.levelUserName) ui.levelUserName.textContent = displayName;
  if (ui.levelNumber) ui.levelNumber.textContent = `Nivel ${level}`;
  if (ui.levelExpText) {
    ui.levelExpText.textContent =
      level >= MAX_LEVEL ? `MAX (${MAX_LEVEL})` : `${exp.toLocaleString("es-ES")} / ${required.toLocaleString("es-ES")} EXP`;
  }
  if (ui.levelBarFill) ui.levelBarFill.style.width = `${Math.round(progressRatio * 100)}%`;
}

function addExp(amount) {
  const expToAdd = Math.max(0, Math.floor(amount));
  if (!expToAdd || levelProgress.level >= MAX_LEVEL) return;
  const totalBefore = totalExpFromProgress(levelProgress);

  levelProgress.exp += expToAdd;
  let leveledUp = false;

  while (levelProgress.level < MAX_LEVEL) {
    const needed = levelExpRequired(levelProgress.level);
    if (levelProgress.exp < needed) break;
    levelProgress.exp -= needed;
    levelProgress.level += 1;
    leveledUp = true;
  }

  if (levelProgress.level >= MAX_LEVEL) {
    levelProgress.level = MAX_LEVEL;
    levelProgress.exp = 0;
  }

  persistLevelProgress();
  renderLevelCard();
  const totalAfter = totalExpFromProgress(levelProgress);
  queueServerExpSync(totalAfter - totalBefore);

  if (leveledUp) {
    showLevelToast(`Subiste de nivel. Ahora eres nivel ${levelProgress.level}.`);
  }
}

function normalizeCodeLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function isMeaningfulLine(normalizedLine) {
  if (!normalizedLine) return false;
  if (normalizedLine.startsWith("#")) return false;
  if (normalizedLine === "pass") return false;
  if (!/[a-zA-Z0-9_]/.test(normalizedLine)) return false;
  return true;
}

function collectMeaningfulLineFingerprints(code) {
  return new Set(
    String(code || "")
      .split("\n")
      .map((line) => normalizeCodeLine(line))
      .filter((line) => isMeaningfulLine(line))
  );
}

function captureCurrentExerciseBaseline() {
  if (!currentExercise) {
    currentExerciseBaselineLines = new Set();
    return;
  }
  currentExerciseBaselineLines = collectMeaningfulLineFingerprints(editorGetValue());
}

function ensureAwardedLinesBucket(exerciseId) {
  if (!levelProgress.awarded_lines[exerciseId]) {
    levelProgress.awarded_lines[exerciseId] = [];
  }
  return levelProgress.awarded_lines[exerciseId];
}

function awardLineExpFromEditor() {
  if (!currentExercise || levelProgress.level >= MAX_LEVEL) return;

  const code = editorGetValue();
  const currentLines = collectMeaningfulLineFingerprints(code);
  const awarded = new Set(ensureAwardedLinesBucket(currentExercise.id));
  let gained = 0;

  currentLines.forEach((line) => {
    if (currentExerciseBaselineLines.has(line)) return;
    if (awarded.has(line)) return;
    awarded.add(line);
    gained += LINE_EXP;
  });

  if (!gained) return;
  levelProgress.awarded_lines[currentExercise.id] = [...awarded];
  addExp(gained);
}

function scheduleLineExpScan() {
  clearTimeout(editorExpScanTimer);
  editorExpScanTimer = setTimeout(() => {
    awardLineExpFromEditor();
  }, 220);
}

function awardExerciseCompletionExp(exercise) {
  if (!exercise) return;
  const awarded = new Set(levelProgress.exercise_bonus_awarded || []);
  if (awarded.has(exercise.id)) return;
  awarded.add(exercise.id);
  levelProgress.exercise_bonus_awarded = [...awarded];
  const bonus = EXERCISE_BONUS_EXP[exercise.level] || EXERCISE_BONUS_EXP.basico;
  addExp(bonus);
}

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
    fallbackEditor.addEventListener("input", scheduleLineExpScan);
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
  editor.session.on("change", scheduleLineExpScan);
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
  const previousTheme = document.body.dataset.theme || "";
  document.body.dataset.theme = theme;
  if (editor) editor.setTheme(THEME_MAP[theme]);
  if (ui.themeSelect) ui.themeSelect.value = theme;
  safeSetLocal(THEME_STORAGE_KEY, theme);
  return previousTheme !== theme;
}

function initThemeSelector() {
  const savedTheme = safeGetLocal(THEME_STORAGE_KEY, DEFAULT_THEME) || DEFAULT_THEME;
  applyTheme(savedTheme);

  if (!ui.themeSelect) return;
  ui.themeSelect.addEventListener("change", (event) => {
    const changed = applyTheme(event.target.value);
    if (changed) {
      showAppToast({
        title: "Tema actualizado",
        description: `Has cambiado a ${ui.themeSelect.options[ui.themeSelect.selectedIndex]?.text || event.target.value}.`,
        type: "info"
      });
    }
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

function renderLeaderboardTable(target, rows = []) {
  if (!target) return;

  if (!rows.length) {
    target.innerHTML = '<tr><td colspan="3">Sin datos todavía</td></tr>';
    return;
  }

  target.innerHTML = rows
    .map(
      (row, idx) =>
        `<tr><td>${idx + 1}</td><td>${row.name}</td><td>${row.score}</td></tr>`
    )
    .join("");
}

function renderLeaderboards(rows = []) {
  renderLeaderboardTable(ui.leaderboardModalBody, rows.slice(0, 100));
  updateCurrentRank(rows);
}

function updateCurrentRank(rows = []) {
  if (!ui.currentRankText) return;
  if (!(classificationEnabled && userName)) {
    ui.currentRankText.textContent = "#-";
    return;
  }
  const rankIndex = rows.findIndex((row) => row?.name === userName);
  ui.currentRankText.textContent = rankIndex >= 0 ? `#${rankIndex + 1}` : "#-";
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
  return [{ name: userName, score: totalExpFromProgress(levelProgress) }];
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    ...extra
  };
}

function supabaseAuthHeaders(extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    ...extra
  };
}

function buildSupabaseUrl(tableOrView, params = {}) {
  const base = `${SUPABASE_URL}${SUPABASE_REST_PATH}/${tableOrView}`;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}?${qs}` : base;
}

function buildSupabaseAuthUrl(pathWithQuery) {
  return `${SUPABASE_URL}${SUPABASE_AUTH_PATH}/${pathWithQuery}`;
}

async function supabaseCallRpc(rpcName, payload) {
  const url = `${SUPABASE_URL}${SUPABASE_REST_PATH}/rpc/${rpcName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) throw new Error(`SUPABASE_RPC_${rpcName}_${res.status}`);
}

function buildPseudoEmail(fullName) {
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${normalized || "usuario"}.dplab@local.app`;
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

async function supabaseGetLeaderboard(limit = 8) {
  const url = buildSupabaseUrl("leaderboard", {
    select: "name,score",
    order: "score.desc,name.asc",
    limit: String(limit)
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
    renderLeaderboards(buildLocalLeaderboard());
    return;
  }

  try {
    const [visitsCount, completionsCount, leaderboard] = await Promise.all([
      supabaseGetCount("visits"),
      supabaseGetCount("completion_events"),
      supabaseGetLeaderboard(100)
    ]);
    setCounterText(ui.visitCount, visitsCount);
    setCounterText(ui.communityExerciseCount, completionsCount);
    renderLeaderboards(leaderboard);
  } catch {
    setCounterText(ui.visitCount, localGetCounter(LOCAL_VISIT_FALLBACK_KEY));
    setCounterText(ui.communityExerciseCount, localGetCounter(LOCAL_COMMUNITY_FALLBACK_KEY));
    renderLeaderboards(buildLocalLeaderboard());
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

async function reportCommunityExerciseCompletion(exerciseId, options = {}) {
  const forceSync = Boolean(options.forceSync);
  const alreadyCommunityReported = reportedCompletedExercises.has(exerciseId);
  if (!forceSync && alreadyCommunityReported) return;

  if (!SUPABASE_ENABLED) {
    const next = localIncreaseCounter(LOCAL_COMMUNITY_FALLBACK_KEY);
    setCounterText(ui.communityExerciseCount, next);
    renderLeaderboards(buildLocalLeaderboard());
    reportedCompletedExercises.add(exerciseId);
    persistReportedExercises();
    return;
  }

  try {
    let pid = null;
    if (classificationEnabled && userName) {
      pid = await ensureProfileId();
      if (!pid) throw new Error("NO_PROFILE");
    }

    if (!alreadyCommunityReported) {
      const eventsUrl = buildSupabaseUrl("completion_events");
      const eventsRes = await fetch(eventsUrl, {
        method: "POST",
        headers: supabaseHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify([{ profile_id: pid, exercise_id: exerciseId }])
      });
      if (!eventsRes.ok) throw new Error(`SUPABASE_COMPLETION_EVENT_${eventsRes.status}`);
    }

    if (pid) {
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
    }

    const [completionsCount, leaderboard] = await Promise.all([
      supabaseGetCount("completion_events"),
      supabaseGetLeaderboard(100)
    ]);
    setCounterText(ui.communityExerciseCount, completionsCount);
    renderLeaderboards(leaderboard);
  } catch {
    const next = localIncreaseCounter(LOCAL_COMMUNITY_FALLBACK_KEY);
    setCounterText(ui.communityExerciseCount, next);
    renderLeaderboards(buildLocalLeaderboard());
  }

  if (!alreadyCommunityReported) {
    reportedCompletedExercises.add(exerciseId);
    persistReportedExercises();
  }
}

async function syncPendingCompletionsForLoggedUser() {
  if (!classificationEnabled || !userName || !completedExercises.size) return;
  for (const exerciseId of completedExercises) {
    await reportCommunityExerciseCompletion(exerciseId, { forceSync: true });
  }
  await refreshCommunitySnapshot();
}

function queueServerExpSync(expDelta) {
  if (!classificationEnabled || !userName || expDelta <= 0) return;
  pendingExpDelta += expDelta;
  clearTimeout(expFlushTimer);
  expFlushTimer = setTimeout(() => {
    flushPendingServerExp();
  }, 1000);
}

async function flushPendingServerExp() {
  if (!pendingExpDelta || !classificationEnabled || !userName) return;
  const delta = pendingExpDelta;
  pendingExpDelta = 0;
  try {
    const pid = await ensureProfileId();
    if (!pid) return;
    await supabaseCallRpc("add_profile_exp", {
      p_profile_id: pid,
      p_exp: delta
    });
    await refreshCommunitySnapshot();
  } catch {
    pendingExpDelta += delta;
  }
}

async function syncCurrentExpToServer() {
  if (!classificationEnabled || !userName) return;
  try {
    const pid = await ensureProfileId();
    if (!pid) return;
    await supabaseCallRpc("set_profile_exp_max", {
      p_profile_id: pid,
      p_total_exp: totalExpFromProgress(levelProgress)
    });
  } catch {}
}

function openLeaderboardModal() {
  if (!ui.leaderboardModal) return;
  ui.leaderboardModal.classList.remove("hidden");
}

function closeLeaderboardModal() {
  if (!ui.leaderboardModal) return;
  ui.leaderboardModal.classList.add("hidden");
}

function openSessionModal() {
  if (!ui.sessionModal) return;
  ui.sessionModal.classList.remove("hidden");
}

function closeSessionModal() {
  if (!ui.sessionModal) return;
  ui.sessionModal.classList.add("hidden");
}

function setAuthStatus(message, isError = false) {
  if (!ui.authStatusText) return;
  ui.authStatusText.textContent = message || "";
  ui.authStatusText.style.color = isError ? "#ff9f94" : "var(--muted)";
}

function persistClassificationState() {
  safeSetLocal(USER_NAME_KEY, userName);
  safeSetLocal(CLASSIFICATION_MODE_KEY, classificationEnabled ? "enabled" : "disabled");
}

function syncAuthUi() {
  syncLevelProgressScope();
  syncExerciseProgressScope();
  const isLogged = classificationEnabled && Boolean(userName);
  if (ui.authUserText) {
    ui.authUserText.textContent = isLogged ? `Sesión iniciada como ${userName}` : "Modo anónimo";
  }
  if (ui.sessionStateText) {
    ui.sessionStateText.textContent = isLogged ? userName : "No iniciada";
    ui.sessionStateText.classList.toggle("session-state-on", isLogged);
    ui.sessionStateText.classList.toggle("session-state-off", !isLogged);
  }
  if (ui.openSessionBtn) {
    ui.openSessionBtn.textContent = isLogged ? "Mi sesión" : "Iniciar sesión";
  }
  if (!isLogged && ui.currentRankText) {
    ui.currentRankText.textContent = "#-";
  }
  if (ui.logoutUserBtn) ui.logoutUserBtn.classList.toggle("hidden", !isLogged);
  if (ui.registerUserBtn) ui.registerUserBtn.classList.toggle("hidden", isLogged);
  if (ui.loginUserBtn) ui.loginUserBtn.classList.toggle("hidden", isLogged);
  if (ui.userPasswordInput) {
    ui.userPasswordInput.classList.toggle("hidden", isLogged);
    ui.userPasswordInput.disabled = isLogged;
    if (isLogged) ui.userPasswordInput.value = "";
  }
  if (ui.userNameInput) {
    ui.userNameInput.readOnly = isLogged;
  }
}

async function registerWithSupabase() {
  const fullName = (ui.userNameInput?.value || "").trim();
  const password = (ui.userPasswordInput?.value || "").trim();
  if (fullName.length < 4) {
    setAuthStatus("Introduce un nombre completo valido.", true);
    return;
  }
  if (password.length < 6) {
    setAuthStatus("La contraseña debe tener al menos 6 caracteres.", true);
    return;
  }
  if (!SUPABASE_ENABLED) {
    setAuthStatus("Supabase no esta configurado en app-config.js.", true);
    return;
  }

  setAuthStatus("Registrando usuario...");
  const email = buildPseudoEmail(fullName);
  try {
    const signupRes = await fetch(buildSupabaseAuthUrl("signup"), {
      method: "POST",
      headers: supabaseAuthHeaders(),
      body: JSON.stringify({
        email,
        password,
        data: { full_name: fullName }
      })
    });
    const signupData = await signupRes.json();
    if (!signupRes.ok && !String(signupData?.msg || "").includes("registered")) {
      throw new Error(signupData?.msg || signupData?.error_description || "Error de registro");
    }
    userName = fullName;
    classificationEnabled = true;
    profileId = null;
    persistClassificationState();
    syncAuthUi();
    setAuthStatus("Registro completado. Ya entras en la clasificación.");
    showAppToast({
      title: "Registro completado",
      description: `Bienvenido, ${fullName}.`,
      type: "success"
    });
    await ensureProfileId();
    await syncCurrentExpToServer();
    await syncPendingCompletionsForLoggedUser();
    await refreshCommunitySnapshot();
    closeSessionModal();
  } catch (err) {
    setAuthStatus(`No se pudo registrar: ${String(err.message || err)}`, true);
  }
}

async function loginWithSupabase() {
  const fullName = (ui.userNameInput?.value || "").trim();
  const password = (ui.userPasswordInput?.value || "").trim();
  if (!fullName || !password) {
    setAuthStatus("Debes introducir nombre completo y contraseña.", true);
    return;
  }
  if (!SUPABASE_ENABLED) {
    setAuthStatus("Supabase no esta configurado en app-config.js.", true);
    return;
  }

  setAuthStatus("Iniciando sesión...");
  const email = buildPseudoEmail(fullName);
  try {
    const loginRes = await fetch(buildSupabaseAuthUrl("token?grant_type=password"), {
      method: "POST",
      headers: supabaseAuthHeaders(),
      body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData?.access_token) {
      throw new Error(loginData?.error_description || "Credenciales incorrectas");
    }
    userName = fullName;
    classificationEnabled = true;
    profileId = null;
    persistClassificationState();
    syncAuthUi();
    setAuthStatus("Sesión iniciada correctamente.");
    showAppToast({
      title: "Sesión iniciada",
      description: `Hola, ${fullName}.`,
      type: "success"
    });
    await ensureProfileId();
    await syncCurrentExpToServer();
    await syncPendingCompletionsForLoggedUser();
    await refreshCommunitySnapshot();
    closeSessionModal();
  } catch (err) {
    setAuthStatus(`No se pudo iniciar sesión: ${String(err.message || err)}`, true);
  }
}

function logoutUser() {
  classificationEnabled = false;
  userName = "";
  profileId = null;
  persistClassificationState();
  syncExerciseProgressScope({ clearAnon: true });
  syncAuthUi();
  if (ui.userNameInput) ui.userNameInput.value = "";
  if (ui.userPasswordInput) ui.userPasswordInput.value = "";
  setAuthStatus("Sesión cerrada. Puedes seguir usando la web sin clasificación.");
  refreshCommunitySnapshot();
}

function initUserFlow() {
  userName = safeGetLocal(USER_NAME_KEY, "").trim();
  classificationEnabled = safeGetLocal(CLASSIFICATION_MODE_KEY, "disabled") === "enabled";
  syncAuthUi();

  if (classificationEnabled && userName) {
    if (ui.userNameInput) ui.userNameInput.value = userName;
    setAuthStatus("Sesión restaurada.");
    syncCurrentExpToServer();
    syncPendingCompletionsForLoggedUser();
  } else {
    setAuthStatus("Inicia sesión para aparecer en la clasificación.");
  }

  ui.registerUserBtn?.addEventListener("click", registerWithSupabase);
  ui.loginUserBtn?.addEventListener("click", loginWithSupabase);
  ui.logoutUserBtn?.addEventListener("click", logoutUser);
  ui.openSessionBtn?.addEventListener("click", openSessionModal);
  ui.expandLeaderboardBtn?.addEventListener("click", openLeaderboardModal);
  ui.closeLeaderboardModalBtn?.addEventListener("click", closeLeaderboardModal);
  ui.closeSessionModalBtn?.addEventListener("click", closeSessionModal);
  ui.leaderboardModal?.addEventListener("click", (event) => {
    if (event.target === ui.leaderboardModal) closeLeaderboardModal();
  });
  ui.sessionModal?.addEventListener("click", (event) => {
    if (event.target === ui.sessionModal) closeSessionModal();
  });
  ui.userPasswordInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !classificationEnabled) loginWithSupabase();
  });

  registerVisit();
  refreshCommunitySnapshot();
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
    toggle.disabled = true;
    toggle.title = isDone
      ? "Completado tras validar correctamente"
      : "Se marca automaticamente al validar el ejercicio";

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
  captureCurrentExerciseBaseline();
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
  const alreadyCompleted = completedExercises.has(currentExercise.id);

  const wrapped = `
${code}
${currentExercise.testCode}
"OK"
`;

  try {
    await pyodide.runPythonAsync(wrapped);
    ui.checkOutput.textContent = "Correcto: tu solucion pasa los tests de este ejercicio.";
    markCurrentExerciseDone(true);
    awardExerciseCompletionExp(currentExercise);
    showAppToast({
      title: alreadyCompleted ? "Validación correcta" : "Ejercicio completado",
      description: alreadyCompleted
        ? `Tu solución de "${currentExercise.title}" sigue siendo válida.`
        : `Has completado "${currentExercise.title}".`,
      type: "success"
    });
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
