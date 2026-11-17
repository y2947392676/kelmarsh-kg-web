"""Read-only access to the Kelmarsh Task 1 knowledge graph.

The graph, the checks and the queries belong to the course project `kelmarsh_kg`
(default: the sibling folder ../kelmarsh_kg, or the folder in KELMARSH_KG_DIR).
This module never changes that project: it loads its saved graph, imports its
query functions and reads its output files and source CSV files.
"""
from __future__ import annotations

import csv
import importlib
import json
import math
import os
import re
import sys
import threading
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

from app.paths import BASE_DIR

def _find_kg_dir() -> Path:
    """KELMARSH_KG_DIR, or the course project next to this folder: the local folder name
    `kelmarsh_kg` or the name of a fresh clone, `kelmarsh-wind-farm-kg`."""
    if os.environ.get("KELMARSH_KG_DIR"):
        return Path(os.environ["KELMARSH_KG_DIR"])
    for name in ("kelmarsh_kg", "kelmarsh-wind-farm-kg"):
        if (BASE_DIR.parent / name / "queries.py").exists():
            return BASE_DIR.parent / name
    return BASE_DIR.parent / "kelmarsh-wind-farm-kg"


KG_DIR = _find_kg_dir().resolve()

_lock = threading.Lock()
_graph = None
_modules = None


class KGUnavailable(RuntimeError):
    """The kelmarsh_kg project or its saved graph cannot be found."""


# ---------------------------------------------------------------- loading
def modules():
    """Import kg_common and queries from the kelmarsh_kg project (once)."""
    global _modules
    if _modules is None:
        if not (KG_DIR / "queries.py").exists():
            raise KGUnavailable(f"kelmarsh_kg not found at {KG_DIR}; set KELMARSH_KG_DIR")
        if str(KG_DIR) not in sys.path:
            sys.path.insert(0, str(KG_DIR))
        _modules = (importlib.import_module("kg_common"), importlib.import_module("queries"))
    return _modules


def graph():
    """The saved Task 1 graph (88 MB pickle), loaded on first use."""
    global _graph
    if _graph is None:
        with _lock:
            if _graph is None:
                kg_common, _ = modules()
                try:
                    _graph = kg_common.load_graph()
                except FileNotFoundError as exc:
                    raise KGUnavailable(f"{exc}. Run `python build.py` in {KG_DIR}.") from exc
    return _graph


def warm_up():
    """Load the graph in a background thread so the first page is fast."""
    def _load():
        try:
            graph()
        except KGUnavailable:
            pass
    threading.Thread(target=_load, daemon=True).start()


def is_loaded() -> bool:
    return _graph is not None


def _out(*parts) -> Path:
    return KG_DIR.joinpath("output", *parts)


def _clean(value):
    """JSON-safe value (NaN -> None)."""
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def _records(df):
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict("records")]


# ---------------------------------------------------------------- overview
@lru_cache(maxsize=1)
def build_summary() -> dict:
    return json.loads(_out("build_summary.json").read_text(encoding="utf-8"))


def scope_turbines() -> list[int]:
    """Turbine numbers of the built graph, from build_summary.json (no need to load the graph)."""
    try:
        keys = build_summary().get("alarm_days", {})
    except FileNotFoundError:
        return []
    return sorted(int(k.rsplit("_", 1)[1]) for k in keys)


def meta() -> dict:
    """What the built graph contains (turbines, years, alarm days) and sensible query defaults.
    Everything is read from the graph, so new turbines or years appear without code changes."""
    G = graph()
    q = modules()[1]
    tlist = turbines()
    days = {t["number"]: sorted(q.loaded_days(G, t["id"])) for t in tlist}
    years = sorted({d[:4] for ds in days.values() for d in ds})
    evs = events()
    in_scope = [e for e in evs if e["starts_in_scope"]]
    code_list = codes()
    # defaults: the Task 1 report examples when they exist in this graph, otherwise the first available values
    report_event = next((e for e in in_scope if e["turbine"] == "Kelmarsh 6" and e["start"] == "2021-02-05 08:33:07"), None)
    first_event = report_event or (in_scope[0] if in_scope else None)
    first_turbine = 6 if 6 in days else (tlist[0]["number"] if tlist else None)
    q1_day = "2021-02-05" if "2021-02-05" in days.get(first_turbine, []) else (days.get(first_turbine) or [None])[0]
    q2_code = 1050 if any(c["code"] == 1050 for c in code_list) else (code_list[0]["code"] if code_list else None)
    return {
        "turbines": [{"number": t["number"], "name": t["name"], "source_file": t["source_file"]} for t in tlist],
        "years": years,
        "loaded_days": {str(n): ds for n, ds in days.items()},
        "defaults": {
            "q1": {"turbine": first_turbine, "day": q1_day, "component": "gearbox"},
            "q2": {"code": q2_code},
            "q3": {"turbine": int(first_event["turbine"].split()[-1]) if first_event else None,
                   "event_start": first_event["start"] if first_event else None},
        },
    }


def check_results() -> dict:
    """Integrity results from check_report.md and the manual verdicts from the sample sheet."""
    text = _out("checks", "check_report.md").read_text(encoding="utf-8")

    def num(pattern):
        m = re.search(pattern, text)
        return int(m.group(1)) if m else None

    rebuild = re.search(r"```\n(\{.*?\})\n```", text, flags=re.S)
    rebuild = json.loads(rebuild.group(1)) if rebuild else {}
    sample = fact_sample()
    verdicts = Counter((r["human_verdict"] or "").strip().lower() for r in sample)
    return {
        "node_problems": num(r"Node problems[^:]*: (\d+)"),
        "edge_problems": num(r"Edge problems[^:]*: (\d+)"),
        "rejected_edges": num(r"Edges rejected during build: (\d+)"),
        "cardinality_ok": "Cardinality violations: none" in text,
        "conflicts": num(r"conflicting re-inserts of an existing id: (\d+)"),
        "duplicate_rows_skipped": num(r"Exact duplicate Stop/Warning rows skipped: (\d+)"),
        "identical_reinserts": num(r"Identical repeated inserts absorbed: \{'nodes': (\d+)"),
        "rebuild": rebuild,
        "auto_match": sum(1 for r in sample if str(r["auto_match"]).lower() == "true"),
        "sample_size": len(sample),
        "manual_filled": sum(v for k, v in verdicts.items() if k),
        "manual_correct": verdicts.get("correct", 0),
        "manual_wrong": verdicts.get("wrong", 0),
    }


def fact_sample() -> list[dict]:
    path = _out("checks", "fact_verification_sample.csv")
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def turbines() -> list[dict]:
    G = graph()
    out = []
    for tid, d in G.nodes(data=True):
        if d["type"] != "Turbine":
            continue
        status = Counter(G.nodes[v]["status"] for _, v, k in G.out_edges(tid, keys=True) if k == "HAS_EVENT")
        days = modules()[1].loaded_days(G, tid)
        out.append({"id": tid, "name": d["name"], "number": int(d["name"].split()[-1]),
                    "model": d["model"], "time_zone": d.get("time_zone"),
                    "source_file": d["source_file"], "source_line": d["source_line"],
                    "events": sum(status.values()), "stop": status.get("Stop", 0),
                    "warning": status.get("Warning", 0), "alarm_days": len(days)})
    return sorted(out, key=lambda t: t["number"])


def overview() -> dict:
    s = build_summary()
    return {"nodes": s["nodes"], "edges": s["edges"], "nodes_by_type": s["nodes_by_type"],
            "edges_by_type": s["edges_by_type"], "built_at_utc": s["built_at_utc"],
            "missing_values": s["log_counts"].get("missing_values"),
            "turbines": turbines(), "checks": check_results(), "kg_dir": str(KG_DIR)}


# ---------------------------------------------------------------- lists
def events(turbine: int | None = None, code: int | None = None, status: str | None = None,
           day: str | None = None) -> list[dict]:
    G = graph()
    rows = []
    for tid, eid, k in G.edges(keys=True):
        if k != "HAS_EVENT":
            continue
        t = G.nodes[tid]
        if turbine is not None and t["name"] != f"Kelmarsh {turbine}":
            continue
        e = G.nodes[eid]
        cid = next(v for _, v, kk in G.out_edges(eid, keys=True) if kk == "HAS_CODE")
        c = G.nodes[cid]
        if code is not None and c["code"] != code:
            continue
        if status and e["status"] != status:
            continue
        if day and not e["start"].startswith(day):
            continue
        rows.append({"event_id": eid, "turbine": t["name"], "status": e["status"], "start": e["start"],
                     "end": e["end"], "duration": e.get("duration"), "code": c["code"],
                     "message": c["message"], "starts_in_scope": e.get("starts_in_scope", True),
                     "source_file": e["source_file"], "source_line": e["source_line"]})
    return sorted(rows, key=lambda r: (r["turbine"], r["start"], r["source_line"]))


def codes() -> list[dict]:
    per = defaultdict(Counter)
    for e in events():
        per[(e["code"], e["message"])][(e["turbine"], e["status"])] += 1
    out = []
    for (code, msg), cnt in per.items():
        out.append({"code": code, "message": msg, "total": sum(cnt.values()),
                    "by_turbine": {t: sum(v for (tt, _), v in cnt.items() if tt == t) for t in {t for t, _ in cnt}},
                    "stop": sum(v for (_, s), v in cnt.items() if s == "Stop"),
                    "warning": sum(v for (_, s), v in cnt.items() if s == "Warning")})
    return sorted(out, key=lambda r: (-r["total"], r["code"]))


@lru_cache(maxsize=1)
def missing_by_signal() -> dict:
    counts = Counter()
    with open(_out("build_log", "missing_values.csv"), encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            counts[row.get("signal", "")] += 1
    return dict(counts)


def signals() -> list[dict]:
    G = graph()
    obs = Counter()
    for _, v, k in G.edges(keys=True):
        if k == "OF_SIGNAL":
            obs[v] += 1
    missing = missing_by_signal()
    out = []
    for sid, d in G.nodes(data=True):
        if d["type"] != "Signal":
            continue
        comp = next((v for _, v, k in G.out_edges(sid, keys=True) if k == "MEASURES_ON"), None)
        out.append({"id": sid, "name": d["name"], "unit": d["unit"], "scada_column": d.get("scada_column"),
                    "column_index": d.get("column_index"), "component": comp,
                    "component_name": G.nodes[comp]["name"] if comp else None,
                    "observations": obs[sid],
                    "missing": missing.get(sid, 0),
                    "source_file": d["source_file"], "source_line": d["source_line"]})
    return sorted(out, key=lambda r: r["name"])


def components() -> list[dict]:
    G = graph()
    out = []
    for cid, d in G.nodes(data=True):
        if d["type"] != "Component":
            continue
        sigs = []
        for sid, _, k in G.in_edges(cid, keys=True):
            if k == "MEASURES_ON":
                e = G.edges[sid, cid, k]
                sigs.append({"id": sid, "name": G.nodes[sid]["name"], "unit": G.nodes[sid]["unit"],
                             "evidence": e.get("evidence"), "justification": e.get("justification"),
                             "source_file": e["source_file"], "source_line": e["source_line"]})
        out.append({"id": cid, "name": d["name"], "signals": sorted(sigs, key=lambda s: s["name"])})
    return sorted(out, key=lambda c: c["id"])


def alarm_days(turbine: int) -> list[dict]:
    """Days on which Stop/Warning events start; `loaded` = SCADA rows of that day are in the graph
    (only alarm days inside the scope of the build are loaded)."""
    G = graph()
    loaded = modules()[1].loaded_days(G, f"turbine:Kelmarsh_{turbine}")
    per = defaultdict(Counter)
    for e in events(turbine=turbine):
        per[e["start"][:10]][e["status"]] += 1
    return [{"day": d, "stop": c.get("Stop", 0), "warning": c.get("Warning", 0), "loaded": d in loaded}
            for d, c in sorted(per.items())]


def statistics() -> dict:
    evs = events()
    by_month = defaultdict(Counter)
    for e in evs:
        if e["starts_in_scope"]:  # events that start inside the scope of the build (not the one open since 2020)
            by_month[e["start"][:7]][e["turbine"]] += 1
    return {"turbines": turbines(), "codes": codes()[:15], "signals": signals(),
            "events_by_month": [{"month": m, **dict(c)} for m, c in sorted(by_month.items())],
            "rejected_records": _read_csv(_out("build_log", "rejected_records.csv"))}


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


# ---------------------------------------------------------------- queries
PATHS = {
    "q1": ["Component", "Signal", "Observation", "Turbine"],
    "q2": ["EventCode", "Event", "Turbine"],
    "q3": ["Turbine", "Event", "Observation", "Signal"],
}


def run_query(name: str, **params) -> dict:
    G = graph()
    q = modules()[1]
    if name == "q1":
        df, note = q.q1(G, int(params.get("turbine", 6)), params.get("day", "2021-02-05"),
                        params.get("component", "gearbox"))
    elif name == "q2":
        df, note = q.q2(G, int(params.get("code", 1050)))
    elif name == "q3":
        df, note = q.q3(G, int(params.get("turbine", 6)), params.get("event_start", "2021-02-05 08:33:07"),
                        int(params.get("before_min", 60)), int(params.get("after_min", 30)))
    else:
        raise ValueError(f"unknown query {name}")
    return {"query": name, "params": params, "note": note, "columns": list(df.columns),
            "rows": _records(df), "count": len(df), "path": PATHS[name]}


# ---------------------------------------------------------------- evidence
def _allowed_source(file_name: str) -> Path:
    """Only the four Kelmarsh source files and the manual table may be opened."""
    kg_common, _ = modules()
    if file_name == kg_common.MANUAL_TABLE.name:
        return kg_common.MANUAL_TABLE
    if not re.fullmatch(r"(Turbine_Data|Status)_Kelmarsh_\d+_[0-9_\-]+\.csv", file_name):
        raise ValueError("not a Kelmarsh source file")
    path = (Path(kg_common.DATA_DIR) / file_name).resolve()
    if path.parent != Path(kg_common.DATA_DIR).resolve():
        raise ValueError("not a Kelmarsh source file")
    if not path.exists():
        raise FileNotFoundError(
            f"RAW_DATA_MISSING: {file_name} is not in {kg_common.DATA_DIR}. The raw data are not in the "
            "repository; download Kelmarsh_SCADA_2021_4456.zip from https://zenodo.org/records/16807551 "
            "and unzip it there (see the README of kelmarsh-wind-farm-kg).")
    return path


@lru_cache(maxsize=256)
def source_line(file_name: str, line: int) -> dict:
    """The cited line of a source file, split into fields and paired with the header."""
    path = _allowed_source(file_name)
    kg_common, _ = modules()
    if path == kg_common.MANUAL_TABLE:
        header_line, header = 1, None
    else:
        _, header_line, header = kg_common.read_header(path)
    text = None
    with open(path, encoding="utf-8") as fh:
        for i, raw in enumerate(fh, start=1):
            if header is None and i == header_line:
                header = next(csv.reader([raw.rstrip("\n")]))
            if i == line:
                text = raw.rstrip("\n")
                break
    if text is None:
        raise ValueError(f"{file_name} has fewer than {line} lines")
    values = next(csv.reader([text]))
    return {"file": file_name, "line": line, "header_line": header_line, "header": header,
            "values": values, "raw": text[:400]}
