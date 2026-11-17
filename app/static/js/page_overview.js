(async () => {
    const { api, fmt, esc, chart, axis, baseOption, T } = window.kg;
    const L = window.kgI18n;
    const [o, meta] = await Promise.all([api("overview"), api("meta")]);
    const c = o.checks;
    document.getElementById("scopeLine").textContent =
        `${meta.turbines.map((t) => t.name).join(", ")} · ${meta.years.join(", ")} · ` +
        `${o.nodes_by_type.Signal} signals · ${o.nodes_by_type.EventCode} codes · Stop/Warning`;
    let nodeChart, edgeChart;

    function render() {
        const kpi = (label, value, sub, good) =>
            `<div class="kg-kpi ${good ? "is-good" : ""}"><span>${T(label)}</span><strong>${value}</strong><em>${T(sub) || ""}</em></div>`;
        document.getElementById("kpis").innerHTML = [
            kpi("ov.nodes", fmt(o.nodes), ""),
            kpi("ov.edges", fmt(o.edges), ""),
            kpi("ov.events", fmt(o.nodes_by_type.Event), "ov.eventsSub"),
            kpi("ov.observations", fmt(o.nodes_by_type.Observation), "ov.obsSub"),
            kpi("ov.problems", fmt(c.node_problems + c.edge_problems), "ov.problemsSub", c.node_problems + c.edge_problems === 0),
            kpi("ov.manual", `${c.manual_correct}/${c.sample_size}`, "ov.manualSub", c.manual_correct === c.sample_size),
        ].join("");

        document.getElementById("turbineCards").innerHTML = o.turbines.map((t) => `
            <article class="kg-panel kg-turbine-card">
                <header><h3>${esc(t.name)}</h3><span class="kg-muted kg-small">${T("ov.model")}: ${esc(t.model)} · <code>${esc(t.id)}</code></span></header>
                <div class="kg-facts">
                    <div><span>${T("ov.events")}</span><b>${fmt(t.events)}</b></div>
                    <div><span>${T("ov.stop")}</span><b>${fmt(t.stop)}</b></div>
                    <div><span>${T("ov.warning")}</span><b>${fmt(t.warning)}</b></div>
                    <div><span>${T("ov.alarmDays")}</span><b>${fmt(t.alarm_days)}</b></div>
                </div>
                <a class="kg-link" href="/turbine/${t.number}">${T("ov.view")}</a>
            </article>`).join("");

        document.getElementById("builtAt").textContent = o.built_at_utc;

        const bar = (el, data, color) => {
            const ch = el.__chart || (el.__chart = chart(el));
            const entries = Object.entries(data).sort((a, b) => a[1] - b[1]);
            ch.setOption({
                ...baseOption(), legend: { show: false }, grid: { left: 10, right: 60, top: 10, bottom: 10, containLabel: true },
                tooltip: { trigger: "item", formatter: (p) => `${esc(p.name)}: ${fmt(p.value)}` },
                xAxis: { type: "log", ...axis, axisLabel: { show: false } },
                yAxis: { type: "category", data: entries.map(([k]) => L.label(k)), ...axis },
                series: [{ type: "bar", data: entries.map(([, v]) => v), itemStyle: { color, borderRadius: [0, 4, 4, 0] },
                    label: { show: true, position: "right", color: "#CBD5E1", formatter: (p) => fmt(p.value) } }],
            }, true);
            return ch;
        };
        nodeChart = bar(document.getElementById("nodeChart"), o.nodes_by_type, "#38BDF8");
        edgeChart = bar(document.getElementById("edgeChart"), o.edges_by_type, "#F59E0B");
    }
    render();
    L.onChange(render);
})();
