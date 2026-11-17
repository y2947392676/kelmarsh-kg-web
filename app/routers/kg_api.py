"""JSON API over the Kelmarsh Task 1 knowledge graph (read-only)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.kelmarsh import store

router = APIRouter(prefix="/api/kg", tags=["kelmarsh-kg"])


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except store.KGUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/status")
def status():
    """Whether the graph is loaded yet (it is loaded in the background at start-up)."""
    return {"loaded": store.is_loaded(), "kg_dir": str(store.KG_DIR)}


@router.get("/meta")
def meta():
    """Turbines, years and loaded alarm days of the built graph, and default query parameters."""
    return _call(store.meta)


@router.get("/overview")
def overview():
    return _call(store.overview)


@router.get("/turbines")
def turbines():
    return _call(store.turbines)


@router.get("/events")
def events(turbine: int | None = None, code: int | None = None, status: str | None = None,
           day: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$")):
    return _call(store.events, turbine, code, status, day)


@router.get("/alarm-days/{turbine}")
def alarm_days(turbine: int):
    return _call(store.alarm_days, turbine)


@router.get("/codes")
def codes():
    return _call(store.codes)


@router.get("/signals")
def signals():
    return _call(store.signals)


@router.get("/components")
def components():
    return _call(store.components)


@router.get("/statistics")
def statistics():
    return _call(store.statistics)


@router.get("/checks")
def checks():
    return _call(lambda: {"results": store.check_results(), "sample": store.fact_sample()})


@router.get("/query/q1")
def query_q1(turbine: int = 6, day: str = Query("2021-02-05", pattern=r"^\d{4}-\d{2}-\d{2}$"),
             component: str = Query("gearbox", pattern=r"^[a-z_]+$")):
    return _call(store.run_query, "q1", turbine=turbine, day=day, component=component)


@router.get("/query/q2")
def query_q2(code: int = 1050):
    return _call(store.run_query, "q2", code=code)


@router.get("/query/q3")
def query_q3(turbine: int = 6,
             event_start: str = Query("2021-02-05 08:33:07", pattern=r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$"),
             before_min: int = Query(60, ge=0, le=720), after_min: int = Query(30, ge=0, le=720)):
    return _call(store.run_query, "q3", turbine=turbine, event_start=event_start,
                 before_min=before_min, after_min=after_min)


@router.get("/evidence")
def evidence(file: str, line: int = Query(..., ge=1)):
    """The cited line of a source CSV file, with its header."""
    return _call(store.source_line, file, line)
