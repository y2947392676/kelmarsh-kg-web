(async () => {
    const { api, fmt, esc, sourceButton, table, T } = window.kg;
    const L = window.kgI18n;
    const { results: r, sample } = await api("checks");
    const pill = (ok, text) => `<span class="kg-status ${ok ? "ok" : "wrong"}">${esc(text)}</span>`;

    /* the column names the sample sheet cites, e.g. "column 1 (Date and time) | column 213 (Rotor speed (RPM))" */
    const citedNames = (where) => (where || "").split(" | ").map((p) => p.trim().replace(/^column \d+ \(/, "").replace(/\)$/, ""));

    function render() {
        const row = (label, value, ok) => `<tr><td>${T(label)}</td><td class="num">${value}</td><td>${pill(ok, ok ? T("ck.ok") : "!")}</td></tr>`;
        document.getElementById("integrity").innerHTML = `<table class="kg-table"><tbody>
            ${row("ck.nodeProblems", fmt(r.node_problems), r.node_problems === 0)}
            ${row("ck.edgeProblems", fmt(r.edge_problems), r.edge_problems === 0)}
            ${row("ck.rejected", fmt(r.rejected_edges), r.rejected_edges === 0)}
            ${row("ck.cardinality", r.cardinality_ok ? "0" : "≠0", r.cardinality_ok)}
            ${row("ck.conflicts", fmt(r.conflicts), r.conflicts === 0)}
            ${row("ck.dups", fmt(r.duplicate_rows_skipped), true)}
            ${row("ck.reinserts", fmt(r.identical_reinserts), true)}</tbody></table>`;
        const rb = r.rebuild || {};
        const same = rb.rebuild_identical_nodes && rb.rebuild_identical_edges && rb.rebuild_nodes_with_different_properties === 0 && rb.rebuild_edges_with_different_properties === 0;
        const n = rb.nodes_after_reimport || [], e = rb.edges_after_reimport || [];
        document.getElementById("rebuild").innerHTML = `<table class="kg-table"><tbody>
            <tr><td>${T("ck.rebuildSame")}</td><td>${pill(same, same ? T("ck.ok") : "!")}</td></tr>
            <tr><td>${T("ck.reimport")}</td><td class="num">${fmt(n[0])} → ${fmt(n[1])}<br>${fmt(e[0])} → ${fmt(e[1])}</td></tr></tbody></table>`;

        document.getElementById("sampleKpis").innerHTML = `
            <div class="kg-kpi"><span>${T("ck.sample")}</span><strong>${r.sample_size}</strong></div>
            <div class="kg-kpi is-good"><span>${T("ck.auto")}</span><strong>${r.auto_match}/${r.sample_size}</strong></div>
            <div class="kg-kpi is-good"><span>${T("ck.manualCol")}</span><strong>${r.manual_correct}/${r.sample_size}</strong></div>`;

        table(document.getElementById("sampleTable"), [
            { labelText: "#", render: (x) => sample.indexOf(x) + 1 },
            { labelText: T("ck.relationship"), render: (x) => `<code>${esc(x.relationship)}</code>` },
            { labelText: T("ck.claim"), render: (x) => esc(x.graph_claim) },
            { labelText: T("ck.where"), render: (x) => `<span class="kg-small kg-muted">${esc(x.source_columns)}</span>` },
            { labelText: T("ck.auto"), render: (x) => pill(String(x.auto_match).toLowerCase() === "true", String(x.auto_match)) },
            { labelText: T("ck.manualCol"), render: (x) => `<span class="kg-status ${esc((x.human_verdict || "").toLowerCase())}">${esc(x.human_verdict || "–")}</span>` },
            { labelText: T("ck.note"), render: (x) => esc(x.human_note) },
            { labelText: T("q.evidence"), render: (x) => sourceButton(x.source_file, x.source_line, citedNames(x.source_columns).join("|")) }], sample, { limit: 60 });
    }
    render();
    L.onChange(render);
})();
