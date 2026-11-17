from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.kelmarsh import store
from app.paths import TEMPLATE_DIR


router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


def _page(request: Request, name: str, active: str, **context):
    # the turbines in the navigation come from the built graph (build_summary.json)
    return templates.TemplateResponse(request=request, name=name,
                                      context={"active": active, "turbines": store.scope_turbines(), **context})


@router.get("/", response_class=HTMLResponse)
def overview_page(request: Request):
    return _page(request, "overview.html", "overview")


@router.get("/turbine/{number}", response_class=HTMLResponse)
def turbine_page(request: Request, number: int):
    if number not in store.scope_turbines():
        raise HTTPException(status_code=404, detail=f"Kelmarsh {number} is not in the built graph")
    return _page(request, "turbine.html", "turbine", number=number)


@router.get("/structure", response_class=HTMLResponse)
def structure_page(request: Request):
    return _page(request, "structure.html", "structure")


@router.get("/queries", response_class=HTMLResponse)
def queries_page(request: Request):
    return _page(request, "queries.html", "queries")


@router.get("/statistics", response_class=HTMLResponse)
def statistics_page(request: Request):
    return _page(request, "statistics.html", "statistics")


@router.get("/checks", response_class=HTMLResponse)
def checks_page(request: Request):
    return _page(request, "checks.html", "checks")
