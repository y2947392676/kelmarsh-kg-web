import { initTurbine3D } from "/static/js/turbine3d_app.js?v=2";

const { api, fmt, esc, sourceButton, table, chart, axis, baseOption, T, COLORS } = window.kg;
const L = window.kgI18n;
const N = window.KG_TURBINE;

/* 3D part (alias from the viewer) -> components in the graph: components whose id contains the
   part name (e.g. generator -> generator, generator_bearing), plus parts named differently in the model */
const PART_EXTRA = { shaft: ["component:drivetrain", "component:rotor_bearing"], oilcool: ["component:gearbox"] };
const partComponents = (alias) => {
    if (!alias || alias === "unknown") return [];
    const ids = components.map((c) => c.id).filter((id) => id.split(":")[1].split("_").includes(alias));
    return [...new Set([...ids, ...(PART_EXTRA[alias] || [])])].filter((id) => compById[id]);
};

const [turbines, components, signals, days, events, meta] = await Promise.all([
    api("turbines"), api("components"), api("signals"), api(`alarm-days/${N}`), api("events", { turbine: N }), api("meta")]);
const turbine = turbines.find((t) => t.number === N);
const compById = Object.fromEntries(components.map((c) => [c.id, c]));
const sigById = Object.fromEntries(signals.map((s) => [s.id, s]));

const state = { part: null, partLabel: null, status: "", day: "", event: null, window: null };
const DEFAULT_SIGNALS = ["Drive train acceleration (mm/ss)", "Rotor speed (RPM)", "Power (kW)", "Wind speed (m/s)"];

/* ---------- header */
function renderHeader() {
    document.getElementById("turbineMeta").textContent =
        `${turbine.model} · ${fmt(turbine.events)} ${T("ov.events")} (Stop ${turbine.stop}, Warning ${turbine.warning}) · ${turbine.alarm_days} ${T("ov.alarmDays")}`;
}

/* ---------- 3D viewer */
initTurbine3D(document.getElementById("viewer3d"), {
    name: turbine.name,
    onPartSelect: (alias, label) => { state.part = alias; state.partLabel = label; renderPart(); renderWindow(); },
});

function partSignalColumns() {
    const comps = partComponents(state.part);
    return comps.flatMap((c) => (compById[c]?.signals || []).map((s) => `${s.name} (${s.unit})`));
}

function renderPart() {
    const name = document.getElementById("partName");
    const box = document.getElementById("partSignals");
    const hint = document.getElementById("partHint");
    if (!state.part) { name.textContent = "–"; box.innerHTML = ""; hint.hidden = false; return; }
    hint.hidden = true;
    name.textContent = L.lang() === "zh" ? `${state.partLabel} · ${({ rotor: "转子", shaft: "主轴", gearbox: "齿轮箱", oilcool: "油冷装置", generator: "发电机", pitch: "变桨系统", yaw: "偏航电机", fancool: "风冷装置", control: "控制柜" })[state.part] || "未知部件"}` : state.partLabel;
    const comps = partComponents(state.part);
    if (!comps.length) { box.innerHTML = `<p class="kg-note">${T("tb.noSignal")}</p>`; return; }
    box.innerHTML = comps.map((cid) => {
        const c = compById[cid];
        return `<h4 style="margin:10px 0 6px"><code>${esc(cid)}</code> ${esc(L.zhOnly(cid) !== cid ? L.zhOnly(cid) : "")}</h4>
            <div class="kg-part-list">${c.signals.map((s) => {
                const sig = sigById[s.id];
                return `<div><span>${esc(L.label(s.name))} <span class="kg-muted">(${esc(s.unit)})</span></span>
                    <span class="kg-small kg-muted">${fmt(sig?.observations)} · ${sourceButton(s.source_file, s.source_line)}</span></div>`;
            }).join("")}</div>`;
    }).join("");
}

/* ---------- calendar of alarm days */
const cal = chart(document.getElementById("calendarChart"));
function renderCalendar() {
    /* one calendar row per year that has loaded alarm days (years come from the graph) */
    const loaded = days.filter((d) => d.loaded);
    const years = [...new Set(loaded.map((d) => d.day.slice(0, 4)))].sort();
    const el = document.getElementById("calendarChart");
    el.style.height = `${Math.max(1, years.length) * 140 + 25}px`;
    cal.resize();
    const max = Math.max(1, ...loaded.map((d) => d.stop + d.warning));
    cal.setOption({
        tooltip: { formatter: (p) => `${p.value[0]}: ${p.value[1]} ${T("ov.events")}` },
        visualMap: { min: 1, max, show: false, inRange: { color: ["#1e3a5f", "#38BDF8", "#F59E0B", "#EF4444"] } },
        calendar: years.map((y, i) => ({ range: y, cellSize: ["auto", 14], top: 24 + i * 140, left: 44, right: 10,
            itemStyle: { color: "#0A0F1D", borderColor: "#121B30" }, splitLine: { lineStyle: { color: "#334155" } },
            dayLabel: { color: "#64748B", fontSize: 9 }, monthLabel: { color: "#94A3B8" }, yearLabel: { show: true, color: "#94A3B8", margin: 24 } })),
        series: years.map((y, i) => ({ type: "heatmap", coordinateSystem: "calendar", calendarIndex: i,
            data: loaded.filter((d) => d.day.startsWith(y)).map((d) => [d.day, d.stop + d.warning]) })),
    }, true);
}
cal.on("click", (p) => { state.day = state.day === p.value[0] ? "" : p.value[0]; renderEvents(); });

/* ---------- events */
document.getElementById("statusFilter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-status]");
    if (b) { state.status = b.dataset.status; renderEvents(); }
    if (e.target.id === "dayFilter") { state.day = ""; renderEvents(); }
});
function renderEvents() {
    document.querySelectorAll("#statusFilter [data-status]").forEach((b) => b.classList.toggle("is-active", b.dataset.status === state.status));
    const dayChip = document.getElementById("dayFilter");
    dayChip.hidden = !state.day; dayChip.textContent = `${state.day} ×`;
    const rows = events.filter((e) => (!state.status || e.status === state.status) && (!state.day || e.start.startsWith(state.day)));
    document.getElementById("eventCount").textContent = `${rows.length}`;
    table(document.getElementById("eventTable"), [
        { labelText: T("tb.start"), render: (e) => `${esc(e.start)}${e.starts_in_scope === false ? ` <span class="kg-muted kg-small">(2020)</span>` : ""}` },
        { labelText: T("tb.status"), render: (e) => `<span class="kg-status ${esc(e.status)}">${esc(e.status)}</span>` },
        { labelText: T("tb.code"), render: (e) => esc(e.code) },
        { labelText: T("tb.message"), render: (e) => esc(e.message) },
        { labelText: T("q.evidence"), render: (e) => sourceButton(e.source_file, e.source_line, "Timestamp start|Timestamp end|Status|Code|Message") }], rows, { limit: 400 });
    const trs = document.querySelectorAll("#eventTable tbody tr");
    trs.forEach((tr, i) => {
        tr.classList.toggle("is-selected", state.event && rows[i].event_id === state.event.event_id);
        tr.addEventListener("click", (ev) => { if (!ev.target.closest(".kg-src")) selectEvent(rows[i]); });
    });
}

async function selectEvent(e) {
    state.event = e;
    renderEvents();
    state.window = await api("query/q3", { turbine: N, event_start: e.start });
    renderWindow();
}

/* ---------- signals around the selected alarm (query Q3) */
function renderWindow() {
    const note = document.getElementById("windowNote");
    const charts = document.getElementById("windowCharts");
    const tableEl = document.getElementById("windowTable");
    if (!state.window) return;
    const w = state.window;
    note.textContent = `${w.note} ${T("tb.timeAssoc")}`;
    charts.innerHTML = ""; tableEl.innerHTML = "";
    if (!w.rows.length) return;
    const sigCols = w.columns.filter((c) => c !== "time" && c !== "scada_source_line");
    const fromPart = partSignalColumns().filter((c) => sigCols.includes(c));
    const shown = fromPart.length ? fromPart : DEFAULT_SIGNALS.filter((c) => sigCols.includes(c));
    const cats = w.rows.map((r) => r.time.slice(11, 16));
    const alarm = state.event.start.slice(11, 16);
    const markCat = cats.filter((c) => c <= alarm).pop();
    charts.innerHTML = shown.map((_, i) => `<div class="kg-chart" style="height:160px" id="tw${i}"></div>`).join("");
    shown.forEach((col, i) => {
        const ch = chart(document.getElementById(`tw${i}`));
        const name = col.replace(/ \([^)]*\)$/, "");
        ch.setOption({ ...baseOption(), legend: { show: false }, grid: { left: 60, right: 20, top: 26, bottom: 24, containLabel: true },
            title: { text: L.label(name) + col.slice(name.length), textStyle: { color: "#CBD5E1", fontSize: 12 }, left: 4, top: 0 },
            xAxis: { type: "category", data: cats, ...axis }, yAxis: { type: "value", scale: true, ...axis }, color: [COLORS[i % COLORS.length]],
            series: [{ type: "line", data: w.rows.map((r) => r[col]), symbolSize: 5,
                markLine: markCat ? { symbol: "none", lineStyle: { color: "#EF4444", type: "dashed" }, label: { formatter: `⚠ ${state.event.start.slice(11)}`, color: "#fca5a5" }, data: [{ xAxis: markCat }] } : undefined }] }, true);
    });
    table(tableEl, [
        { key: "time", labelText: "time" },
        { labelText: T("q.evidence"), render: (r) => sourceButton(turbine.source_file, r.scada_source_line, shown.join("|")) },
        ...shown.map((c) => ({ labelText: c, num: true, render: (r) => fmt(r[c]) }))], w.rows);
}

function renderAll() { renderHeader(); renderPart(); renderCalendar(); renderEvents(); renderWindow(); }
renderAll();
L.onChange(renderAll);

/* start with the default Q3 alarm of the graph when it is on this turbine, otherwise the first alarm in scope */
const first = (meta.defaults.q3.turbine === N && events.find((e) => e.start === meta.defaults.q3.event_start))
    || events.find((e) => e.starts_in_scope !== false);
if (first) selectEvent(first);
