(async () => {
    const { api, fmt, esc, sourceButton, table, pathDiagram, chart, axis, baseOption, T } = window.kg;
    const L = window.kgI18n;
    const tf = (key, vars) => T(key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
    const [meta, components, codes, signals] = await Promise.all([api("meta"), api("components"), api("codes"), api("signals")]);
    const sigByName = Object.fromEntries(signals.map((s) => [s.name, s]));
    const sigByColumn = Object.fromEntries(signals.map((s) => [`${s.name} (${s.unit})`, s]));
    const scadaFile = Object.fromEntries(meta.turbines.map((t) => [String(t.number), t.source_file]));
    const D = meta.defaults;
    let current = null;
    const eventCache = {};
    const dayCache = {};

    const form = (q) => document.querySelector(`form[data-query="${q}"]`);
    const field = (q, name) => form(q).elements[name];

    /* ---------- turbine selects: from the graph */
    document.querySelectorAll(".kg-turbine-select").forEach((sel) => {
        sel.innerHTML = meta.turbines.map((t) => `<option value="${t.number}">${esc(t.name)}</option>`).join("");
    });
    field("q1", "turbine").value = D.q1.turbine;
    field("q1", "day").value = D.q1.day || "";
    field("q1", "component").value = D.q1.component;
    field("q2", "code").value = D.q2.code ?? "";
    field("q3", "turbine").value = D.q3.turbine ?? meta.turbines[0]?.number;
    let q3Event = D.q3.event_start ? { turbine: D.q3.turbine, start: D.q3.event_start } : null;

    /* ---------- Q1: loaded alarm days of the turbine, searchable components */
    async function loadedDays(n) {
        if (!dayCache[n]) dayCache[n] = (await api(`alarm-days/${n}`)).filter((d) => d.loaded);
        return dayCache[n];
    }
    async function fillQ1Days() {
        const n = field("q1", "turbine").value;
        const days = await loadedDays(n);
        document.getElementById("q1Days").innerHTML = days.map((d) =>
            `<option value="${d.day}">${d.stop + d.warning} × (Stop ${d.stop}, Warning ${d.warning})</option>`).join("");
        document.getElementById("q1Hint").textContent = tf("q.daysHint", { n: days.length });
        const dayInput = field("q1", "day");
        if (!days.some((d) => d.day === dayInput.value) && days.length) dayInput.value = days[0].day;
    }
    function fillQ1Components() {
        document.getElementById("q1Components").innerHTML = components.map((c) => {
            const short = c.id.split(":")[1];
            return `<option value="${esc(short)}">${esc(L.label(c.id))} · ${c.signals.map((s) => s.name).join(", ")}</option>`;
        }).join("");
    }
    function resolveComponent(text) {
        const q = text.trim().toLowerCase();
        const hit = components.find((c) => c.id.split(":")[1] === q)
            || components.find((c) => L.label(c.id).toLowerCase().includes(q) || c.id.includes(q.replace(/\s+/g, "_"))
                || c.signals.some((s) => s.name.toLowerCase().includes(q)));
        return hit ? hit.id.split(":")[1] : null;
    }
    field("q1", "turbine").addEventListener("change", fillQ1Days);

    /* ---------- Q2: codes searchable by number or message */
    function fillQ2Codes() {
        document.getElementById("q2Codes").innerHTML = codes.map((c) =>
            `<option value="${c.code}">${esc(c.message)} · ${c.total} × (${Object.entries(c.by_turbine).map(([t, k]) => `${t}: ${k}`).join(", ")})</option>`).join("");
    }
    function resolveCode(text) {
        const q = text.trim();
        if (/^\d+$/.test(q)) return { code: Number(q) };
        const hits = codes.filter((c) => c.message.toLowerCase().includes(q.toLowerCase()));
        return hits.length ? { code: hits[0].code, note: tf("q.codeResolved", { q, c: hits[0].code, m: hits[0].message, k: hits.length }) } : null;
    }

    /* ---------- Q3: searchable list of the turbine's alarms */
    async function turbineEvents(n) {
        if (!eventCache[n]) eventCache[n] = (await api("events", { turbine: n })).filter((e) => e.starts_in_scope !== false);
        return eventCache[n];
    }
    async function renderQ3Events() {
        const n = field("q3", "turbine").value;
        const q = field("q3", "search").value.trim().toLowerCase();
        const evs = (await turbineEvents(n)).filter((e) => !q || `${e.start} ${e.status} ${e.code} ${e.message}`.toLowerCase().includes(q));
        document.getElementById("q3Selected").innerHTML = q3Event
            ? `${T("q.selectedEvent")}: <b>Kelmarsh ${esc(q3Event.turbine)} · ${esc(q3Event.start)}</b>` : T("q.pickEvent");
        const el = document.getElementById("q3Events");
        table(el, [
            { labelText: T("tb.start"), render: (e) => esc(e.start) },
            { labelText: T("tb.status"), render: (e) => `<span class="kg-status ${esc(e.status)}">${esc(e.status)}</span>` },
            { labelText: T("tb.code"), render: (e) => esc(e.code) },
            { labelText: T("tb.message"), render: (e) => esc(e.message) }], evs, { limit: 60 });
        el.querySelector(".kg-table-wrap")?.style.setProperty("max-height", "260px");
        el.querySelectorAll("tbody tr").forEach((tr, i) => {
            tr.classList.toggle("is-selected", q3Event && evs[i].start === q3Event.start && String(q3Event.turbine) === n);
            tr.addEventListener("click", () => { q3Event = { turbine: Number(n), start: evs[i].start }; renderQ3Events(); run("q3"); });
        });
    }
    let searchTimer;
    field("q3", "search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderQ3Events, 150); });
    field("q3", "turbine").addEventListener("change", () => { field("q3", "search").value = ""; renderQ3Events(); });

    /* ---------- tabs and running */
    function showTab(name, autoRun = true) {
        document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
        document.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== name; });
        history.replaceState(null, "", `#${name}`);
        if (name === "q3") renderQ3Events();
        if (autoRun) run(name);
    }
    document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    document.querySelectorAll("form[data-query]").forEach((f) => f.addEventListener("submit", (e) => { e.preventDefault(); run(f.dataset.query); }));

    async function run(name) {
        const note = document.getElementById("queryNote");
        let params, hint = "";
        if (name === "q1") {
            const n = field("q1", "turbine").value, day = field("q1", "day").value.trim();
            const days = await loadedDays(n);
            if (!days.some((d) => d.day === day)) { note.textContent = tf("q.dayNotLoaded", { d: day }); return; }
            const comp = resolveComponent(field("q1", "component").value);
            if (!comp) { note.textContent = tf("q.compNotFound", { q: field("q1", "component").value }); return; }
            field("q1", "component").value = comp;
            params = { turbine: n, day, component: comp };
        } else if (name === "q2") {
            const r = resolveCode(field("q2", "code").value);
            if (!r) { note.textContent = tf("q.codeNotFound", { q: field("q2", "code").value }); return; }
            field("q2", "code").value = r.code;
            hint = r.note || "";
            document.getElementById("q2Hint").textContent = hint;
            params = { code: r.code };
        } else {
            if (!q3Event) { note.textContent = T("q.pickEvent"); return; }
            params = { turbine: q3Event.turbine, event_start: q3Event.start,
                before_min: field("q3", "before_min").value, after_min: field("q3", "after_min").value };
        }
        note.textContent = "…";
        current = await api(`query/${name}`, params);
        render();
    }

    /* Q2 result row -> open that alarm in Q3 */
    function openInQ3(row) {
        const n = Number(row.turbine.split(" ").pop());
        field("q3", "turbine").value = n;
        field("q3", "search").value = row.start.slice(0, 10);
        q3Event = { turbine: n, start: row.start };
        showTab("q3");
    }

    /* ---------- rendering of results */
    const statusPill = (s) => `<span class="kg-status ${esc(s)}">${esc(s)}</span>`;
    const obsId = (turbine, time, signalName) =>
        `obs:${turbine.replace(" ", "_")}:${time.replace(" ", "T")}:${(sigByName[signalName]?.id || "").replace("signal:", "")}`;

    function smallMultiples(el, rows, series, markTime) {
        /* the alarm line is drawn at the last 10-minute row at or before the alarm time */
        const cats = rows.map((r) => r.time.slice(11, 16));
        const markCat = markTime ? cats.filter((c) => c <= markTime).pop() : null;
        el.innerHTML = series.map((_, i) => `<div class="kg-chart" style="height:170px" id="sm${i}"></div>`).join("");
        series.forEach((s, i) => {
            const ch = chart(document.getElementById(`sm${i}`));
            ch.setOption({
                ...baseOption(), legend: { show: false }, grid: { left: 60, right: 20, top: 26, bottom: 24, containLabel: true },
                title: { text: L.label(s.label), textStyle: { color: "#CBD5E1", fontSize: 12 }, left: 4, top: 0 },
                xAxis: { type: "category", data: cats, ...axis },
                yAxis: { type: "value", scale: true, ...axis },
                series: [{ type: "line", data: rows.map((r) => r.value(s)), symbolSize: 5, lineStyle: { width: 2 },
                    markLine: markCat ? { symbol: "none", lineStyle: { color: "#EF4444", type: "dashed" },
                        label: { formatter: `⚠ ${markTime}`, color: "#fca5a5" }, data: [{ xAxis: markCat }] } : undefined }],
                color: [window.kg.COLORS[i % window.kg.COLORS.length]],
            }, true);
        });
    }

    function render() {
        if (!current) return;
        const r = current;
        document.getElementById("queryNote").textContent = r.note;
        document.getElementById("resultCount").textContent = `${fmt(r.count)} ${T("common.rows")}`;
        const extra = document.getElementById("resultExtra");
        const tableEl = document.getElementById("resultTable");
        const diagram = document.getElementById("pathDiagram");
        extra.innerHTML = "";

        if (r.query === "q1") {
            const p = r.params;
            const bySignal = {};
            r.rows.forEach((x) => { (bySignal[x.signal] ||= []).push(x); });
            const names = Object.keys(bySignal);
            pathDiagram(diagram, [
                { type: "Turbine", id: `turbine:Kelmarsh_${p.turbine}`, count: "1" },
                { type: "Observation", id: r.rows[0] ? obsId(r.rows[0].turbine, r.rows[0].time, r.rows[0].signal) : "–", count: `${fmt(r.count)} · ${p.day}` },
                { type: "Signal", id: names[0] ? sigByName[names[0]].id : "–", count: `${names.length}` },
                { type: "Component", id: `component:${p.component}`, count: "1" },
            ], [{ from: 0, to: 1, rel: "HAS_OBSERVATION" }, { from: 1, to: 2, rel: "OF_SIGNAL" }, { from: 2, to: 3, rel: "MEASURES_ON" }], 3);
            if (names.length) {
                const summary = names.map((n) => {
                    const v = bySignal[n].map((x) => x.value), lines = bySignal[n].map((x) => x.source_line);
                    return { signal: n, unit: bySignal[n][0].unit, values: v.length, min: Math.min(...v), max: Math.max(...v), lines: `${Math.min(...lines)}–${Math.max(...lines)}` };
                });
                extra.innerHTML = `<h4>${T("q.summary")}</h4><div id="q1sum"></div><h4>${T("q.chart")}</h4><div id="q1charts"></div><h4>${T("q.result")}</h4>`;
                table(document.getElementById("q1sum"), [
                    { label: "q.signal", render: (x) => esc(L.label(x.signal)) }, { key: "unit", label: "q.unit" },
                    { key: "values", label: "q.values", num: true }, { label: "q.min", num: true, render: (x) => fmt(x.min, 2) },
                    { label: "q.max", num: true, render: (x) => fmt(x.max, 2) }, { key: "lines", label: "q.lines" }], summary);
                const times = [...new Set(r.rows.map((x) => x.time))].sort();
                const lookup = {}; r.rows.forEach((x) => { lookup[`${x.signal}|${x.time}`] = x.value; });
                smallMultiples(document.getElementById("q1charts"), times.map((t) => ({ time: t, value: (s) => lookup[`${s.label}|${t}`] ?? null })),
                    names.map((n) => ({ label: n })));
            }
            table(tableEl, [
                { key: "time", labelText: "time" }, { labelText: "signal", render: (x) => esc(L.label(x.signal)) },
                { labelText: "value", num: true, render: (x) => fmt(x.value) }, { key: "unit", labelText: "unit" },
                { labelText: T("q.evidence"), render: (x) => sourceButton(x.source_file, x.source_line, sigByName[x.signal]?.scada_column) }], r.rows, { limit: 300 });
        }

        if (r.query === "q2") {
            const turbines = [...new Set(r.rows.map((x) => x.turbine))];
            pathDiagram(diagram, [
                { type: "Turbine", id: turbines.map((t) => `turbine:${t.replace(" ", "_")}`).join(", ") || "–", count: `${turbines.length}` },
                { type: "Event", id: r.rows.length ? `${r.rows[0].event_id} … ${r.rows[r.rows.length - 1].event_id}` : "–", count: `${fmt(r.count)}` },
                { type: "EventCode", id: `code:${r.params.code}`, count: r.rows[0] ? r.rows[0].message : "" },
            ], [{ from: 0, to: 1, rel: "HAS_EVENT" }, { from: 1, to: 2, rel: "HAS_CODE" }], 2);
            extra.innerHTML = r.rows.length ? `<p class="kg-muted kg-small">↓ ${T("q.openQ3")}</p>` : "";
            tableEl.classList.add("kg-clickable");
            table(tableEl, [
                { key: "turbine", labelText: "turbine" }, { labelText: "event_id", render: (x) => `<code>${esc(x.event_id)}</code>` },
                { labelText: "status", render: (x) => statusPill(x.status) }, { key: "start", labelText: "start" },
                { key: "end", labelText: "end" }, { key: "duration", labelText: "duration" },
                { key: "code", labelText: "code" }, { key: "message", labelText: "message" },
                { labelText: T("q.evidence"), render: (x) => sourceButton(x.source_file, x.source_line, "Timestamp start|Timestamp end|Status|Code|Message") }], r.rows);
            tableEl.querySelectorAll("tbody tr").forEach((tr, i) => tr.addEventListener("click", (e) => {
                if (!e.target.closest(".kg-src")) openInQ3(r.rows[i]);
            }));
        } else {
            tableEl.classList.remove("kg-clickable");
        }

        if (r.query === "q3") {
            const m = /Event (event:\S+)/.exec(r.note);
            const sigCols = r.columns.filter((c) => c !== "time" && c !== "scada_source_line");
            const t0 = r.rows[0];
            pathDiagram(diagram, [
                { type: "Event", id: m ? m[1] : "–", count: r.params.event_start },
                { type: "Turbine", id: `turbine:Kelmarsh_${r.params.turbine}`, count: "1" },
                { type: "Observation", id: t0 ? obsId(`Kelmarsh ${r.params.turbine}`, t0.time, sigByColumn[sigCols[0]]?.name) : "–", count: `${r.count} × ${sigCols.length}` },
                { type: "Signal", id: sigCols[0] ? sigByColumn[sigCols[0]]?.id : "–", count: `${sigCols.length}` },
            ], [{ from: 1, to: 0, rel: "HAS_EVENT" }, { from: 1, to: 2, rel: "HAS_OBSERVATION" }, { from: 2, to: 3, rel: "OF_SIGNAL" }], 1);
            if (r.rows.length) {
                const chosen = (window.__q3Signals ||= ["Drive train acceleration (mm/ss)", "Rotor speed (RPM)", "Power (kW)", "Wind speed (m/s)"]);
                extra.innerHTML = `<h4>${T("q.chart")}</h4><div class="kg-filter-row" id="q3chips">${sigCols.map((c) =>
                    `<button class="kg-chip ${chosen.includes(c) ? "is-active" : ""}" data-col="${esc(c)}">${esc(L.label(sigByColumn[c]?.name || c))}</button>`).join("")}</div><div id="q3charts"></div><h4>${T("q.result")}</h4>`;
                document.getElementById("q3chips").onclick = (e) => {
                    const b = e.target.closest("[data-col]"); if (!b) return;
                    const i = chosen.indexOf(b.dataset.col); i >= 0 ? chosen.splice(i, 1) : chosen.push(b.dataset.col); render();
                };
                smallMultiples(document.getElementById("q3charts"), r.rows.map((x) => ({ time: x.time, value: (s) => x[s.label] })),
                    chosen.filter((c) => sigCols.includes(c)).map((c) => ({ label: c })), r.params.event_start.slice(11, 16));
            }
            table(tableEl, [
                { key: "time", labelText: "time" },
                { labelText: T("q.evidence"), render: (x) => sourceButton(scadaFile[String(r.params.turbine)], x.scada_source_line, sigCols.join("|")) },
                ...sigCols.map((c) => ({ labelText: c, num: true, render: (x) => fmt(x[c]) }))], r.rows);
        }
    }

    fillQ1Components();
    fillQ2Codes();
    await fillQ1Days();
    L.onChange(() => { fillQ1Components(); fillQ2Codes(); fillQ1Days(); if (!document.querySelector('[data-pane="q3"]').hidden) renderQ3Events(); render(); });
    const start = (location.hash || "#q1").slice(1);
    showTab(/^q[123]$/.test(start) ? start : "q1");
})();
