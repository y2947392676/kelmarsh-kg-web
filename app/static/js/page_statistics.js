(async () => {
    const { api, fmt, esc, sourceButton, table, chart, axis, baseOption, T } = window.kg;
    const L = window.kgI18n;
    const s = await api("statistics");
    const mc = chart(document.getElementById("monthChart")), cc = chart(document.getElementById("codeChart"));
    const turbines = s.turbines.map((t) => t.name);

    function render() {
        mc.setOption({ ...baseOption(), xAxis: { type: "category", data: s.events_by_month.map((m) => m.month), ...axis },
            yAxis: { type: "value", ...axis },
            series: turbines.map((t) => ({ name: t, type: "bar", stack: "e", data: s.events_by_month.map((m) => m[t] || 0) })) }, true);

        const codes = [...s.codes].reverse();
        cc.setOption({ ...baseOption(), grid: { left: 10, right: 30, top: 30, bottom: 10, containLabel: true },
            xAxis: { type: "value", ...axis },
            yAxis: { type: "category", data: codes.map((c) => `${c.code} ${c.message.length > 34 ? c.message.slice(0, 33) + "…" : c.message}`), ...axis, axisLabel: { color: "#CBD5E1", fontSize: 11 } },
            series: [{ name: "Stop", type: "bar", stack: "c", data: codes.map((c) => c.stop), itemStyle: { color: "#EF4444" } },
                { name: "Warning", type: "bar", stack: "c", data: codes.map((c) => c.warning), itemStyle: { color: "#F59E0B" } }] }, true);

        table(document.getElementById("signalTable"), [
            { labelText: T("q.signal"), render: (r) => esc(L.label(r.name)) },
            { labelText: "id", render: (r) => `<code>${esc(r.id)}</code>` },
            { labelText: T("q.unit"), render: (r) => esc(r.unit) },
            { labelText: T("q.component"), render: (r) => (r.component ? esc(L.label(r.component)) : `<span class="kg-muted">${T("common.none")}</span>`) },
            { labelText: T("sa.observations"), num: true, render: (r) => fmt(r.observations) },
            { labelText: T("sa.missing"), num: true, render: (r) => fmt(r.missing) },
            { labelText: T("q.evidence"), render: (r) => sourceButton(r.source_file, r.source_line) }], s.signals);

        table(document.getElementById("rejectedTable"), [
            { labelText: T("evidence.file"), render: (r) => `<span class="kg-mono">${esc(r.source_file)}</span>` },
            { labelText: T("sa.reason"), render: (r) => esc(r.reason) }], s.rejected_records);
    }
    render();
    L.onChange(render);
})();
