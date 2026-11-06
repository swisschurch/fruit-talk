// =====================================================================
// Fruit Consultation · app code
//   no hash   → request form (members, via QR)
//   #admin    → coordinator
//   #leader   → group leader
//   #poster   → printable QR poster
// =====================================================================
const CFG = window.APP_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();
const clean = (s) => String(s ?? "").trim();
const DAYS = CFG.days || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = CFG.periods || ["Morning", "Afternoon", "Evening"];
const RELATIONS = CFG.relations || ["Family", "Friend", "Work", "School", "Neighbour"];
const OTHER = "Other";
const FAITH = ["Attends a church", "Christian, not attending", "Other religion", "No religion", "Not sure"];
const SCJ = [["yes", "Yes, they know"], ["no", "No"], ["unsure", "Not sure"]];
const HIST = { new: "New fruit", before: "Progressed before" };

const STATUS = [
  { id: "new", l: "Received" },
  { id: "sched", l: "Scheduling" },
  { id: "set", l: "Scheduled" },
  { id: "done", l: "Consulted" },
  { id: "follow", l: "Following up" },
  { id: "closed", l: "Closed" },
];
const SL = Object.fromEntries(STATUS.map((s) => [s.id, s.l]));
const LEADER_STATUS = ["done", "follow", "closed"];

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("err", err);
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3200);
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
}
function fmtDT(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${fmtDate(ms)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toLocalInput(ms) {
  if (!ms) return "";
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function todayInput() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const zoneKey = (dept, zone) => `${dept}|${zone}`;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// =====================================================================
// Storage (Firebase or demo)
// =====================================================================
async function makeLive(fb) {
  const V = "10.12.2", base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [A, U, F] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js"),
  ]);
  const app = A.initializeApp(fb);
  const auth = U.getAuth(app);
  const db = F.getFirestore(app);
  const ms = (v) => (v && v.toMillis ? v.toMillis() : typeof v === "number" ? v : null);
  const toObj = (d) => {
    const x = d.data({ serverTimestamps: "estimate" });
    return { ...x, id: d.id, createdAt: ms(x.createdAt) || Date.now(), updatedAt: ms(x.updatedAt) };
  };
  const byNew = (a, b) => b.createdAt - a.createdAt;
  return {
    mode: "live",
    async getConfig() {
      const s = await F.getDoc(F.doc(db, "public", "config"));
      return s.exists() ? s.data() : null;
    },
    addRequest(r) {
      return F.addDoc(F.collection(db, "requests"), { ...r, status: "new", createdAt: F.serverTimestamp() });
    },
    onAuth(cb) {
      U.onAuthStateChanged(auth, (u) => cb(u ? { email: (u.email || "").toLowerCase(), name: u.displayName || "" } : null));
    },
    signIn() { return U.signInWithPopup(auth, new U.GoogleAuthProvider()); },
    signOut() { return U.signOut(auth); },
    async checkAdmin() { await F.getDoc(F.doc(db, "private", "leaders")); return true; },
    async checkLeader(email) {
      const s = await F.getDoc(F.doc(db, "leaders", email));
      return s.exists() ? { email, ...s.data() } : null;
    },
    watchAll(cb, err) {
      return F.onSnapshot(F.collection(db, "requests"), (s) => cb(s.docs.map(toObj).sort(byNew)), err);
    },
    watchMine(email, cb, err) {
      const q = F.query(F.collection(db, "requests"), F.where("leaderEmail", "==", email));
      return F.onSnapshot(q, (s) => cb(s.docs.map(toObj).sort(byNew)), err);
    },
    updateRequest(id, patch) {
      return F.updateDoc(F.doc(db, "requests", id), { ...patch, updatedAt: F.serverTimestamp() });
    },
    deleteRequest(id) { return F.deleteDoc(F.doc(db, "requests", id)); },
    async getLeaders() {
      const s = await F.getDoc(F.doc(db, "private", "leaders"));
      return s.exists() ? s.data().map || {} : {};
    },
    async saveSettings(departments, map, oldMap) {
      const b = F.writeBatch(db);
      b.set(F.doc(db, "public", "config"), { departments, updatedAt: F.serverTimestamp() });
      b.set(F.doc(db, "private", "leaders"), { map, updatedAt: F.serverTimestamp() });
      const now = {}, before = new Set(Object.values(oldMap || {}).map((l) => l.email).filter(Boolean));
      Object.values(map).forEach((l) => { if (l.email) now[l.email] = l.name; });
      Object.entries(now).forEach(([e, n]) => b.set(F.doc(db, "leaders", e), { name: n }));
      before.forEach((e) => { if (!(e in now)) b.delete(F.doc(db, "leaders", e)); });
      await b.commit();
    },
  };
}

function makeDemo() {
  const KEY = "fruit-talk-demo-en-v1";
  const H = 3600e3, D = 24 * H, now = Date.now();
  const at = (days, hour) => { const d = new Date(now + days * D); d.setHours(hour, 0, 0, 0); return d.getTime(); };
  const A = { leaderEmail: "leader.a@example.com", leaderName: "Example leader A" };
  const seed = () => ({
    departments: CFG.departments || [],
    leaders: {
      "Youth|Zurich Team 1": { name: "Example leader A", email: "leader.a@example.com" },
      "Youth|Zurich Team 2": { name: "Example leader B", email: "leader.b@example.com" },
      "Women's|Group 1": { name: "Example leader C", email: "leader.c@example.com" },
    },
    requests: [
      { id: "ex1", kind: "first", dept: "Youth", zone: "Zurich Team 1", job: "Marketing assistant", age: "29", home: "Zurich, Kreis 3", faith: "Christian, not attending", prior: "new", name: "Example: Sarah P.", fruit: "K.S.", relation: "Work",
        howMet: "We've been on the same team for two years and often have lunch together.",
        progress: "She keeps talking about burnout, so we've gone for two walks after work. She went to Catholic church as a child.",
        difficulty: "When I bring up faith she laughs it off. I don't know what topic to use for our next meeting.",
        slots: ["Sun-Afternoon", "Wed-Evening", "Fri-Evening"], slotNote: "Wednesdays only after 7 pm", consent: true, status: "new", createdAt: now - 2 * H },
      { id: "ex2", kind: "first", dept: "Youth", zone: "Zurich Team 2", job: "Engineer", age: "about 30", home: "Winterthur", faith: "No religion", prior: "before", knowsScj: "yes",
        scjHow: "Searched online after a Bible study last year", leaf: "Example member M.", relNow: "Still friends, we play tennis every other week", name: "Example: Daniel L.", fruit: "Lukas M.", relation: "Friend",
        howMet: "We met at a tennis club.", progress: "We've had coffee three times after training. He's very interested in the meaning of life.",
        difficulty: "He's wary of anything religious. I'm not sure what angle to take.",
        slots: ["Sat-Morning", "Sat-Afternoon", "Sun-Afternoon"], slotNote: "", consent: true, status: "sched",
        leaderEmail: "leader.b@example.com", leaderName: "Example leader B", adminNote: "Arranging Saturday afternoon", createdAt: now - 1 * D - 3 * H },
      { id: "ex3", kind: "first", dept: "Women's", zone: "Group 1", name: "Example: Grace C.", fruit: "Neighbour A", relation: "Neighbour",
        howMet: "She lives in the flat below us.", progress: "Our children are friends, and our families had dinner together once.",
        difficulty: "Her husband is negative about religion.", slots: ["Tue-Morning", "Thu-Morning"], slotNote: "", consent: true,
        status: "set", scheduledAt: at(2, 10), place: "Church, room 2", leaderEmail: "leader.c@example.com", leaderName: "Example leader C",
        adminNote: "", createdAt: now - 2 * D },
      { id: "ex4", kind: "first", dept: "Youth", zone: "Zurich Team 1", name: "Example: Joel J.", fruit: "Classmate B", relation: "School",
        howMet: "We're in the same research lab.", progress: "We got closer talking about MBTI, and I helped him through a problem once.",
        difficulty: "He's busy, so we only meet every two weeks.", slots: ["Mon-Evening", "Wed-Evening"], slotNote: "", consent: true,
        status: "follow", scheduledAt: at(-6, 19), place: "Online (Zoom)", ...A,
        feedback: "Suggest an Enneagram test as a psychology angle. Use the results talk to set the next meeting, then decide whether to connect a teacher.",
        followUps: [{ at: now - 3 * D, text: "Suggested the Enneagram test. He was interested; we'll look at results next week." }],
        createdAt: now - 9 * D },
      { id: "ex5", kind: "first", dept: "Youth", zone: "Zurich Team 1", name: "Example: Hannah H.", fruit: "Cousin C", relation: "Family",
        howMet: "My cousin.", progress: "We see each other on holidays and recently talked about her job change.", difficulty: "Serious talks feel awkward because we're family.",
        slots: ["Sun-Afternoon"], slotNote: "", consent: true, status: "closed", scheduledAt: at(-20, 14), place: "Church, room 2", ...A,
        feedback: "Instead of talking directly, let her meet a young adult from the group naturally. Use the job worries as a reason for counselling.",
        followUps: [{ at: now - 14 * D, text: "Had dinner together with a member of the group." }, { at: now - 10 * D, text: "Declined counselling for now. Keep the relationship and wait." }],
        createdAt: now - 24 * D },
      { id: "ex6", kind: "again", dept: "Youth", zone: "Zurich Team 1", name: "Example: Hannah H.", fruit: "Cousin C", relation: "Family",
        howMet: "", progress: "Since the last consultation she met the group member twice, and last week she messaged me first saying she's been struggling.",
        difficulty: "I'd like to talk about whether to connect her to counselling now, and who should do it.",
        slots: ["Sun-Afternoon", "Thu-Evening"], slotNote: "", consent: true, status: "new", createdAt: now - 30 * 60e3 },
    ],
  });
  const load = () => store.get(KEY, null);
  let st = load() || seed();
  const subs = new Set();
  const notify = () => subs.forEach((f) => f());
  const save = () => { store.set(KEY, st); notify(); };
  window.addEventListener("storage", (e) => { if (e.key === KEY) { st = load() || st; notify(); } });
  const sorted = () => st.requests.slice().sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r }));
  const leaderList = () => {
    const m = {};
    Object.values(st.leaders).forEach((l) => { if (l.email) m[l.email] = l.name; });
    return Object.entries(m).map(([email, name]) => ({ email, name }));
  };
  return {
    mode: "demo",
    async getConfig() { return { departments: st.departments }; },
    async addRequest(r) { st.requests.push({ ...r, id: "r" + Date.now().toString(36), status: "new", createdAt: Date.now() }); save(); },
    onAuth(cb) { cb({ email: "demo", name: "Demo" }); },
    async signIn() {}, async signOut() {},
    async checkAdmin() { return true; },
    async checkLeader(email) { return leaderList().find((l) => l.email === email) || null; },
    watchAll(cb) { const f = () => cb(sorted()); subs.add(f); f(); return () => subs.delete(f); },
    watchMine(email, cb) { const f = () => cb(sorted().filter((r) => r.leaderEmail === email)); subs.add(f); f(); return () => subs.delete(f); },
    async updateRequest(id, patch) { const r = st.requests.find((x) => x.id === id); if (r) Object.assign(r, patch, { updatedAt: Date.now() }); save(); },
    async deleteRequest(id) { st.requests = st.requests.filter((x) => x.id !== id); save(); },
    async getLeaders() { return JSON.parse(JSON.stringify(st.leaders)); },
    async saveSettings(departments, map) { st.departments = departments; st.leaders = map; save(); },
    leaderList,
  };
}

let backend;
async function initBackend() {
  if (CFG.firebase) {
    try { backend = await makeLive(CFG.firebase); return; }
    catch (e) { console.error(e); toast("Couldn't connect to Firebase, so this opened in demo mode. Check config.js.", true); }
  }
  backend = makeDemo();
  $("#demo-flag").hidden = false;
}

async function loadDepartments(timeoutMs = 6000) {
  try {
    const c = await Promise.race([
      backend.getConfig(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    if (c && Array.isArray(c.departments) && c.departments.length) return c.departments;
  } catch (e) { console.warn("Using departments from config.js:", e.message || e); }
  return CFG.departments || [];
}

// =====================================================================
// Shared rendering
// =====================================================================
function pill(st) { return `<span class="pill st-${esc(st)}">${esc(SL[st] || st)}</span>`; }
const dayClass = (i) => (i === 0 ? " sun" : "");

function miniGrid(slots) {
  const on = new Set(slots || []);
  let h = `<div class="tgrid mini" style="--cols:${PERIODS.length}"><span></span>${PERIODS.map((p) => `<span class="h">${esc(p)}</span>`).join("")}`;
  DAYS.forEach((d, i) => {
    h += `<span class="d${dayClass(i)}">${esc(d)}</span>`;
    PERIODS.forEach((p) => { h += `<span class="cell${on.has(`${d}-${p}`) ? " on" : ""}" title="${esc(d)} ${esc(p)}"></span>`; });
  });
  return h + "</div>";
}

function slotsText(slots) {
  if (!slots || !slots.length) return "–";
  return slots.map((s) => s.replace("-", " ")).join(", ");
}

function prevOf(r, list) {
  return list
    .filter((x) => x.id !== r.id && norm(x.name) === norm(r.name) && norm(x.fruit) === norm(r.fruit) && x.createdAt < r.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function fuList(items) {
  return `<ul class="fu">${items.map((f) => `<li><time>${esc(fmtDate(f.at))}</time><span>${esc(f.text)}</span></li>`).join("")}</ul>`;
}

function requestSections(r, list) {
  const prev = prevOf(r, list);
  return `
  <div class="sec">
    <h4>Fruit</h4>
    <dl class="kv">
      <dt>Name</dt><dd><b>${esc(r.fruit)}</b></dd>
      <dt>Relationship</dt><dd>${esc(r.relation || "–")}</dd>
      ${r.kind === "again" ? "" : `<dt>How connected</dt><dd>${esc(r.howMet || "–")}</dd>`}
      ${r.job ? `<dt>Occupation</dt><dd>${esc(r.job)}</dd>` : ""}
      ${r.age ? `<dt>Age</dt><dd>${esc(r.age)}</dd>` : ""}
      ${r.home ? `<dt>Lives in</dt><dd>${esc(r.home)}</dd>` : ""}
      ${r.faith ? `<dt>Believer</dt><dd>${esc(r.faith)}</dd>` : ""}
    </dl>
  </div>
  ${r.prior ? `<div class="sec">
    <h4>History</h4>
    <dl class="kv">
      <dt>Progressed</dt><dd><b>${esc(HIST[r.prior] || r.prior)}</b></dd>
      <dt>Knows SCJ</dt><dd>${esc((SCJ.find((x) => x[0] === r.knowsScj) || [, "–"])[1])}</dd>
      ${r.scjHow ? `<dt>How they knew</dt><dd>${esc(r.scjHow)}</dd>` : ""}
      ${r.leaf ? `<dt>Leaf &amp; BBT</dt><dd>${esc(r.leaf)}</dd>` : ""}
      ${r.relNow ? `<dt>Relationship now</dt><dd>${esc(r.relNow)}</dd>` : ""}
    </dl>
  </div>` : ""}
  <div class="sec">
    <h4>${r.kind === "again" ? "Since last consultation" : r.prior === "before" ? "How it was progressed" : "Progress so far"}</h4>
    <p class="prose">${esc(r.progress || "–")}</p>
  </div>
  <div class="sec">
    <h4>Difficulties</h4>
    <p class="prose">${esc(r.difficulty || "–")}</p>
  </div>
  <div class="sec">
    <h4>Available times</h4>
    ${miniGrid(r.slots)}
    ${r.slotNote ? `<p class="prose" style="font-size:14px">Note: ${esc(r.slotNote)}</p>` : ""}
  </div>
  ${prev.length ? `<div class="sec">
    <h4>Earlier consultations · ${prev.length}</h4>
    <div class="prev">${prev.map((p) => `
      <div class="prev-item">
        <div class="top">${pill(p.status)}<span class="num" style="font-weight:700">Requested ${esc(fmtDate(p.createdAt))}</span>${p.scheduledAt ? `<span style="color:var(--muted)">Met ${esc(fmtDate(p.scheduledAt))}</span>` : ""}${p.leaderName ? `<span style="color:var(--muted)">· ${esc(p.leaderName)}</span>` : ""}</div>
        ${p.feedback ? `<div><b style="font-size:13px">Feedback</b><p class="prose" style="font-size:14px">${esc(p.feedback)}</p></div>` : ""}
        ${(p.followUps || []).length ? fuList(p.followUps) : ""}
      </div>`).join("")}</div>
  </div>` : ""}`;
}

function detailHead(r, closeId) {
  return `
  <div class="d-head">
    <div class="actions"><button class="btn sm ghost back" type="button" id="${closeId}">← List</button></div>
    <h2>${esc(r.name)} ${pill(r.status)} ${r.kind === "again" ? '<span class="tag">Follow-up</span>' : ""}</h2>
    <div class="sub"><span>${esc(r.dept)} · ${esc(r.zone)}</span><span class="num">Requested ${esc(fmtDT(r.createdAt))}</span>${r.leaderName ? `<span>Leader: ${esc(r.leaderName)}</span>` : ""}</div>
  </div>`;
}

function renderPipe(el, list, current, onPick) {
  const count = (id) => list.filter((r) => r.status === id).length;
  el.innerHTML = STATUS.map((s) => `
    <button type="button" data-st="${s.id}" aria-pressed="${current === s.id}" class="${s.id === "new" && count("new") ? "hot" : ""}">
      <span class="k">${count(s.id)}</span><span class="l">${esc(s.l)}</span>
    </button>`).join("");
  $$("button", el).forEach((b) => (b.onclick = () => onPick(current === b.dataset.st ? null : b.dataset.st)));
}

function renderRows(el, rows, selId, onPick, emptyMsg) {
  if (!rows.length) { el.innerHTML = `<li class="empty"><svg class="cross" width="28" height="28"><use href="#i-cross"/></svg><span>${esc(emptyMsg)}</span></li>`; return; }
  el.innerHTML = rows.map((r) => `
    <li class="row" data-id="${esc(r.id)}" tabindex="0" aria-current="${r.id === selId}">
      <span class="nm">${esc(r.name)}<small>${esc(r.dept)} · ${esc(r.zone)}</small></span>
      <span>${pill(r.status)}</span>
      <span class="fr">Fruit <b>${esc(r.fruit)}</b> · ${esc(r.relation || "")}</span>
      <span class="meta">
        <span class="num">Requested ${esc(fmtDate(r.createdAt))}</span>
        ${r.kind === "again" ? '<span class="tag">Follow-up</span>' : ""}
        ${r.scheduledAt ? `<span>Meeting <b class="num" style="color:var(--ink)">${esc(fmtDT(r.scheduledAt))}</b></span>` : ""}
        ${r.leaderName ? `<span>${esc(r.leaderName)}</span>` : ""}
      </span>
    </li>`).join("");
  $$(".row", el).forEach((li) => {
    li.onclick = () => onPick(li.dataset.id);
    li.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(li.dataset.id); } };
  });
}

function emptyDetail(msg) {
  return `<div class="empty" style="padding:64px 24px"><svg class="cross" width="40" height="40"><use href="#i-cross"/></svg><span>${esc(msg)}</span></div>`;
}

// Sign-in flow (coordinator and leader)
function gate(root, { check, onReady, deniedMsg }) {
  document.body.classList.add("desk-on");
  const login = $(".js-login", root), msg = $(".js-login-msg", root), out = $(".js-signout", root), who = $(".js-who", root);
  $(".js-signin", root).onclick = () => backend.signIn().catch((e) => toast("Couldn't sign in: " + (e.code || e.message), true));
  out.onclick = () => backend.signOut().then(() => location.reload());
  let started = false;
  backend.onAuth(async (u) => {
    if (backend.mode === "demo") { who.textContent = ""; out.hidden = true; }
    else { who.textContent = u ? u.email : ""; out.hidden = !u; }
    if (!u) { login.hidden = false; msg.hidden = true; return; }
    try {
      const ok = await check(u);
      if (!ok) throw new Error("denied");
      login.hidden = true;
      if (!started) { started = true; onReady(u, ok); }
    } catch (e) {
      console.warn(e);
      login.hidden = false;
      msg.hidden = false;
      msg.textContent = `${u.email}: ${deniedMsg}`;
      $(".js-signin", root).hidden = true;
    }
  });
}

function downloadCSV(name, rows) {
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// =====================================================================
// Request form
// =====================================================================
const SUB_FIRST = "Is there someone on your heart? Let's talk it through together.";
const SUB_AGAIN = "Need to talk again? We'll pick up from your earlier record.";
const HINT_FIRST = "Because you love your friends and family · About 5 minutes";
const HINT_AGAIN = "Let's keep walking together";

async function startApply() {
  $("#view-apply").hidden = false;
  const prof = store.get("fruit-talk-profile", {});
  let step = 1, kind = "first", relation = "";
  const slots = new Set();

  // Department and group: show the list from config.js right away,
  // then swap in the coordinator's saved list when it arrives.
  let depts = CFG.departments || [];
  const dSel = $("#f-dept"), zSel = $("#f-zone");
  const fillZones = () => {
    const d = depts.find((x) => x.name === dSel.value);
    const zs = d ? d.zones : [];
    const keep = zSel.value;
    zSel.innerHTML = `<option value="">${d ? "Choose…" : "Choose a department first"}</option>` + zs.map((z) => `<option>${esc(z)}</option>`).join("");
    zSel.disabled = !d;
    if (zs.includes(keep)) zSel.value = keep;
    else if (zs.length === 1) zSel.value = zs[0];
  };
  const fillDepts = () => {
    const keep = dSel.value || prof.dept || "";
    dSel.innerHTML = `<option value="">Choose…</option>` + depts.map((d) => `<option>${esc(d.name)}</option>`).join("");
    if (depts.some((d) => d.name === keep)) dSel.value = keep;
    fillZones();
  };
  dSel.onchange = fillZones;
  fillDepts();
  if (prof.zone) { zSel.value = prof.zone; }
  loadDepartments().then((d) => { if (d && d.length) { depts = d; fillDepts(); } });
  if (prof.name) $("#f-name").value = prof.name;

  // Request type
  const setKind = (k) => {
    kind = k;
    $$("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === k)));
    $$(".js-first-only").forEach((el) => (el.hidden = k === "again"));
    if (typeof syncHist === "function") syncHist(); // defined below; runs after setup
    $("#f-prog-l").innerHTML = (k === "again" ? "What has happened since the last consultation?" : "What has happened so far?") + '<span class="req">*</span>';
    $("#f-prog-h").textContent = k === "again" ? "What you tried from the feedback, and how they responded" : "Every conversation matters. Please write in detail.";
    $("#a-sub").textContent = k === "again" ? SUB_AGAIN : SUB_FIRST;
    $("#a-sub-hint").textContent = k === "again" ? HINT_AGAIN : HINT_FIRST;
  };
  $$("[data-kind]").forEach((b) => (b.onclick = () => setKind(b.dataset.kind)));

  // Relationship
  const chips = $("#f-rel-chips"), etc = $("#f-rel-etc");
  chips.innerHTML = [...RELATIONS, OTHER].map((r) => `<button type="button" class="chip" data-rel="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join("");
  $$(".chip", chips).forEach((c) => (c.onclick = () => {
    relation = c.dataset.rel;
    $$(".chip", chips).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    etc.hidden = relation !== OTHER;
    if (!etc.hidden) etc.focus();
  }));

  // Believer, history, Shincheonji
  let faith = "", hist = "", scj = "";
  const faithEl = $("#f-faith"), scjEl = $("#f-scj");
  faithEl.innerHTML = FAITH.map((f) => `<button type="button" class="chip" data-v="${esc(f)}" aria-pressed="false">${esc(f)}</button>`).join("");
  scjEl.innerHTML = SCJ.map(([v, l]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="false">${esc(l)}</button>`).join("");
  const pickIn = (box, v) => $$("button", box).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
  $$("button", faithEl).forEach((c) => (c.onclick = () => { faith = c.dataset.v; pickIn(faithEl, faith); }));
  const syncHist = () => {
    $$("[data-hist]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hist === hist)));
    const first = kind === "first", before = first && hist === "before";
    $$(".js-picked").forEach((el) => (el.hidden = !(first && hist)));
    $$(".js-before").forEach((el) => (el.hidden = !before));
    $$(".js-scj-yes").forEach((el) => (el.hidden = !(first && hist && scj === "yes")));
    if (first) {
      $("#f-prog-l").innerHTML = (before ? "Please describe how you progressed this fruit in detail" : "What has happened so far?") + '<span class="req">*</span>';
      $("#f-prog-h").textContent = before ? "What you did, how they responded, and where it stopped" : "Every conversation matters. Please write in detail.";
    }
  };
  $$("[data-hist]").forEach((b) => (b.onclick = () => { hist = b.dataset.hist; syncHist(); }));
  $$("button", scjEl).forEach((c) => (c.onclick = () => { scj = c.dataset.v; pickIn(scjEl, scj); syncHist(); }));

  // Time grid
  const grid = $("#f-grid");
  grid.style.setProperty("--cols", PERIODS.length);
  grid.innerHTML = `<span></span>` + PERIODS.map((p) => `<span class="h">${esc(p)}</span>`).join("") +
    DAYS.map((d, i) => `<span class="d${dayClass(i)}">${esc(d)}</span>` +
      PERIODS.map((p) => `<button type="button" class="slot" data-slot="${esc(d)}-${esc(p)}" aria-pressed="false" aria-label="${esc(d)} ${esc(p)}">${esc(d)} ${esc(p)}</button>`).join("")).join("");
  $$(".slot", grid).forEach((b) => (b.onclick = () => {
    const k = b.dataset.slot;
    slots.has(k) ? slots.delete(k) : slots.add(k);
    b.setAttribute("aria-pressed", String(slots.has(k)));
  }));

  // Steps
  const prevBtn = $("#a-prev"), nextBtn = $("#a-next");
  const show = (n) => {
    step = n;
    $$(".step").forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    $$(".progress i").forEach((i, k) => i.classList.toggle("on", k < n));
    prevBtn.style.visibility = n === 1 ? "hidden" : "visible";
    nextBtn.textContent = n === 4 ? "Send request" : "Next";
    window.scrollTo({ top: 0 });
  };
  const need = (el, msg) => { toast(msg, true); el.focus(); return false; };
  const valid = (n) => {
    if (n === 1) {
      if (!dSel.value) return need(dSel, "Choose your department");
      if (!zSel.value) return need(zSel, "Choose your group");
      if (!clean($("#f-name").value)) return need($("#f-name"), "Enter your name");
    }
    if (n === 2) {
      if (!clean($("#f-fruit").value)) return need($("#f-fruit"), "Enter your fruit's initials or a nickname");
      if (!relation) { toast("Choose your relationship", true); return false; }
      if (relation === OTHER && !clean(etc.value)) return need(etc, "Describe the relationship");
      if (kind === "first" && !faith) { toast("Choose whether they are a believer", true); return false; }
    }
    if (n === 3) {
      if (kind === "first" && !hist) { toast("Choose New fruit or Worked with before", true); return false; }
      if (kind === "first" && !scj) { toast("Choose whether they know about Shincheonji", true); return false; }
      if (!clean($("#f-prog").value)) return need($("#f-prog"), "Tell us what has happened so far");
      if (!clean($("#f-diff").value)) return need($("#f-diff"), "Tell us what you're finding difficult");
    }
    if (n === 4) {
      if (!slots.size) { toast("Tap at least one time that works", true); return false; }
      if (!$("#f-consent").checked) return need($("#f-consent"), "Tick the consent box to continue");
    }
    return true;
  };
  prevBtn.onclick = () => step > 1 && show(step - 1);
  nextBtn.onclick = async () => {
    if (!valid(step)) return;
    if (step < 4) return show(step + 1);
    const first = kind === "first", before = first && hist === "before";
    const data = {
      kind,
      dept: dSel.value, zone: zSel.value,
      name: clean($("#f-name").value).slice(0, 40),
      fruit: clean($("#f-fruit").value).slice(0, 40),
      relation: (relation === OTHER ? clean(etc.value) : relation).slice(0, 40),
      howMet: kind === "again" ? "" : clean($("#f-how").value).slice(0, 1500),
      job: first ? clean($("#f-job").value).slice(0, 60) : "",
      age: first ? clean($("#f-age").value).slice(0, 12) : "",
      home: first ? clean($("#f-home").value).slice(0, 60) : "",
      faith: first ? faith : "",
      prior: first ? hist : "",
      knowsScj: first ? scj : "",
      scjHow: first && scj === "yes" ? clean($("#f-scj-how").value).slice(0, 1500) : "",
      leaf: before ? clean($("#f-leaf").value).slice(0, 80) : "",
      relNow: before ? clean($("#f-now").value).slice(0, 1500) : "",
      progress: clean($("#f-prog").value).slice(0, 4000),
      difficulty: clean($("#f-diff").value).slice(0, 3000),
      slots: DAYS.flatMap((d) => PERIODS.map((p) => `${d}-${p}`)).filter((k) => slots.has(k)),
      slotNote: clean($("#f-slotnote").value).slice(0, 300),
      consent: true,
    };
    nextBtn.disabled = true; nextBtn.textContent = "Sending…";
    try {
      await backend.addRequest(data);
      store.set("fruit-talk-profile", { dept: data.dept, zone: data.zone, name: data.name });
      $("#d-sum").innerHTML = `
        <div><span>From</span><b>${esc(data.name)} · ${esc(data.dept)}, ${esc(data.zone)}</b></div>
        <div><span>Fruit</span><b>${esc(data.fruit)} (${esc(data.relation)})</b></div>
        <div><span>Times</span><span style="color:var(--ink)">${esc(slotsText(data.slots))}</span></div>`;
      $("#view-apply").hidden = true;
      $("#view-done").hidden = false;
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error(e);
      const code = String((e && (e.code || e.message)) || "unknown");
      toast(code.includes("permission") ? "Couldn't send (permission-denied). The coordinator needs to update the Firebase rules." : `Couldn't send (${code}). Check your connection and tap again.`, true);
    } finally {
      nextBtn.disabled = false; nextBtn.textContent = "Send request";
    }
  };
  $("#d-again").onclick = () => {
    ["#f-fruit", "#f-how", "#f-job", "#f-age", "#f-home", "#f-scj-how", "#f-leaf", "#f-now", "#f-prog", "#f-diff", "#f-slotnote", "#f-rel-etc"].forEach((s) => ($(s).value = ""));
    faith = hist = scj = ""; pickIn(faithEl, ""); pickIn(scjEl, ""); syncHist();
    $("#f-consent").checked = false;
    relation = ""; etc.hidden = true;
    $$(".chip", chips).forEach((x) => x.setAttribute("aria-pressed", "false"));
    slots.clear(); $$(".slot", grid).forEach((b) => b.setAttribute("aria-pressed", "false"));
    setKind("first");
    $("#view-done").hidden = true;
    $("#view-apply").hidden = false;
    show(1);
  };
  setKind("first");
  show(1);
}

// =====================================================================
// Coordinator
// =====================================================================
function startAdmin() {
  const root = $("#view-admin");
  root.hidden = false;
  gate(root, {
    check: () => backend.checkAdmin(),
    deniedMsg: "this account isn't a coordinator. Check the coordinator email in firestore.rules.",
    onReady: initAdmin,
  });
}

async function initAdmin() {
  $("#ad-main").hidden = false;
  $("#ad-tabs").hidden = false;
  let list = [], filter = null, q = "", sel = null, dirty = false;
  let depts = await loadDepartments();
  let leaders = await backend.getLeaders().catch(() => ({}));

  const tabs = $$("#ad-tabs .tab");
  const openTab = (t) => {
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    $$("#ad-main [data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== t));
    if (t === "settings") renderSettings();
    if (t === "poster") renderPosterPane();
  };
  tabs.forEach((b) => (b.onclick = () => openTab(b.dataset.tab)));

  const leaderOptions = () => {
    const m = {};
    Object.values(leaders).forEach((l) => { if (l && l.email) m[l.email] = l.name || l.email; });
    return Object.entries(m).map(([email, name]) => ({ email, name }));
  };

  const visible = () => list.filter((r) => (!filter || r.status === filter) &&
    (!q || norm([r.name, r.fruit, r.dept, r.zone, r.leaderName].join(" ")).includes(norm(q))));

  function render() {
    renderPipe($("#ad-pipe"), list, filter, (f) => { filter = f; render(); });
    $("#ad-list-title").textContent = filter ? SL[filter] : "All requests";
    renderRows($("#ad-list"), visible(), sel, pick, list.length ? "No requests match" : "No requests yet. Once the QR poster is up, they'll arrive here.");
    if (!dirty) renderDetail();
  }
  function pick(id) { sel = id; dirty = false; render(); $("#ad-detail").classList.remove("closed"); $("#ad-detail").scrollTop = 0; }

  function renderDetail() {
    const box = $("#ad-detail");
    const r = list.find((x) => x.id === sel);
    if (!r) { box.innerHTML = emptyDetail("Pick a request from the list to see it here."); box.classList.add("closed"); return; }
    const sugg = leaders[zoneKey(r.dept, r.zone)];
    const cur = r.leaderEmail || (sugg && sugg.email) || "";
    const opts = leaderOptions();
    if (r.leaderEmail && !opts.some((o) => o.email === r.leaderEmail)) opts.push({ email: r.leaderEmail, name: r.leaderName || r.leaderEmail });
    box.innerHTML = detailHead(r, "ad-close") + `
    <div class="d-body">
      ${requestSections(r, list)}
      <div class="sec">
        <h4>Schedule &amp; leader</h4>
        <div class="manage">
          <div class="field"><span class="lbl">Status</span>
            <div class="stbar" id="m-st">${STATUS.map((s) => `<button type="button" data-st="${s.id}" aria-pressed="${r.status === s.id}">${esc(s.l)}</button>`).join("")}</div>
          </div>
          <div class="grid2">
            <div class="field"><label for="m-when">Meeting date &amp; time</label><input type="datetime-local" class="inp" id="m-when" value="${esc(toLocalInput(r.scheduledAt))}"></div>
            <div class="field"><label for="m-place">Place or format</label><input class="inp" id="m-place" maxlength="80" value="${esc(r.place || "")}" placeholder="Church, room 2 / Zoom"></div>
          </div>
          <div class="field"><label for="m-leader">Leader joining the consultation</label>
            <select class="inp" id="m-leader"><option value="">Not assigned</option>${opts.map((o) => `<option value="${esc(o.email)}" ${o.email === cur ? "selected" : ""}>${esc(o.name)}${sugg && sugg.email === o.email ? " · this group's leader" : ""}</option>`).join("")}</select>
            ${!sugg ? `<span class="hint">No leader is linked to this group yet. Add one in the Groups &amp; leaders tab.</span>` : !r.leaderEmail ? `<span class="hint">The group's leader is preselected. Once you save, this request appears on their screen.</span>` : ""}
          </div>
          <div class="field"><label for="m-note">Coordinator note</label><span class="hint">The leader can see this too</span>
            <textarea class="inp" id="m-note" maxlength="2000" style="min-height:80px">${esc(r.adminNote || "")}</textarea></div>
          <div class="actions"><button class="btn primary" type="button" id="m-save">Save</button><span class="spacer"></span><button class="btn sm danger" type="button" id="m-del">Delete</button></div>
          <div class="confirm" id="m-confirm" hidden>Delete this request for good? This can't be undone.
            <button class="btn sm danger" type="button" id="m-del-yes">Delete</button><button class="btn sm" type="button" id="m-del-no">Cancel</button></div>
        </div>
      </div>
      <div class="sec">
        <h4>Leader's record</h4>
        ${r.feedback ? `<p class="prose">${esc(r.feedback)}</p>` : `<p class="prose empty-t">After the consultation, the leader's feedback will show here.</p>`}
        ${(r.followUps || []).length ? fuList(r.followUps) : ""}
      </div>
    </div>`;
    let st = r.status;
    const markDirty = () => (dirty = true);
    $$("#m-st button", box).forEach((b) => (b.onclick = () => { st = b.dataset.st; $$("#m-st button", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); markDirty(); }));
    ["#m-when", "#m-place", "#m-leader", "#m-note"].forEach((s) => $(s, box).addEventListener("input", markDirty));
    $("#ad-close").onclick = () => { box.classList.add("closed"); };
    $("#m-save").onclick = async () => {
      const when = $("#m-when", box).value;
      if (st === "set" && !when) { toast("Add a meeting date and time to mark it Scheduled", true); $("#m-when", box).focus(); return; }
      const le = $("#m-leader", box).value;
      const lo = opts.find((o) => o.email === le);
      const patch = {
        status: st,
        scheduledAt: when ? new Date(when).getTime() : null,
        place: clean($("#m-place", box).value),
        leaderEmail: le,
        leaderName: lo ? lo.name : "",
        adminNote: clean($("#m-note", box).value),
      };
      if (st !== r.status) patch.history = [...(r.history || []), { at: Date.now(), status: st, by: "Coordinator" }];
      const btn = $("#m-save", box); btn.disabled = true; btn.textContent = "Saving…";
      try { await backend.updateRequest(r.id, patch); dirty = false; toast("Saved"); render(); }
      catch (e) { console.error(e); toast("Couldn't save: " + (e.code || e.message), true); btn.disabled = false; btn.textContent = "Save"; }
    };
    $("#m-del").onclick = () => ($("#m-confirm", box).hidden = false);
    $("#m-del-no").onclick = () => ($("#m-confirm", box).hidden = true);
    $("#m-del-yes").onclick = async () => {
      try { await backend.deleteRequest(r.id); sel = null; dirty = false; toast("Deleted"); render(); }
      catch (e) { toast("Couldn't delete: " + (e.code || e.message), true); }
    };
  }

  $("#ad-q").addEventListener("input", (e) => { q = e.target.value; render(); });
  $("#ad-csv").onclick = () => {
    const head = ["Requested", "Type", "Department", "Group", "Name", "Fruit", "Relationship", "How connected", "Occupation", "Age", "Lives in", "Believer", "History", "Knows SCJ", "How they knew", "Leaf & BBT", "Relationship now", "Progress", "Difficulties", "Available times", "Time note", "Status", "Meeting", "Place", "Leader", "Coordinator note", "Feedback", "Follow-ups"];
    const rows = list.map((r) => [fmtDT(r.createdAt), r.kind === "again" ? "Follow-up" : "First", r.dept, r.zone, r.name, r.fruit, r.relation, r.howMet, r.job, r.age, r.home, r.faith, HIST[r.prior] || "", (SCJ.find((x) => x[0] === r.knowsScj) || [, ""])[1], r.scjHow, r.leaf, r.relNow, r.progress, r.difficulty,
      slotsText(r.slots), r.slotNote, SL[r.status], fmtDT(r.scheduledAt), r.place, r.leaderName, r.adminNote, r.feedback,
      (r.followUps || []).map((f) => `${fmtDate(f.at)}: ${f.text}`).join(" / ")]);
    downloadCSV(`fruit-consultations_${todayInput()}.csv`, [head, ...rows]);
  };

  backend.watchAll((l) => { list = l; render(); }, (e) => { console.error(e); toast("Couldn't load requests: " + (e.code || e.message), true); });

  // ---------- Groups & leaders ----------
  let draft = null;
  function renderSettings() {
    if (!draft) draft = depts.map((d) => ({
      name: d.name,
      zones: d.zones.map((z) => { const l = leaders[zoneKey(d.name, z)] || {}; return { zone: z, lname: l.name || "", email: l.email || "" }; }),
    }));
    const box = $("#st-depts");
    box.innerHTML = draft.map((d, di) => `
      <div class="dept">
        <div class="dept-h"><input class="inp" data-d="${di}" data-f="name" value="${esc(d.name)}" placeholder="Department name" aria-label="Department name">
          <span style="flex:1"></span><button class="icon-btn" type="button" data-deldept="${di}" aria-label="Remove department" title="Remove department">×</button></div>
        <div class="zone zone-h"><span>Group</span><span>Leader name</span><span>Leader Google email</span><span></span></div>
        ${d.zones.map((z, zi) => `
          <div class="zone">
            <input class="inp" data-d="${di}" data-z="${zi}" data-f="zone" value="${esc(z.zone)}" placeholder="Group name" aria-label="Group name">
            <input class="inp" data-d="${di}" data-z="${zi}" data-f="lname" value="${esc(z.lname)}" placeholder="Name" aria-label="Leader name">
            <input class="inp z-email" data-d="${di}" data-z="${zi}" data-f="email" value="${esc(z.email)}" placeholder="name@gmail.com" inputmode="email" aria-label="Leader email">
            <button class="icon-btn" type="button" data-delzone="${di}-${zi}" aria-label="Remove group" title="Remove group">×</button>
          </div>`).join("")}
        <div style="padding:10px 14px"><button class="btn sm ghost" type="button" data-addzone="${di}">+ Add group</button></div>
      </div>`).join("");
    $$("input", box).forEach((i) => i.addEventListener("input", () => {
      const d = draft[i.dataset.d];
      if (i.dataset.z === undefined) d.name = i.value; else d.zones[i.dataset.z][i.dataset.f] = i.value;
    }));
    $$("[data-deldept]", box).forEach((b) => (b.onclick = () => { draft.splice(+b.dataset.deldept, 1); renderSettings(); }));
    $$("[data-delzone]", box).forEach((b) => (b.onclick = () => { const [d, z] = b.dataset.delzone.split("-").map(Number); draft[d].zones.splice(z, 1); renderSettings(); }));
    $$("[data-addzone]", box).forEach((b) => (b.onclick = () => { draft[+b.dataset.addzone].zones.push({ zone: "", lname: "", email: "" }); renderSettings(); }));
  }
  $("#st-add-dept").onclick = () => { draft.push({ name: "", zones: [{ zone: "", lname: "", email: "" }] }); renderSettings(); };
  $("#st-save").onclick = async () => {
    const out = [], map = {};
    for (const d of draft) {
      const dn = clean(d.name); if (!dn) { toast("A department has no name", true); return; }
      const zs = [];
      for (const z of d.zones) {
        const zn = clean(z.zone); if (!zn) { toast(`${dn} has a group with no name`, true); return; }
        const em = clean(z.email).toLowerCase();
        if (em && !isEmail(em)) { toast(`Check the leader email for ${dn}, ${zn}`, true); return; }
        if (em && !clean(z.lname)) { toast(`Add the leader's name for ${dn}, ${zn}`, true); return; }
        zs.push(zn);
        if (em) map[zoneKey(dn, zn)] = { name: clean(z.lname), email: em };
      }
      out.push({ name: dn, zones: zs });
    }
    const btn = $("#st-save"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      await backend.saveSettings(out, map, leaders);
      depts = out; leaders = map; draft = null;
      $("#st-msg").textContent = "Saved. The request form and leader sign-in use this right away.";
      toast("Saved"); renderSettings(); render();
    } catch (e) { console.error(e); toast("Couldn't save: " + (e.code || e.message), true); }
    finally { btn.disabled = false; btn.textContent = "Save"; }
  };

  // ---------- QR poster ----------
  function renderPosterPane() {
    const url = applyUrl();
    $("#ps-url").textContent = url;
    $("#ps-holder").innerHTML = posterHTML();
    drawQR($("#ps-holder canvas"), url);
    $("#ps-copy").onclick = () => navigator.clipboard.writeText(url).then(() => toast("Link copied"), () => toast("Couldn't copy. Select the link and copy it by hand.", true));
  }

  render();
}

// =====================================================================
// Leader
// =====================================================================
function startLeader() {
  const root = $("#view-leader");
  root.hidden = false;
  if (backend.mode === "demo") {
    const ls = backend.leaderList();
    const lab = $(".js-demo-leader", root), selEl = $("#ld-demo");
    lab.hidden = false;
    selEl.innerHTML = ls.map((l) => `<option value="${esc(l.email)}">${esc(l.name)}</option>`).join("");
    let stop = null;
    const go = () => { if (stop) stop(); stop = initLeader({ email: selEl.value }, ls.find((l) => l.email === selEl.value)); };
    selEl.onchange = go;
    document.body.classList.add("desk-on");
    if (ls.length) go(); else { $("#ld-main").hidden = false; $("#ld-list").innerHTML = `<li class="empty">Register leaders on the coordinator screen first.</li>`; }
    return;
  }
  gate(root, {
    check: (u) => backend.checkLeader(u.email),
    deniedMsg: "this account isn't registered as a leader. Ask the coordinator to add this email in Groups & leaders.",
    onReady: (u, me) => initLeader(u, me),
  });
}

function initLeader(u, me) {
  $("#ld-main").hidden = false;
  let list = [], filter = null, sel = null, dirty = false;
  $("#ld-list-title").textContent = me && me.name ? `Assigned to ${me.name}` : "Assigned to me";

  function render() {
    renderPipe($("#ld-pipe"), list, filter, (f) => { filter = f; render(); });
    const rows = list.filter((r) => !filter || r.status === filter);
    renderRows($("#ld-list"), rows, sel, pick, list.length ? "Nothing at this stage" : "Nothing assigned yet. Requests appear here once the coordinator assigns you.");
    if (!dirty) renderDetail();
  }
  function pick(id) { sel = id; dirty = false; render(); $("#ld-detail").classList.remove("closed"); $("#ld-detail").scrollTop = 0; }

  function renderDetail() {
    const box = $("#ld-detail");
    const r = list.find((x) => x.id === sel);
    if (!r) { box.innerHTML = emptyDetail("Pick a request to see it and record feedback."); box.classList.add("closed"); return; }
    let fu = (r.followUps || []).slice();
    let st = LEADER_STATUS.includes(r.status) ? r.status : "done";
    box.innerHTML = detailHead(r, "ld-close") + `
    <div class="d-body">
      <div class="sec">
        <h4>Meeting</h4>
        <dl class="kv">
          <dt>When</dt><dd>${r.scheduledAt ? `<b class="num">${esc(fmtDT(r.scheduledAt))}</b>` : "Not scheduled yet"}</dd>
          <dt>Place</dt><dd>${esc(r.place || "–")}</dd>
          ${r.adminNote ? `<dt>Coordinator note</dt><dd>${esc(r.adminNote)}</dd>` : ""}
        </dl>
      </div>
      ${requestSections(r, list)}
      <div class="sec">
        <h4>Feedback &amp; follow-up</h4>
        <div class="manage">
          <div class="field"><label for="l-fb">Feedback given in the consultation</label><span class="hint">Write down what they agreed to do, so following up is easy</span>
            <textarea class="inp" id="l-fb" maxlength="5000">${esc(r.feedback || "")}</textarea></div>
          <div class="field"><span class="lbl">Follow-up checks</span>
            <ul class="fu" id="l-fu"></ul>
            <div class="grid2" style="grid-template-columns:160px 1fr">
              <input type="date" class="inp" id="l-fu-date" value="${todayInput()}" aria-label="Check date">
              <input class="inp" id="l-fu-text" maxlength="500" placeholder="e.g. Suggested the Enneagram test as agreed. Good response." aria-label="What you checked">
            </div>
            <div><button class="btn sm" type="button" id="l-fu-add">+ Add check</button></div>
          </div>
          <div class="field"><span class="lbl">Status</span>
            <div class="stbar" id="l-st">${LEADER_STATUS.map((s) => `<button type="button" data-st="${s}" aria-pressed="${st === s}">${esc(SL[s])}</button>`).join("")}</div>
            <span class="hint">If another consultation is needed, ask them to submit a <b>follow-up request</b> through the QR. This record will be linked to it.</span>
          </div>
          <div class="actions"><button class="btn primary" type="button" id="l-save">Save record</button></div>
        </div>
      </div>
    </div>`;
    const drawFu = () => {
      $("#l-fu", box).innerHTML = fu.length ? fu.map((f, i) => `<li><time>${esc(fmtDate(f.at))}</time><span style="display:flex;gap:8px;justify-content:space-between;align-items:flex-start"><span>${esc(f.text)}</span><button class="icon-btn" style="width:28px;height:28px;font-size:16px" type="button" data-rm="${i}" aria-label="Remove this check">×</button></span></li>`).join("")
        : `<li style="grid-template-columns:1fr;color:var(--muted)">No checks recorded yet.</li>`;
      $$("[data-rm]", box).forEach((b) => (b.onclick = () => { fu.splice(+b.dataset.rm, 1); dirty = true; drawFu(); }));
    };
    drawFu();
    $("#l-fu-add", box).onclick = () => {
      const t = clean($("#l-fu-text", box).value);
      if (!t) { toast("Write what you checked", true); $("#l-fu-text", box).focus(); return; }
      const dv = $("#l-fu-date", box).value;
      fu.push({ at: dv ? new Date(dv + "T12:00").getTime() : Date.now(), text: t.slice(0, 500) });
      fu.sort((a, b) => a.at - b.at);
      $("#l-fu-text", box).value = "";
      dirty = true; drawFu();
      if (st === "done") { st = "follow"; $$("#l-st button", box).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.st === st))); }
    };
    $$("#l-st button", box).forEach((b) => (b.onclick = () => { st = b.dataset.st; dirty = true; $$("#l-st button", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
    $("#l-fb", box).addEventListener("input", () => (dirty = true));
    $("#ld-close").onclick = () => box.classList.add("closed");
    $("#l-save", box).onclick = async () => {
      const patch = { feedback: clean($("#l-fb", box).value).slice(0, 5000), followUps: fu, status: st };
      if (st !== r.status) patch.history = [...(r.history || []), { at: Date.now(), status: st, by: (me && me.name) || "Leader" }];
      const btn = $("#l-save", box); btn.disabled = true; btn.textContent = "Saving…";
      try { await backend.updateRequest(r.id, patch); dirty = false; toast("Record saved"); render(); }
      catch (e) { console.error(e); toast("Couldn't save: " + (e.code || e.message), true); btn.disabled = false; btn.textContent = "Save record"; }
    };
  }

  const stop = backend.watchMine(u.email, (l) => {
    list = l;
    if (sel && !list.some((x) => x.id === sel)) sel = null;
    render();
  }, (e) => { console.error(e); toast("Couldn't load your list: " + (e.code || e.message), true); });
  return () => { if (stop) stop(); sel = null; dirty = false; };
}

// =====================================================================
// QR poster
// =====================================================================
function applyUrl() { return location.origin + location.pathname; }

function posterHTML() {
  return `
  <div class="poster-frame"><div class="poster">
    <img src="assets/friends.jpg" alt="Four friendly characters hugging a smiling lemon">
    <div class="qrrow"><canvas width="10" height="10" aria-label="QR code for the request form"></canvas>
      <div><b>Fruit Consultation</b><span class="tagline">One soul is more precious than the whole world.</span><ol><li>Scan the QR with your phone camera</li><li>Tell us about your fruit and when you're free</li><li>The coordinator will get in touch</li></ol></div></div>
  </div></div>`;
}

function drawQR(canvas, text) {
  if (!canvas || typeof qrcode !== "function") return;
  const qr = qrcode(0, "M");
  qr.addData(unescape(encodeURIComponent(text)));
  qr.make();
  const n = qr.getModuleCount(), quiet = 2, scale = 12, size = (n + quiet * 2) * scale;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#141212";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
}

function startPoster() {
  $("#view-poster").hidden = false;
  $("#pv-holder").innerHTML = posterHTML();
  drawQR($("#pv-holder canvas"), applyUrl());
  $("#pv-print").onclick = () => window.print();
}

// =====================================================================
// Start
// =====================================================================
$$(".js-church").forEach((el) => (el.textContent = CFG.churchName || ""));
window.addEventListener("hashchange", () => location.reload());
(async () => {
  await initBackend();
  const h = location.hash.replace("#", "");
  if (h === "admin") startAdmin();
  else if (h === "leader") startLeader();
  else if (h === "poster") startPoster();
  else startApply();
})();
