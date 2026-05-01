const STORAGE_KEY = "highway_star_private_v2";
const SESSION_KEY = "highway_star_session_v1";

const RUN_EVENTS = new Set(["100m", "200m", "400m", "800m", "1500m", "3000m", "5K", "10K", "Half Marathon", "Marathon"]);
const EVENTS = [
  "100m",
  "200m",
  "400m",
  "800m",
  "1500m",
  "3000m",
  "5K",
  "10K",
  "Half Marathon",
  "Marathon",
  "Long Jump",
  "High Jump",
  "Triple Jump",
  "Shot Put",
];

const state = loadState();
const chartState = {
  points: [],
  selectedEvent: "All events",
};
let editingPerformanceId = null;

const ui = {
  screens: {
    welcome: document.getElementById("welcomeScreen"),
    auth: document.getElementById("authScreen"),
    main: document.getElementById("mainApp"),
  },
  getStartedBtn: document.getElementById("getStartedBtn"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authName: document.getElementById("authName"),
  keepSignedIn: document.getElementById("keepSignedIn"),
  signInBtn: document.getElementById("signInBtn"),
  signUpBtn: document.getElementById("signUpBtn"),
  authMessage: document.getElementById("authMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
  appUserName: document.getElementById("appUserName"),
  appUserMeta: document.getElementById("appUserMeta"),
  appUserAvatar: document.getElementById("appUserAvatar"),
  navButtons: [...document.querySelectorAll(".nav-btn")],
  tabs: [...document.querySelectorAll(".tab")],
  recentPerformances: document.getElementById("recentPerformances"),
  notifications: document.getElementById("notifications"),
  performanceForm: document.getElementById("performanceForm"),
  perfEvent: document.getElementById("perfEvent"),
  perfTime: document.getElementById("perfTime"),
  perfTimeFormat: document.getElementById("perfTimeFormat"),
  perfMeet: document.getElementById("perfMeet"),
  perfDate: document.getElementById("perfDate"),
  perfLocation: document.getElementById("perfLocation"),
  perfMode: document.getElementById("perfMode"),
  perfLink: document.getElementById("perfLink"),
  perfGoal: document.getElementById("perfGoal"),
  perfMessage: document.getElementById("perfMessage"),
  perfCancelEdit: document.getElementById("perfCancelEdit"),
  perfSubmitBtn: document.getElementById("perfSubmitBtn"),
  profileForm: document.getElementById("profileForm"),
  profileName: document.getElementById("profileName"),
  profileAvatarInput: document.getElementById("profileAvatarInput"),
  profileAvatarPreview: document.getElementById("profileAvatarPreview"),
  profileRegion: document.getElementById("profileRegion"),
  profileEvents: document.getElementById("profileEvents"),
  profileBio: document.getElementById("profileBio"),
  statEntries: document.getElementById("statEntries"),
  statVerified: document.getElementById("statVerified"),
  statPbs: document.getElementById("statPbs"),
  chartEvent: document.getElementById("chartEvent"),
  trendCanvas: document.getElementById("trendCanvas"),
  eventProgress: document.getElementById("eventProgress"),
};

const trendTooltip = createTrendTooltip();

init();

function init() {
  renderEventsSelect();
  bindAuth();
  bindNavigation();
  bindForms();
  bindChartInteractions();
  restoreSession();
  renderApp();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
      return parsed;
    } catch {
      // ignore parse failure
    }
  }
  return { users: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveSession(userId, keepSignedIn) {
  if (!keepSignedIn) {
    sessionStorage.setItem(SESSION_KEY, userId);
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, userId);
  sessionStorage.removeItem(SESSION_KEY);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function restoreSession() {
  const id = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!id) return;
  const user = state.users.find((u) => u.id === id);
  if (user) state.currentUserId = user.id;
}

function bindAuth() {
  ui.getStartedBtn.addEventListener("click", () => showScreen("auth"));
  ui.signInBtn.addEventListener("click", signIn);
  ui.signUpBtn.addEventListener("click", signUp);
  ui.authForm.addEventListener("submit", (e) => e.preventDefault());
}

async function signIn() {
  const email = normalizeEmail(ui.authEmail.value);
  const password = ui.authPassword.value;
  if (!email || !password) return setAuthMessage("Email and password are required.");

  const passwordHash = await hash(password);
  const user = state.users.find((u) => u.email === email);
  if (!user || user.passwordHash !== passwordHash) {
    return setAuthMessage("Invalid email or password.");
  }

  state.currentUserId = user.id;
  saveSession(user.id, ui.keepSignedIn.checked);
  setAuthMessage("");
  renderApp();
}

async function signUp() {
  const email = normalizeEmail(ui.authEmail.value);
  const password = ui.authPassword.value;
  const name = ui.authName.value.trim();
  if (!email || !password || !name) return setAuthMessage("Email, password, and name are required for sign up.");
  if (password.length < 8) return setAuthMessage("Password must be at least 8 characters.");
  if (state.users.some((u) => u.email === email)) return setAuthMessage("Account already exists for this email.");

  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await hash(password),
    profile: {
      name,
      region: "",
      events: [],
      bio: "",
      avatarDataUrl: "",
    },
    performances: [],
    notifications: ["Welcome to Highway:Star. Your data is private and only visible to you."],
  };

  state.users.unshift(user);
  state.currentUserId = user.id;
  saveState();
  saveSession(user.id, ui.keepSignedIn.checked);
  setAuthMessage("");
  renderApp();
}

function setAuthMessage(text) {
  ui.authMessage.textContent = text;
}

function bindNavigation() {
  ui.logoutBtn.addEventListener("click", () => {
    saveState();
    state.currentUserId = null;
    clearSession();
    showScreen("auth");
  });

  ui.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function setTab(tabId) {
  ui.navButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  ui.tabs.forEach((t) => t.classList.toggle("active", t.id === tabId));
}

function bindForms() {
  ui.perfMode.addEventListener("change", () => {
    ui.perfLink.placeholder =
      ui.perfMode.value === "verified"
        ? "Required for verified entries"
        : "Optional for unverified / casual entries";
  });

  ui.perfTimeFormat.addEventListener("change", () => {
    ui.perfGoal.placeholder =
      ui.perfTimeFormat.value === "minutes" ? "e.g. 4:12.40" : "e.g. 252.40";
  });

  ui.performanceForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addPerformance();
  });
  ui.perfCancelEdit.addEventListener("click", () => resetPerformanceEditor());
  ui.recentPerformances.addEventListener("click", handleRecentActions);

  ui.profileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;
    user.profile.name = ui.profileName.value.trim();
    user.profile.region = ui.profileRegion.value.trim();
    user.profile.events = ui.profileEvents.value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    user.profile.bio = ui.profileBio.value.trim();
    saveProfileWithAvatar(user);
  });
}

function addPerformance() {
  const user = getCurrentUser();
  if (!user) return;
  const event = ui.perfEvent.value;
  const timeRaw = ui.perfTime.value.trim();
  const timeFormat = ui.perfTimeFormat.value;
  const meet = ui.perfMeet.value.trim();
  const date = ui.perfDate.value;
  const location = ui.perfLocation.value.trim();
  const mode = ui.perfMode.value;
  const link = ui.perfLink.value.trim();
  const goalRaw = ui.perfGoal.value.trim();

  const value = parsePerformanceValue(event, timeRaw, timeFormat);
  if (Number.isNaN(value)) return setPerfMessage("Invalid performance value.");
  if (!meet || !date || !location) return setPerfMessage("Meet, date, and location are required.");
  if (mode === "verified" && !link) return setPerfMessage("Verified entries require an official results link.");

  let goal = null;
  if (goalRaw) {
    goal = parsePerformanceValue(event, goalRaw, timeFormat);
    if (Number.isNaN(goal)) return setPerfMessage("Goal format must match selected time format.");
  }

  const perf = {
    id: editingPerformanceId || crypto.randomUUID(),
    event,
    value,
    meet,
    date,
    location,
    mode,
    link,
    goal,
    createdAt: Date.now(),
  };

  if (editingPerformanceId) {
    const idx = user.performances.findIndex((p) => p.id === editingPerformanceId);
    if (idx >= 0) user.performances[idx] = perf;
  } else {
    user.performances.push(perf);
    detectPBAndGoal(user, perf);
  }
  saveState();
  const msg = editingPerformanceId ? "Performance updated." : "Performance saved.";
  resetPerformanceEditor();
  setPerfMessage(msg);
  renderApp();
}

function setPerfMessage(msg) {
  ui.perfMessage.textContent = msg;
}

function resetPerformanceEditor() {
  editingPerformanceId = null;
  ui.performanceForm.reset();
  ui.perfDate.value = toIsoDate(Date.now());
  ui.perfSubmitBtn.textContent = "Save Performance";
  ui.perfCancelEdit.classList.add("hidden");
}

function handleRecentActions(event) {
  const editBtn = event.target.closest("[data-edit-id]");
  if (!editBtn) return;
  const user = getCurrentUser();
  if (!user) return;
  const perf = user.performances.find((p) => p.id === editBtn.dataset.editId);
  if (!perf) return;
  startEditPerformance(perf);
}

function startEditPerformance(perf) {
  editingPerformanceId = perf.id;
  const runEvent = RUN_EVENTS.has(perf.event);
  let timeFormat = "seconds";
  let perfTime = String(perf.value);
  let goalValue = perf.goal != null ? String(perf.goal) : "";
  if (runEvent && perf.value >= 60) {
    timeFormat = "minutes";
    perfTime = formatSecondsAsMinutes(perf.value);
    if (perf.goal != null) goalValue = formatSecondsAsMinutes(perf.goal);
  }

  ui.perfEvent.value = perf.event;
  ui.perfTimeFormat.value = timeFormat;
  ui.perfTime.value = perfTime;
  ui.perfMeet.value = perf.meet;
  ui.perfDate.value = perf.date;
  ui.perfLocation.value = perf.location;
  ui.perfMode.value = perf.mode;
  ui.perfLink.value = perf.link || "";
  ui.perfGoal.value = goalValue;
  ui.perfSubmitBtn.textContent = "Update Performance";
  ui.perfCancelEdit.classList.remove("hidden");
  setPerfMessage("Editing performance entry.");
  setTab("tabAdd");
}

function saveProfileWithAvatar(user) {
  const file = ui.profileAvatarInput.files?.[0];
  if (!file) {
    saveState();
    renderApp();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    user.profile.avatarDataUrl = typeof reader.result === "string" ? reader.result : "";
    ui.profileAvatarInput.value = "";
    saveState();
    renderApp();
  };
  reader.readAsDataURL(file);
}

function detectPBAndGoal(user, latest) {
  const eventData = user.performances.filter((p) => p.event === latest.event);
  const previous = eventData.filter((p) => p.id !== latest.id).map((p) => p.value);
  if (!previous.length) return;
  const bestBefore = findBest(latest.event, previous);
  if (isBetter(latest.event, latest.value, bestBefore)) {
    user.notifications.push(`New PB in ${latest.event}: ${formatValue(latest.event, latest.value)}`);
  }
  if (latest.goal != null && isGoalHit(latest.event, latest.value, latest.goal)) {
    user.notifications.push(`Goal achieved in ${latest.event}: ${formatValue(latest.event, latest.goal)} target hit.`);
  }
}

function renderApp() {
  const user = getCurrentUser();
  if (!user) {
    showScreen("auth");
    return;
  }

  showScreen("main");
  setTab(getActiveTabId() || "tabHome");
  ui.appUserName.textContent = user.profile.name || "Athlete";
  ui.appUserMeta.textContent = `${user.profile.region || "No region yet"} • Private account`;
  ui.appUserAvatar.src = user.profile.avatarDataUrl || "";
  ui.appUserAvatar.style.visibility = user.profile.avatarDataUrl ? "visible" : "hidden";
  renderProfile(user);
  renderHome(user);
  renderStats(user);
  ui.perfDate.value = ui.perfDate.value || toIsoDate(Date.now());
}

function renderProfile(user) {
  ui.profileName.value = user.profile.name || "";
  ui.profileAvatarPreview.src = user.profile.avatarDataUrl || "";
  ui.profileAvatarPreview.style.visibility = user.profile.avatarDataUrl ? "visible" : "hidden";
  ui.profileRegion.value = user.profile.region || "";
  ui.profileEvents.value = (user.profile.events || []).join(", ");
  ui.profileBio.value = user.profile.bio || "";
}

function renderHome(user) {
  const sorted = [...user.performances].sort((a, b) => eventDateToMs(b.date) - eventDateToMs(a.date));
  if (!sorted.length) {
    ui.recentPerformances.innerHTML = '<p class="muted">No performances yet. Add your first time.</p>';
  } else {
    ui.recentPerformances.innerHTML = sorted
      .slice(0, 8)
      .map((p) => {
        const pbClass = isPBEntry(user, p) ? "pb" : "";
        return `
          <article class="perf-item ${pbClass}">
            <div class="row">
              <strong>${p.event} • ${formatValue(p.event, p.value)}</strong>
              <span class="badge ${p.mode}">${p.mode}</span>
            </div>
            <p class="perf-meta">${p.meet} • ${formatDate(p.date)} • ${p.location}</p>
            ${p.link ? `<p class="perf-meta"><a href="${p.link}" target="_blank" rel="noreferrer">Official link</a></p>` : ""}
            <div class="row" style="margin-top:0.45rem;">
              <button class="btn ghost" data-edit-id="${p.id}" type="button">Edit</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  const notes = [...user.notifications].slice(-8).reverse();
  ui.notifications.innerHTML = notes.length
    ? notes.map((n) => `<li>${n}</li>`).join("")
    : "<li>No notifications yet.</li>";
}

function renderStats(user) {
  ui.statEntries.textContent = String(user.performances.length);
  ui.statVerified.textContent = String(user.performances.filter((p) => p.mode === "verified").length);
  ui.statPbs.textContent = String(countPBs(user));

  const events = ["All events", ...new Set(user.performances.map((p) => p.event))];
  ui.chartEvent.innerHTML = events.map((e) => `<option>${e}</option>`).join("");
  ui.chartEvent.onchange = () => drawTrendChart(user, ui.chartEvent.value);
  drawTrendChart(user, ui.chartEvent.value || "All events");

  const grouped = groupBy(user.performances, (p) => p.event);
  const cards = Object.entries(grouped).map(([event, list]) => {
    const best = findBest(event, list.map((x) => x.value));
    const latest = [...list].sort((a, b) => eventDateToMs(b.date) - eventDateToMs(a.date))[0];
    return `
      <article class="perf-item">
        <strong>${event}</strong>
        <p class="perf-meta">PB: ${formatValue(event, best)}</p>
        <p class="perf-meta">Latest: ${formatValue(event, latest.value)} (${formatDate(latest.date)})</p>
      </article>
    `;
  });
  ui.eventProgress.innerHTML = cards.length ? cards.join("") : '<p class="muted">No event stats yet.</p>';
}

function drawTrendChart(user, selectedEvent) {
  const canvas = ui.trendCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const chartArea = { left: 72, right: canvas.width - 24, top: 28, bottom: canvas.height - 36 };
  drawGrid(ctx, canvas.width, canvas.height, chartArea);
  chartState.points = [];
  chartState.selectedEvent = selectedEvent;

  let data = sortPerformancesByDate(user.performances);
  if (selectedEvent !== "All events") data = data.filter((x) => x.event === selectedEvent);
  if (!data.length) {
    ctx.fillStyle = "#b7afd9";
    ctx.fillText("Add performances to view trend.", 20, 30);
    return;
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const paddedMin = min - range * 0.1;
  const paddedMax = max + range * 0.1;
  const paddedRange = paddedMax - paddedMin || 1;
  drawAxesLabels(ctx, canvas.width, canvas.height, data, paddedMin, paddedMax, chartArea);

  const points = data.map((d, i) => ({
    x: chartArea.left + (i / Math.max(data.length - 1, 1)) * (chartArea.right - chartArea.left),
    y: chartArea.bottom - ((d.value - paddedMin) / paddedRange) * (chartArea.bottom - chartArea.top),
    d,
  }));
  chartState.points = points;

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

  points.forEach((p) => {
    ctx.fillStyle = p.d.mode === "verified" ? "#16a34a" : p.d.mode === "casual" ? "#db2777" : "#d97706";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGrid(ctx, width, height, area) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = area.top + ((area.bottom - area.top) / 5) * i;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(area.left, area.top);
  ctx.lineTo(area.left, area.bottom);
  ctx.lineTo(area.right, area.bottom);
  ctx.stroke();
}

function drawAxesLabels(ctx, width, height, sortedData, min, max, area) {
  ctx.fillStyle = "#334155";
  ctx.font = "12px Inter";

  const unit = RUN_EVENTS.has(sortedData[0].event) ? "seconds" : "meters";
  ctx.textAlign = "left";
  ctx.fillText(`Y-axis: Performance (${unit})`, area.left, 16);
  ctx.textAlign = "center";
  ctx.fillText("X-axis: Date", (area.left + area.right) / 2, height - 8);

  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i += 1) {
    const value = max - ((max - min) / 5) * i;
    const y = area.top + ((area.bottom - area.top) / 5) * i + 4;
    ctx.fillText(value.toFixed(2), area.left - 8, y);
  }

  const tickCount = Math.min(sortedData.length, 4);
  ctx.textAlign = "center";
  for (let i = 0; i < tickCount; i += 1) {
    const idx = Math.round((i / Math.max(tickCount - 1, 1)) * (sortedData.length - 1));
    const x = area.left + (idx / Math.max(sortedData.length - 1, 1)) * (area.right - area.left);
    const d = new Date(`${sortedData[idx].date}T00:00:00`);
    const label = Number.isNaN(d.getTime()) ? "-" : `${d.getMonth() + 1}/${d.getDate()}`;
    ctx.fillText(label, x, area.bottom + 16);
  }
}

function bindChartInteractions() {
  ui.trendCanvas.addEventListener("mousemove", (event) => {
    if (!chartState.points.length) {
      hideTrendTooltip();
      return;
    }
    const rect = ui.trendCanvas.getBoundingClientRect();
    const scaleX = ui.trendCanvas.width / rect.width;
    const scaleY = ui.trendCanvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const hit = chartState.points.find((p) => Math.hypot(p.x - x, p.y - y) <= 10);
    if (!hit) {
      hideTrendTooltip();
      return;
    }
    showTrendTooltip(event.clientX, event.clientY, hit.d);
  });

  ui.trendCanvas.addEventListener("mouseleave", hideTrendTooltip);
}

function showTrendTooltip(clientX, clientY, perf) {
  trendTooltip.innerHTML = `
    <strong>${perf.event}</strong><br />
    Time: ${formatValue(perf.event, perf.value)}<br />
    Date: ${formatDate(perf.date)}<br />
    Meet: ${perf.meet}<br />
    Location: ${perf.location}<br />
    Status: ${perf.mode}
  `;
  trendTooltip.style.display = "block";
  trendTooltip.style.left = `${clientX + 12}px`;
  trendTooltip.style.top = `${clientY + 12}px`;
}

function hideTrendTooltip() {
  trendTooltip.style.display = "none";
}

function createTrendTooltip() {
  const el = document.createElement("div");
  el.className = "chart-tooltip";
  document.body.appendChild(el);
  return el;
}

function renderEventsSelect() {
  ui.perfEvent.innerHTML = EVENTS.map((e) => `<option>${e}</option>`).join("");
}

function parsePerformanceValue(event, raw, format) {
  if (!raw) return Number.NaN;
  if (!RUN_EVENTS.has(event)) return Number(raw);
  if (format === "minutes") {
    const m = /^(\d+):([0-5]?\d(?:\.\d{1,2})?)$/.exec(raw.trim());
    if (!m) return Number.NaN;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  return Number(raw);
}

function formatValue(event, value) {
  if (value == null || Number.isNaN(value)) return "-";
  return RUN_EVENTS.has(event) ? `${value.toFixed(2)}s` : `${value.toFixed(2)}m`;
}

function findBest(event, values) {
  if (!values.length) return null;
  return RUN_EVENTS.has(event) ? Math.min(...values) : Math.max(...values);
}

function isBetter(event, candidate, baseline) {
  if (baseline == null) return true;
  return RUN_EVENTS.has(event) ? candidate < baseline : candidate > baseline;
}

function isGoalHit(event, val, goal) {
  return RUN_EVENTS.has(event) ? val <= goal : val >= goal;
}

function isPBEntry(user, perf) {
  const group = user.performances.filter((p) => p.event === perf.event);
  const best = findBest(perf.event, group.map((x) => x.value));
  return best === perf.value;
}

function countPBs(user) {
  return Object.values(groupBy(user.performances, (p) => p.event)).length;
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const k = keyFn(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function getCurrentUser() {
  if (!state.currentUserId) return null;
  return state.users.find((u) => u.id === state.currentUserId) || null;
}

function getActiveTabId() {
  const active = ui.tabs.find((t) => t.classList.contains("active"));
  return active?.id;
}

function showScreen(which) {
  Object.entries(ui.screens).forEach(([k, el]) => el.classList.toggle("active", k === which));
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function toIsoDate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function eventDateToMs(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function sortPerformancesByDate(performances) {
  return [...performances].sort((a, b) => {
    const da = eventDateToMs(a.date);
    const db = eventDateToMs(b.date);
    if (da !== db) return da - db;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function formatSecondsAsMinutes(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${seconds}`;
}

async function hash(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
