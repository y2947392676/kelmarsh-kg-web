/* Interface language (zh / en). Only elements marked with data-i18n are translated;
   data values from the graph are never changed. Uses the same storage key as the
   original framework ("wf_language"). */
(() => {
    const KEY = "wf_language";
    const M = {
        zh: {
            "brand.title": "Kelmarsh 风电场知识图谱",
            "brand.real": "真实数据 · 每条事实注明来源行",
            "title.overview": "概况 · Kelmarsh 知识图谱", "title.turbine": "风机详情 · Kelmarsh 知识图谱",
            "title.structure": "图谱结构 · Kelmarsh 知识图谱", "title.queries": "查询 · Kelmarsh 知识图谱",
            "title.statistics": "统计 · Kelmarsh 知识图谱", "title.checks": "数据检查 · Kelmarsh 知识图谱",
            "nav.overview": "概况", "nav.structure": "图谱结构",
            "nav.queries": "查询", "nav.statistics": "统计", "nav.checks": "数据检查",
            "common.loadingGraph": "正在加载知识图谱（约 10 秒，只在启动后第一次）…",
            "common.source": "来源", "common.line": "行", "common.open": "原文", "common.none": "无",
            "common.rows": "行", "common.showing": "显示前", "common.of": "共",
            "evidence.title": "原文证据", "evidence.sub": "图谱事实所引用的原始 CSV 行",
            "evidence.file": "文件", "evidence.line": "行号", "evidence.header": "表头在第",
            "evidence.cited": "被引用的字段", "evidence.all": "这一行的全部字段", "evidence.raw": "原始文本（前 400 个字符）",
            "evidence.column": "列", "evidence.name": "列名", "evidence.value": "值",
            "evidence.hint": "可以用 Excel 打开该文件，在名称框输入单元格地址核对。", "evidence.missing": "这台电脑上没有原始数据文件，无法显示原文这一行。图谱事实本身不受影响；下载原始数据后即可查看。",
            /* overview */
            "ov.eyebrow": "Task 1 · 由结构化记录构建的初始知识图谱",
            "ov.title": "以报警为中心的 Kelmarsh 风电场知识图谱",
            "ov.lead": "风机的 Stop/Warning 报警、报警代码和所选 SCADA 信号的 10 分钟数值。每个节点和每条边都记录了它来自哪个文件的哪一行。", "ov.scope": "当前图谱范围",
            "ov.nodes": "节点", "ov.edges": "边", "ov.events": "报警事件", "ov.observations": "测量值",
            "ov.problems": "完整性问题", "ov.manual": "人工核对", "ov.manualSub": "抽样事实，全部正确",
            "ov.problemsSub": "ID、必填属性、关系类型", "ov.eventsSub": "Stop + Warning", "ov.obsSub": "报警日的 10 分钟数值",
            "ov.turbines": "风机", "ov.model": "型号", "ov.stop": "Stop", "ov.warning": "Warning",
            "ov.alarmDays": "报警日", "ov.view": "查看风机 →",
            "ov.nodeTypes": "节点类型", "ov.edgeTypes": "关系类型",
            "ov.questions": "计划中的三个问题", "ov.run": "运行查询 →",
            "ov.q1": "Q1. Kelmarsh 6 在报警日 2021-02-05 有哪些齿轮箱测量值？",
            "ov.q2": "Q2. 风机在什么时候报出过报警代码 1050？",
            "ov.q3": "Q3. Kelmarsh 6 在 2021-02-05 08:33:07 报警前后，传感器记录了什么？",
            "ov.data": "数据来源", "ov.dataText": "Kelmarsh wind farm data v4（Plumley & Takeuchi, Zenodo, DOI 10.5281/zenodo.16807551, CC BY 4.0）。",
            "ov.built": "图谱构建时间",
            /* turbine */
            "tb.eyebrow": "风机详情", "tb.view3d": "3D 模型：点部件，查看它的真实信号",
            "tb.part": "所选部件", "tb.pickPart": "在 3D 模型上点一个部件（齿轮箱、发电机、转子、主轴……）",
            "tb.noSignal": "这个部件在所选的 13 个信号中没有对应信号。", "tb.signals": "对应的信号",
            "tb.events": "报警事件", "tb.filterAll": "全部", "tb.calendar": "报警日历（颜色 = 当天报警数）",
            "tb.window": "报警前后的信号（前 60 分钟，后 30 分钟）", "tb.pickEvent": "在左侧列表中点一个报警事件",
            "tb.notLoaded": "未加载", "tb.start": "开始", "tb.status": "状态", "tb.code": "代码", "tb.message": "描述",
            "tb.timeAssoc": "这只是时间上的关联，不表示原因。",
            /* structure */
            "st.eyebrow": "图谱结构", "st.title": "图谱里存了什么、怎么连起来",
            "st.schema": "结构：6 类节点、5 种关系（括号内为数量）",
            "st.compSig": "部件与信号（MEASURES_ON，来自手工对应表）",
            "st.ids": "稳定标识符", "st.type": "节点类型", "st.idFrom": "标识符由什么构成", "st.example": "示例", "st.count": "数量",
            "st.manualNote": "虚线 = 手工对应表（evidence=manual）。风速和功率没有对应部件。",
            "st.components": "部件", "st.justification": "依据",
            /* queries */
            "q.eyebrow": "查询", "q.title": "回答计划中的三个问题",
            "q.tab1": "Q1 齿轮箱测量值", "q.tab2": "Q2 报警代码", "q.tab3": "Q3 报警前后的信号",
            "q.turbine": "风机", "q.day": "日期", "q.component": "部件", "q.code": "报警代码",
            "q.eventStart": "报警开始时间", "q.before": "之前（分钟）", "q.after": "之后（分钟）", "q.run": "运行",
            "q.path": "图谱中的路径", "q.start": "查询起点", "q.result": "结果", "q.note": "说明",
            "q.why1": "当报警指向传动链时，工程师先要知道当天有哪些齿轮箱数据。SCADA 文件本身不知道哪几列属于齿轮箱，这层联系来自 MEASURES_ON 边。",
            "q.why2": "从一个报警代码出发，找到它在所有风机上的每一次出现。代码是所有事件共用的一个节点，一步就能找到。",
            "q.why3": "找到一次报警后，看这台风机所有传感器在报警前后记录了什么。",
            "q.chart": "曲线", "q.summary": "按信号汇总", "q.signal": "信号", "q.unit": "单位", "q.values": "数值个数",
            "q.min": "最小值", "q.max": "最大值", "q.lines": "SCADA 行", "q.empty": "没有结果。",
            "q.evidence": "原文",
            "q.dayPh": "选择或输入日期", "q.searchPh": "输入搜索，例如 gear、齿轮", "q.codePh": "输入代码或描述搜索，例如 1050、gear、yaw",
            "q.search": "搜索报警", "q.eventPh": "日期、代码或描述，例如 2021-02-05、1050、gear",
            "q.daysHint": "这台风机有 {n} 个已加载的报警日（只有这些日子有 SCADA 数据）。", "q.dayNotLoaded": "{d} 不是已加载的报警日，请从列表中选择。",
            "q.codeResolved": "按“{q}”找到代码 {c}：{m}（共 {k} 个匹配，取第一个）。", "q.codeNotFound": "没有找到与“{q}”匹配的报警代码。",
            "q.compNotFound": "没有找到部件“{q}”。", "q.selectedEvent": "已选报警", "q.pickEvent": "在下面的列表中点一个报警事件。",
            "q.matches": "匹配的报警", "q.openQ3": "点一行，在 Q3 中查看它前后的信号",
            /* statistics */
            "sa.eyebrow": "统计", "sa.title": "报警和测量值的分布",
            "sa.byMonth": "每月报警事件数", "sa.topCodes": "最常见的 15 个报警代码",
            "sa.signals": "各信号的测量值和缺失值", "sa.observations": "测量值", "sa.missing": "缺失（NaN，未建节点）",
            "sa.outOfScope": "未导入的记录（超出范围，只计数）", "sa.reason": "原因",
            /* checks */
            "ck.eyebrow": "数据检查", "ck.title": "图谱是否一致、事实是否与原文相符",
            "ck.integrity": "完整性检查", "ck.nodeProblems": "节点问题（ID 前缀 / 必填属性 / 来源）",
            "ck.edgeProblems": "边问题（类型 / 端点存在 / 来源）", "ck.rejected": "构建时被拒绝的边",
            "ck.cardinality": "基数（每个测量值 1 台风机 1 个信号；每个事件 1 台风机 1 个代码）",
            "ck.conflicts": "已有 ID 的冲突值", "ck.dups": "被跳过的重复 Stop/Warning 行", "ck.reinserts": "被吸收的相同重复插入",
            "ck.rebuild": "重新构建与重复导入", "ck.rebuildSame": "从原始文件重新构建，节点、边和全部属性都相同",
            "ck.reimport": "再次导入 Status 文件后，节点数 / 边数", "ck.ok": "通过",
            "ck.sample": "50 条抽样事实（随机种子 42）", "ck.auto": "自动比较", "ck.manualCol": "人工判断",
            "ck.relationship": "关系", "ck.claim": "图谱说的", "ck.where": "原文位置", "ck.note": "备注",
            "ck.manualText": "人工核对由作者本人在 Excel 中打开原始 CSV 完成，判断写在 fact_verification_sample.csv 的 human_verdict 列。"
        },
        en: {
            "brand.title": "Kelmarsh Wind Farm Knowledge Graph",
            "brand.real": "Real data · every fact cites its source line",
            "title.overview": "Overview · Kelmarsh KG", "title.turbine": "Turbine · Kelmarsh KG",
            "title.structure": "Graph structure · Kelmarsh KG", "title.queries": "Queries · Kelmarsh KG",
            "title.statistics": "Statistics · Kelmarsh KG", "title.checks": "Data checks · Kelmarsh KG",
            "nav.overview": "Overview", "nav.structure": "Structure",
            "nav.queries": "Queries", "nav.statistics": "Statistics", "nav.checks": "Checks",
            "common.loadingGraph": "Loading the knowledge graph (about 10 s, only once after start-up)…",
            "common.source": "Source", "common.line": "line", "common.open": "Source", "common.none": "none",
            "common.rows": "rows", "common.showing": "Showing first", "common.of": "of",
            "evidence.title": "Source evidence", "evidence.sub": "The original CSV line cited by the graph fact",
            "evidence.file": "File", "evidence.line": "Line", "evidence.header": "Header on line",
            "evidence.cited": "Cited fields", "evidence.all": "All fields of this line", "evidence.raw": "Raw text (first 400 characters)",
            "evidence.column": "Column", "evidence.name": "Name", "evidence.value": "Value",
            "evidence.hint": "Open the file in Excel and type the cell address in the Name Box to check it.", "evidence.missing": "The raw data file is not on this computer, so the cited line cannot be shown. The graph facts are not affected; download the raw data to see the source line.",
            "ov.eyebrow": "Task 1 · initial knowledge graph from structured records",
            "ov.title": "Alarm-centred knowledge graph of the Kelmarsh wind farm",
            "ov.lead": "Stop/Warning alarms, alarm codes and the 10-minute values of the selected SCADA signals. Every node and edge records the file and line it comes from.", "ov.scope": "Scope of the current graph",
            "ov.nodes": "Nodes", "ov.edges": "Edges", "ov.events": "Alarm events", "ov.observations": "Observations",
            "ov.problems": "Integrity problems", "ov.manual": "Manual check", "ov.manualSub": "sampled facts, all correct",
            "ov.problemsSub": "ids, required properties, edge types", "ov.eventsSub": "Stop + Warning", "ov.obsSub": "10-minute values on alarm days",
            "ov.turbines": "Turbines", "ov.model": "Model", "ov.stop": "Stop", "ov.warning": "Warning",
            "ov.alarmDays": "Alarm days", "ov.view": "Open turbine →",
            "ov.nodeTypes": "Node types", "ov.edgeTypes": "Relationship types",
            "ov.questions": "The three planned questions", "ov.run": "Run query →",
            "ov.q1": "Q1. Which gearbox measurements exist for Kelmarsh 6 on the alarm day 2021-02-05?",
            "ov.q2": "Q2. When did the turbines report alarm code 1050?",
            "ov.q3": "Q3. What did the sensors record near the Kelmarsh 6 alarm at 2021-02-05 08:33:07?",
            "ov.data": "Data source", "ov.dataText": "Kelmarsh wind farm data v4 (Plumley & Takeuchi, Zenodo, DOI 10.5281/zenodo.16807551, CC BY 4.0).",
            "ov.built": "Graph built at",
            "tb.eyebrow": "Turbine", "tb.view3d": "3D model: click a part to see its real signals",
            "tb.part": "Selected part", "tb.pickPart": "Click a part in the 3D model (gearbox, generator, rotor, main shaft…)",
            "tb.noSignal": "None of the 13 selected signals belongs to this part.", "tb.signals": "Signals",
            "tb.events": "Alarm events", "tb.filterAll": "All", "tb.calendar": "Alarm calendar (colour = alarms per day)",
            "tb.window": "Signals around the alarm (60 min before, 30 min after)", "tb.pickEvent": "Click an alarm event in the list",
            "tb.notLoaded": "not loaded", "tb.start": "Start", "tb.status": "Status", "tb.code": "Code", "tb.message": "Message",
            "tb.timeAssoc": "This is a time association only, not a cause.",
            "st.eyebrow": "Graph structure", "st.title": "What the graph stores and how it is linked",
            "st.schema": "Schema: 6 node types, 5 relationship types (counts in brackets)",
            "st.compSig": "Components and signals (MEASURES_ON, from the manual table)",
            "st.ids": "Stable identifiers", "st.type": "Node type", "st.idFrom": "Identifier built from", "st.example": "Example", "st.count": "Count",
            "st.manualNote": "Dashed = manual starter table (evidence=manual). Wind speed and power have no component.",
            "st.components": "Components", "st.justification": "Justification",
            "q.eyebrow": "Queries", "q.title": "Answering the three planned questions",
            "q.tab1": "Q1 Gearbox measurements", "q.tab2": "Q2 Alarm code", "q.tab3": "Q3 Signals around an alarm",
            "q.turbine": "Turbine", "q.day": "Day", "q.component": "Component", "q.code": "Alarm code",
            "q.eventStart": "Alarm start", "q.before": "Before (min)", "q.after": "After (min)", "q.run": "Run",
            "q.path": "Path in the graph", "q.start": "query starts here", "q.result": "Result", "q.note": "Note",
            "q.why1": "When an alarm points to the drivetrain, an engineer first needs the gearbox data of that day. The SCADA file does not say which columns belong to the gearbox; this link comes from the MEASURES_ON edges.",
            "q.why2": "Start from an alarm code and find every occurrence on all turbines. The code is one node shared by all its events, so one step finds them all.",
            "q.why3": "After finding an alarm, see what all sensors of the turbine recorded before and after it.",
            "q.chart": "Chart", "q.summary": "Summary by signal", "q.signal": "Signal", "q.unit": "Unit", "q.values": "Values",
            "q.min": "Minimum", "q.max": "Maximum", "q.lines": "SCADA lines", "q.empty": "No result.",
            "q.evidence": "Source",
            "q.dayPh": "pick or type a day", "q.searchPh": "type to search, e.g. gear", "q.codePh": "type a code or words, e.g. 1050, gear, yaw",
            "q.search": "Search alarms", "q.eventPh": "date, code or message, e.g. 2021-02-05, 1050, gear",
            "q.daysHint": "This turbine has {n} loaded alarm days (only these days have SCADA data).", "q.dayNotLoaded": "{d} is not a loaded alarm day; choose one from the list.",
            "q.codeResolved": "\"{q}\" matched code {c}: {m} ({k} matches, first one used).", "q.codeNotFound": "No alarm code matches \"{q}\".",
            "q.compNotFound": "No component matches \"{q}\".", "q.selectedEvent": "Selected alarm", "q.pickEvent": "Click an alarm event in the list below.",
            "q.matches": "Matching alarms", "q.openQ3": "click a row to see the signals around it in Q3",
            "sa.eyebrow": "Statistics", "sa.title": "How alarms and measurements are distributed",
            "sa.byMonth": "Alarm events per month", "sa.topCodes": "The 15 most frequent alarm codes",
            "sa.signals": "Observations and missing values per signal", "sa.observations": "Observations", "sa.missing": "Missing (NaN, no node)",
            "sa.outOfScope": "Records not imported (outside the scope, counted only)", "sa.reason": "Reason",
            "ck.eyebrow": "Data checks", "ck.title": "Is the graph consistent, and do its facts match the sources?",
            "ck.integrity": "Integrity checks", "ck.nodeProblems": "Node problems (id prefix / required properties / provenance)",
            "ck.edgeProblems": "Edge problems (types / existing endpoints / provenance)", "ck.rejected": "Edges rejected during build",
            "ck.cardinality": "Cardinality (each observation 1 turbine and 1 signal; each event 1 turbine and 1 code)",
            "ck.conflicts": "Conflicting values for an existing id", "ck.dups": "Duplicate Stop/Warning rows skipped", "ck.reinserts": "Identical repeated inserts absorbed",
            "ck.rebuild": "Rebuild and repeated import", "ck.rebuildSame": "Rebuilt from the raw files: same nodes, edges and all properties",
            "ck.reimport": "Nodes / edges after importing the Status files again", "ck.ok": "pass",
            "ck.sample": "50 sampled facts (seed 42)", "ck.auto": "Automatic", "ck.manualCol": "Manual verdict",
            "ck.relationship": "Relationship", "ck.claim": "Graph claim", "ck.where": "Source location", "ck.note": "Note",
            "ck.manualText": "The manual check was done by the author, who opened the original CSV files in Excel; the verdicts are in the human_verdict column of fact_verification_sample.csv."
        }
    };

    /* Chinese labels shown next to the original (English) names from the data */
    const LABEL_ZH = {
        "Wind speed": "风速", "Power": "功率", "Rotor speed": "转子转速", "Generator RPM": "发电机转速",
        "Gearbox speed": "齿轮箱转速", "Gear oil temperature": "齿轮油温度", "Gear oil inlet temperature": "齿轮油入口温度",
        "Gear oil inlet pressure": "齿轮油入口压力", "Generator bearing front temperature": "发电机前轴承温度",
        "Generator bearing rear temperature": "发电机后轴承温度", "Rotor bearing temp": "转子轴承温度",
        "Drive train acceleration": "传动链加速度", "Tower Acceleration X": "塔架加速度 X",
        "component:rotor": "转子", "component:generator": "发电机", "component:gearbox": "齿轮箱",
        "component:generator_bearing": "发电机轴承", "component:rotor_bearing": "转子轴承",
        "component:drivetrain": "传动链", "component:tower": "塔架",
        "Turbine": "风机", "Event": "事件", "EventCode": "报警代码", "Observation": "测量值", "Signal": "信号", "Component": "部件"
    };

    const lang = () => {
        try { return localStorage.getItem(KEY) === "en" ? "en" : "zh"; } catch (e) { return "zh"; }
    };
    const t = (key) => M[lang()][key] ?? M.zh[key] ?? key;
    /* original name plus Chinese label in zh mode, e.g. "Gearbox speed · 齿轮箱转速" */
    const label = (name) => (lang() === "zh" && LABEL_ZH[name] ? `${name} · ${LABEL_ZH[name]}` : name);
    const zhOnly = (name) => (lang() === "zh" && LABEL_ZH[name] ? LABEL_ZH[name] : name);

    const listeners = new Set();
    function apply() {
        const l = lang();
        document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
        document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
        document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
        document.querySelectorAll("[data-language-choice]").forEach((b) => b.classList.toggle("is-active", b.dataset.languageChoice === l));
        const titleKey = document.querySelector("title")?.dataset.i18n;
        if (titleKey) document.title = t(titleKey);
        listeners.forEach((fn) => fn(l));
    }
    function set(l) {
        try { localStorage.setItem(KEY, l); } catch (e) { /* storage blocked */ }
        apply();
    }
    document.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-language-choice]");
        if (b) set(b.dataset.languageChoice);
    });
    window.kgI18n = { t, label, zhOnly, lang, apply, onChange: (fn) => listeners.add(fn) };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
