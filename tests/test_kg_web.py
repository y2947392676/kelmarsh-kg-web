"""Web front end of the Kelmarsh Task 1 graph: pages load and the API returns the
numbers of the Task 1 report (output of the kelmarsh_kg project)."""
import pytest
from fastapi.testclient import TestClient

from app.kelmarsh import store
from main import app

pytestmark = pytest.mark.skipif(not (store.KG_DIR / "output" / "nodes.csv.gz").exists(),
                                reason="course project kelmarsh-wind-farm-kg not found next to this folder")


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.mark.parametrize("path", ["/", "/turbine/1", "/turbine/6", "/structure", "/queries", "/statistics", "/checks"])
def test_pages_load(client, path):
    r = client.get(path)
    assert r.status_code == 200
    assert "Kelmarsh" in r.text


def test_unknown_turbine_page(client):
    assert client.get("/turbine/3").status_code == 404


def test_navigation_lists_the_built_turbines(client):
    """Turbines in the navigation come from the built graph, not from the code."""
    assert store.scope_turbines() == [1, 6]
    html = client.get("/").text
    assert 'href="/turbine/1"' in html and 'href="/turbine/6"' in html


def test_meta_comes_from_the_graph(client):
    m = client.get("/api/kg/meta").json()
    assert [t["number"] for t in m["turbines"]] == [1, 6]
    assert m["years"] == ["2021"]
    assert (len(m["loaded_days"]["1"]), len(m["loaded_days"]["6"])) == (109, 118)
    assert m["defaults"]["q1"] == {"turbine": 6, "day": "2021-02-05", "component": "gearbox"}
    assert m["defaults"]["q2"] == {"code": 1050}
    assert m["defaults"]["q3"] == {"turbine": 6, "event_start": "2021-02-05 08:33:07"}


def test_monthly_statistics_use_events_in_scope(client):
    months = client.get("/api/kg/statistics").json()["events_by_month"]
    assert sum(m.get("Kelmarsh 1", 0) + m.get("Kelmarsh 6", 0) for m in months) == 547 - 2


def test_overview_matches_report(client):
    o = client.get("/api/kg/overview").json()
    assert (o["nodes"], o["edges"]) == (414506, 828863)
    t = {x["name"]: (x["stop"], x["warning"], x["alarm_days"]) for x in o["turbines"]}
    assert t == {"Kelmarsh 1": (132, 179, 109), "Kelmarsh 6": (117, 119, 118)}
    c = o["checks"]
    assert (c["node_problems"], c["edge_problems"], c["rejected_edges"]) == (0, 0, 0)
    assert c["cardinality_ok"] and c["auto_match"] == 50


def test_q1_gearbox(client):
    q = client.get("/api/kg/query/q1").json()
    assert q["count"] == 576
    lines = [r["source_line"] for r in q["rows"]]
    assert (min(lines), max(lines)) == (5051, 5194)


def test_q1_day_not_loaded(client):
    q = client.get("/api/kg/query/q1", params={"day": "2021-02-06"}).json()
    assert q["count"] == 0 and "not loaded" in q["note"]


def test_q2_code_1050_and_1700(client):
    q = client.get("/api/kg/query/q2").json()
    assert q["count"] == 10
    assert {r["turbine"] for r in q["rows"]} == {"Kelmarsh 6"}
    assert [r["source_line"] for r in q["rows"]][0] == 842 and q["rows"][-1]["source_line"] == 873
    assert [r["source_line"] for r in client.get("/api/kg/query/q2", params={"code": 1700}).json()["rows"]] == [593, 1661, 13351]


def test_q3_window(client):
    q = client.get("/api/kg/query/q3").json()
    assert q["count"] == 9 and len(q["columns"]) == 2 + 13
    row = next(r for r in q["rows"] if r["scada_source_line"] == 5102)
    assert round(row["Drive train acceleration (mm/ss)"], 2) == 6.24


def _raw_data_present() -> bool:
    kg_common, _ = store.modules()
    return any(kg_common.DATA_DIR.glob("Status_Kelmarsh_6_*.csv")) if kg_common.DATA_DIR.exists() else False


def test_evidence_without_raw_data_explains(client):
    if _raw_data_present():
        pytest.skip("raw data present")
    r = client.get("/api/kg/evidence", params={"file": "Status_Kelmarsh_6_2021-01-01_-_2022-01-01_233.csv", "line": 842})
    assert r.status_code == 404 and "zenodo" in r.json()["detail"]


def test_evidence_reads_the_cited_line(client):
    if not _raw_data_present():
        pytest.skip("raw Kelmarsh files not downloaded")
    e = client.get("/api/kg/evidence", params={"file": "Status_Kelmarsh_6_2021-01-01_-_2022-01-01_233.csv", "line": 842}).json()
    fields = dict(zip(e["header"], e["values"]))
    assert fields["Timestamp start"] == "2021-02-05 08:33:07"
    assert (fields["Status"], fields["Code"], fields["Message"]) == ("Warning", "1050", "Drivetrain oscillations")


@pytest.mark.parametrize("name", ["../../main.py", "main.py", "Status_Kelmarsh_6_x/../../secret.csv"])
def test_evidence_refuses_other_files(client, name):
    assert client.get("/api/kg/evidence", params={"file": name, "line": 1}).status_code in (400, 404)


def test_lists(client):
    assert len(client.get("/api/kg/codes").json()) == 58
    assert len(client.get("/api/kg/signals").json()) == 13
    comps = client.get("/api/kg/components").json()
    assert len(comps) == 7 and sum(len(c["signals"]) for c in comps) == 11
    assert len(client.get("/api/kg/events", params={"turbine": 6}).json()) == 236
    days = client.get("/api/kg/alarm-days/6").json()
    assert sum(d["loaded"] for d in days) == 118
