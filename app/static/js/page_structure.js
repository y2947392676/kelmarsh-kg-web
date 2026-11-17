(async () => {
    const { api, fmt, esc, sourceButton, table, chart, T } = window.kg;
    const L = window.kgI18n;
    const [o, comps, sigs] = await Promise.all([api("overview"), api("components"), api("signals")]);
    const schemaEl = document.getElementById("schemaChart"), compEl = document.getElementById("compChart");
    const c1 = chart(schemaEl), c2 = chart(compEl);

    const IDS = [
        ["Turbine", "turbine name from the file header", "turbine:Kelmarsh_6"],
        ["Event", "turbine + line number in the Status file", "event:Kelmarsh_6:L842"],
        ["EventCode", "manufacturer code", "code:1050"],
        ["Observation", "turbine + timestamp + signal", "obs:Kelmarsh_6:2021-02-05T08:30:00:drive_train_acceleration"],
        ["Signal", "normalised SCADA column name", "signal:drive_train_acceleration"],
        ["Component", "name from the manual table", "component:gearbox"],
    ];
    const ID_ZH = { "turbine name from the file header": "文件头中的风机名", "turbine + line number in the Status file": "风机 + Status 文件中的行号",
        "manufacturer code": "制造商代码", "turbine + timestamp + signal": "风机 + 时间戳 + 信号", "normalised SCADA column name": "规范化的 SCADA 列名",
        "name from the manual table": "手工表中的名称" };

    function render() {
        const nb = o.nodes_by_type, eb = o.edges_by_type;
        const pos = { Turbine: [300, 40], Event: [110, 190], EventCode: [110, 340], Observation: [490, 190], Signal: [490, 340], Component: [300, 470] };
        const node = (n) => ({ name: n, x: pos[n][0], y: pos[n][1], value: nb[n], symbol: "roundRect", symbolSize: [150, 52],
            label: { show: true, formatter: `{b|${n}}\n${L.zhOnly(n) !== n ? L.zhOnly(n) + " · " : ""}${fmt(nb[n])}`, rich: { b: { fontWeight: "bold", fontSize: 13 } }, color: "#F8FAFC" },
            itemStyle: { color: "#121B30", borderColor: "#38BDF8", borderWidth: 1.5 } });
        const link = (s, t, rel, dashed) => ({ source: s, target: t, value: eb[rel], label: { show: true, formatter: `${rel}\n${fmt(eb[rel])}`, color: "#94A3B8", fontSize: 10.5 },
            lineStyle: { color: dashed ? "#F59E0B" : "#64748B", width: 1.6, type: dashed ? "dashed" : "solid", curveness: 0 } });
        c1.setOption({ tooltip: {}, series: [{ type: "graph", layout: "none", roam: true, edgeSymbol: ["none", "arrow"], edgeSymbolSize: 9,
            data: Object.keys(pos).map(node),
            links: [link("Turbine", "Event", "HAS_EVENT"), link("Event", "EventCode", "HAS_CODE"), link("Turbine", "Observation", "HAS_OBSERVATION"),
                link("Observation", "Signal", "OF_SIGNAL"), link("Signal", "Component", "MEASURES_ON", true)] }] }, true);

        const data = [], links = [];
        comps.forEach((c) => data.push({ name: c.id, category: 0, symbolSize: 34, label: { show: true, formatter: L.label(c.id), color: "#FDE68A" } }));
        sigs.forEach((s) => {
            data.push({ name: s.id, category: 1, symbolSize: 18, label: { show: true, formatter: L.label(s.name), color: "#CBD5E1", fontSize: 11 } });
            if (s.component) links.push({ source: s.id, target: s.component, lineStyle: { type: "dashed", color: "#F59E0B" } });
        });
        c2.setOption({ tooltip: { formatter: (p) => esc(p.name) }, legend: { data: [L.zhOnly("Component"), L.zhOnly("Signal")], textStyle: { color: "#CBD5E1" } },
            series: [{ type: "graph", layout: "force", roam: true, force: { repulsion: 260, edgeLength: [60, 120] },
                categories: [{ name: L.zhOnly("Component"), itemStyle: { color: "#F59E0B" } }, { name: L.zhOnly("Signal"), itemStyle: { color: "#38BDF8" } }],
                edgeSymbol: ["none", "arrow"], data, links }] }, true);

        table(document.getElementById("idTable"), [
            { labelText: T("st.type"), render: (r) => esc(L.label(r[0])) },
            { labelText: T("st.idFrom"), render: (r) => esc(L.lang() === "zh" ? ID_ZH[r[1]] : r[1]) },
            { labelText: T("st.example"), render: (r) => `<code>${esc(r[2])}</code>` },
            { labelText: T("st.count"), num: true, render: (r) => fmt(o.nodes_by_type[r[0]]) }], IDS);

        const rows = comps.flatMap((c) => c.signals.map((s) => ({ c, s })));
        table(document.getElementById("compTable"), [
            { labelText: T("q.component"), render: (r) => esc(L.label(r.c.id)) },
            { labelText: T("q.signal"), render: (r) => esc(L.label(r.s.name)) },
            { labelText: T("q.unit"), render: (r) => esc(r.s.unit) },
            { labelText: T("st.justification"), render: (r) => esc(r.s.justification) },
            { labelText: T("q.evidence"), render: (r) => sourceButton(r.s.source_file, r.s.source_line) }], rows);
    }
    render();
    L.onChange(render);
})();
