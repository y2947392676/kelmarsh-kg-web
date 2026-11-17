# Kelmarsh Wind Farm Knowledge Graph — web front end

A web front end for the Task 1 knowledge graph of the course project
[kelmarsh-wind-farm-kg](https://github.com/y2947392676/kelmarsh-wind-farm-kg)
(SPbPU, Knowledge Engineering and Knowledge Management; author Wu Haoyang).
Every number shown comes from the Kelmarsh graph, and every fact can be traced to its source
file and line. The page framework (FastAPI, page theme, ECharts charts, 3D turbine viewer)
comes from the author's earlier wind-farm demo; its simulated data are not used.

中文简介：这是 Kelmarsh Task 1 知识图谱的网页前端。页面上的所有数字都来自 Kelmarsh 知识图谱，
每条事实都能追溯到原始文件的行号。页面框架（FastAPI、页面主题、ECharts 图表、3D 风机模型）
沿用作者之前的风电场演示项目，那个项目的模拟数据没有使用。

## 1. Install and start

This app reads the graph of the course project, so clone both repositories **into the same
folder**:

```bash
git clone https://github.com/y2947392676/kelmarsh-wind-farm-kg.git
git clone https://github.com/y2947392676/kelmarsh-kg-web.git
cd kelmarsh-kg-web
pip install -r requirements.txt
python main.py
```

Open http://127.0.0.1:8000 .

- No raw data are needed: on the first start the graph is rebuilt from the export committed
  in `kelmarsh-wind-farm-kg/output/` (about 10 s, then cached). After that, pages and queries
  answer within a second.
- The course project may also be in another folder: set `KELMARSH_KG_DIR` to it.
- `PORT=8765` chooses another port, `UVICORN_RELOAD=false` turns off auto-reload. Stop with Ctrl+C.
- The **evidence panel** (the cited line of the original CSV file) needs the raw Kelmarsh files.
  Download `Kelmarsh_SCADA_2021_4456.zip` from https://zenodo.org/records/16807551 and unzip it to
  `kelmarsh-wind-farm-kg/raw_data/Kelmarsh_SCADA_2021_4456/` (see that README). Without them,
  the panel says that the file is missing; everything else works.

## 2. Pages / 页面

| Page | Address | Content |
|---|---|---|
| Overview 概况 | `/` | Key numbers, scope, the turbines, links to the three questions, node and edge counts |
| Turbine 风机详情 | `/turbine/1`, `/turbine/6` | 3D model: click a part to see its real signals; alarm calendar; all alarm events; signals 60 min before and 30 min after the selected alarm |
| Structure 图谱结构 | `/structure` | Schema (6 node types, 5 relationships), component–signal links from the manual table, stable identifiers |
| Queries 查询 | `/queries` | Q1–Q3 with editable, searchable parameters, path diagram with real node ids, charts, result tables |
| Statistics 统计 | `/statistics` | Alarms per month, top alarm codes, observations and missing values per signal, records outside the scope |
| Data checks 数据检查 | `/checks` | Integrity checks, rebuild and repeated import, the 50 sampled facts with the author's manual verdicts |

**Searching in the queries.** Q1 suggests only the loaded alarm days of the chosen turbine
(with their alarm counts) and finds a component by English or Chinese words (`gear`, `发电机`).
Q2 finds a code by number or by words of its message (`gear` → 1700 "High temp. gear bearing 1").
Q3 has a search list of the turbine's alarms (date, code or message); click one to run the query.
Clicking an event in a Q2 result opens it in Q3.

Every result row has a source button (e.g. `Status K6 · L842`). It opens the **evidence
panel**: the cited line of the original CSV file, the cited fields highlighted and their
Excel cell addresses.

The JSON API is under `/api/kg/` (documentation at `/docs`). The queries call the functions
of the course project's `queries.py` directly, so the answers are the same as in the Task 1 report.

## 3. Adding data (more turbines or years)

The app has no fixed list of turbines, years, codes, components or signals: all of them are
read from the built graph.

1. In the course project, widen the scope (`TURBINES`, `SCOPE_YEAR` in `kg_common.py`; for other
   years also the matching Kelmarsh files) and run `python build.py && python checks.py`.
2. Restart this app (the graph is loaded once at start-up).

New turbines then appear in the navigation and in the query forms, new years in the alarm
calendar and the monthly statistics, new codes and components in the search lists. Two things
are maintained by hand: the Chinese labels of signal and component names (`kg_i18n.js`; new
names are shown in English only) and the link between 3D model parts and graph components
(`page_turbine.js`; a new component is linked when its id contains the part name, e.g.
`generator_cooling` → generator).

## 4. Tests

```bash
python -m pytest -q tests
```

`tests/test_kg_web.py` checks that every page loads and that the API returns the numbers of the
Task 1 report (414,506 nodes, 828,863 edges, Q2 = 10 events on lines 842–873, …).

## 5. Project layout

| Path | Content |
|---|---|
| `main.py` | FastAPI app |
| `app/kelmarsh/store.py` | Read-only access to the course project's graph, checks, queries and source files |
| `app/routers/kg_api.py`, `app/routers/pages.py` | JSON API and pages |
| `app/templates/` | Page templates (`base.html` + one per page) |
| `app/static/js/kg_i18n.js` | Chinese / English interface (data values are never translated) |
| `app/static/js/kg_app.js` | Shared helpers: API, tables, evidence panel, path diagram |
| `app/static/js/page_*.js` | One script per page |
| `app/static/js/turbine3d_app.js` | 3D turbine viewer (three.js) |
| `app/static/models/`, `app/static/vendor/` | 3D model files; ECharts, three.js and Draco decoder |

## 6. Use of LLMs

The code was written with Claude Code (model Claude Opus 5.5) on 2026-11-17 and checked by the
author. No graph fact comes from a model: the app only displays the course project's graph and
source files.
