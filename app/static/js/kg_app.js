/* Shared helpers for the Kelmarsh KG pages: API access, tables, source buttons,
   evidence drawer, query path diagram and chart defaults. */
(() => {
    const T = (k) => window.kgI18n.t(k);
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmt = (n, digits) => {
        if (n === null || n === undefined || n === "") return "–";
        if (typeof n !== "number") return esc(n);
        if (digits !== undefined) return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
        return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
    };

    /* ---------------------------------------------------------- API */
    const loading = () => document.getElementById("kgLoading");
    async function waitForGraph() {
        for (;;) {
            const s = await fetch("/api/kg/status").then((r) => r.json());
            if (s.loaded) { loading().hidden = true; return; }
            loading().hidden = false;
            await new Promise((r) => setTimeout(r, 1200));
        }
    }
    async function api(path, params = {}, { quiet = false } = {}) {
        const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined));
        const url = `/api/kg/${path}${qs.toString() ? `?${qs}` : ""}`;
        await waitForGraph();
        const r = await fetch(url);
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
            if (quiet) { const err = new Error(body.detail || url); err.status = r.status; throw err; }
            const box = document.getElementById("kgError");
            box.textContent = `${r.status}: ${body.detail ? JSON.stringify(body.detail) : url}`;
            box.hidden = false;
            throw new Error(box.textContent);
        }
        return body;
    }

    /* ---------------------------------------------------------- source buttons */
    function shortFile(file) {
        const m = /^(Turbine_Data|Status)_Kelmarsh_(\d+)/.exec(file || "");
        if (m) return `${m[1] === "Status" ? "Status" : "SCADA"} K${m[2]}`;
        return file && file.startsWith("manual") ? "manual" : (file || "");
    }
    /* cite = comma-separated column names that hold the fact (highlighted in the drawer) */
    function sourceButton(file, line, cite = "") {
        if (!file || !line) return "–";
        return `<button type="button" class="kg-src" data-file="${esc(file)}" data-line="${esc(line)}" data-cite="${esc(cite)}"
                 title="${esc(file)}, line ${esc(line)}">${esc(shortFile(file))} · L${esc(line)}</button>`;
    }

    /* ---------------------------------------------------------- evidence drawer */
    const colLetter = (n) => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
    function closeDrawer() {
        document.getElementById("evidenceDrawer").classList.remove("is-open");
        document.getElementById("evidenceOverlay").classList.remove("is-open");
    }
    async function openEvidence(file, line, cite) {
        const drawer = document.getElementById("evidenceDrawer");
        const body = document.getElementById("evidenceBody");
        body.innerHTML = `<div class="kg-muted">…</div>`;
        drawer.classList.add("is-open");
        document.getElementById("evidenceOverlay").classList.add("is-open");
        let ev;
        try {
            ev = await api("evidence", { file, line }, { quiet: true });
        } catch (err) {
            const msg = String(err.message).replace("RAW_DATA_MISSING: ", "");
            body.innerHTML = `<dl class="kg-dl"><dt>${T("evidence.file")}</dt><dd class="kg-mono">${esc(file)}</dd>
                <dt>${T("evidence.line")}</dt><dd class="kg-mono">${esc(line)}</dd></dl>
                <p class="kg-note">${T("evidence.missing")}</p><p class="kg-muted kg-small">${esc(msg)}</p>`;
            return;
        }
        const header = ev.header || [];
        const isStatus = file.startsWith("Status");
        const isScada = file.startsWith("Turbine_Data");
        let cited = (cite || "").split("|").map((s) => s.trim()).filter(Boolean);
        if (!cited.length) cited = isStatus ? ["Timestamp start", "Timestamp end", "Status", "Code", "Message"]
            : isScada ? ["Date and time"] : header.slice();
        if (isScada && !cited.includes("Date and time")) cited.unshift("Date and time");
        const row = (i) => `<tr class="${cited.includes(header[i]) ? "is-cited" : ""}"><td>${i + 1} (${colLetter(i + 1)})</td>
            <td>${esc(header[i] ?? "")}</td><td class="kg-mono">${esc(ev.values[i] ?? "")}</td></tr>`;
        const citedIdx = header.map((h, i) => (cited.includes(h) ? i : -1)).filter((i) => i >= 0);
        body.innerHTML = `
            <dl class="kg-dl">
                <dt>${T("evidence.file")}</dt><dd class="kg-mono">${esc(ev.file)}</dd>
                <dt>${T("evidence.line")}</dt><dd class="kg-mono">${ev.line} <span class="kg-muted">(${T("evidence.header")} ${ev.header_line})</span></dd>
            </dl>
            <h4>${T("evidence.cited")}</h4>
            <table class="kg-table kg-table-tight"><thead><tr><th>${T("evidence.column")}</th><th>${T("evidence.name")}</th><th>${T("evidence.value")}</th></tr></thead>
            <tbody>${citedIdx.map(row).join("")}</tbody></table>
            <p class="kg-muted kg-small">${T("evidence.hint")} ${citedIdx.length ? `→ ${citedIdx.map((i) => colLetter(i + 1) + ev.line).join(", ")}` : ""}</p>
            <details><summary>${T("evidence.all")} (${ev.values.length})</summary>
                <table class="kg-table kg-table-tight"><tbody>${ev.values.map((_, i) => row(i)).join("")}</tbody></table></details>
            <h4>${T("evidence.raw")}</h4><pre class="kg-raw">${esc(ev.raw)}</pre>`;
    }
    document.addEventListener("click", (e) => {
        const b = e.target.closest(".kg-src");
        if (b) { openEvidence(b.dataset.file, b.dataset.line, b.dataset.cite); return; }
        if (e.target.id === "evidenceClose" || e.target.id === "evidenceOverlay") closeDrawer();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

    /* ---------------------------------------------------------- tables */
    /* columns: [{key, label (i18n key or text), render(row) -> html, num: bool}] */
    function table(el, columns, rows, { limit = 200, empty = "q.empty" } = {}) {
        if (!rows.length) { el.innerHTML = `<p class="kg-muted">${T(empty)}</p>`; return; }
        const shown = rows.slice(0, limit);
        const head = columns.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.labelText ?? T(c.label))}</th>`).join("");
        const body = shown.map((r) => `<tr>${columns.map((c) => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r) : (c.num ? fmt(r[c.key]) : esc(r[c.key]))}</td>`).join("")}</tr>`).join("");
        const more = rows.length > limit ? `<p class="kg-muted kg-small">${T("common.showing")} ${limit} ${T("common.rows")}, ${T("common.of")} ${rows.length}.</p>` : "";
        el.innerHTML = `<div class="kg-table-wrap"><table class="kg-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
    }

    /* ---------------------------------------------------------- query path diagram */
    /* nodes: [{type, id, count}], arrows: [{from, to, rel}] in stored edge direction, start: index */
    function pathDiagram(el, nodes, arrows, start) {
        const L = window.kgI18n;
        const cells = [];
        nodes.forEach((n, i) => {
            cells.push(`<div class="kg-path-node ${i === start ? "is-start" : ""}">
                ${i === start ? `<span class="kg-path-start">${T("q.start")}</span>` : ""}
                <strong>${esc(n.type)}</strong><span class="kg-muted kg-small">${esc(L.zhOnly(n.type) !== n.type ? L.zhOnly(n.type) : "")}</span>
                <code>${esc(n.id)}</code><em>${esc(n.count ?? "")}</em></div>`);
            if (i < nodes.length - 1) {
                const a = arrows.find((x) => (x.from === i && x.to === i + 1) || (x.from === i + 1 && x.to === i));
                cells.push(`<div class="kg-path-edge"><span>${esc(a ? a.rel : "")}</span><b>${a && a.from > a.to ? "←" : "→"}</b></div>`);
            }
        });
        el.innerHTML = `<div class="kg-path">${cells.join("")}</div>`;
    }

    /* ---------------------------------------------------------- charts */
    const COLORS = ["#38BDF8", "#F59E0B", "#10B981", "#EF4444", "#A78BFA", "#F472B6", "#94A3B8", "#FACC15", "#2DD4BF", "#FB923C", "#60A5FA", "#C084FC", "#4ADE80"];
    function chart(el) {
        const c = echarts.init(el, null, { renderer: "canvas" });
        window.addEventListener("resize", () => c.resize());
        return c;
    }
    const axis = { axisLine: { lineStyle: { color: "#334155" } }, axisLabel: { color: "#94A3B8" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } };
    const baseOption = () => ({ color: COLORS, textStyle: { color: "#CBD5E1" }, tooltip: { trigger: "axis", backgroundColor: "#0E1424", borderColor: "#334155", textStyle: { color: "#F8FAFC" } },
        legend: { textStyle: { color: "#CBD5E1" }, type: "scroll" }, grid: { left: 56, right: 24, top: 40, bottom: 40, containLabel: true } });

    window.kg = { api, esc, fmt, sourceButton, openEvidence, table, pathDiagram, chart, axis, baseOption, COLORS, colLetter, T };
})();
