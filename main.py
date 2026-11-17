import os
import socket

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.kelmarsh import store
from app.paths import STATIC_DIR
from app.routers.kg_api import router as kg_api_router
from app.routers.pages import router as pages_router


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


app = FastAPI(
    title="Kelmarsh Wind Farm Knowledge Graph",
    description="Web front end for the Kelmarsh Task 1 knowledge graph (real data, every fact cites its source line).",
    version="2.0.0",
)


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


app.include_router(pages_router)
app.include_router(kg_api_router)


@app.on_event("startup")
def load_graph_in_background() -> None:
    store.warm_up()


def get_requested_port(default: int = DEFAULT_PORT) -> int:
    raw_port = os.getenv("PORT") or os.getenv("WF_PORT")

    if not raw_port:
        return default

    try:
        port = int(raw_port)
    except ValueError as exc:
        raise ValueError("PORT/WF_PORT must be an integer.") from exc

    if not 1 <= port <= 65535:
        raise ValueError("PORT/WF_PORT must be between 1 and 65535.")

    return port


def is_port_available(port: int, host: str = DEFAULT_HOST) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        try:
            sock.bind((host, port))
        except OSError:
            return False

    return True


def resolve_server_port(host: str, requested_port: int, max_attempts: int = 20) -> int:
    upper_bound = min(65535, requested_port + max_attempts)

    for port in range(requested_port, upper_bound + 1):
        if is_port_available(port, host):
            return port

    raise RuntimeError(
        f"No available port found from {requested_port} to {upper_bound}."
    )


def should_reload() -> bool:
    raw_value = os.getenv("UVICORN_RELOAD") or os.getenv("WF_RELOAD") or "true"
    return raw_value.strip().lower() not in {"0", "false", "no", "off"}


def run_server() -> None:
    host = os.getenv("HOST") or os.getenv("WF_HOST") or DEFAULT_HOST
    requested_port = get_requested_port()
    port = resolve_server_port(host, requested_port)

    if port != requested_port:
        print(
            f"Port {requested_port} is unavailable on {host}; "
            f"starting on http://{host}:{port} instead."
        )

    print(f"Knowledge graph project: {store.KG_DIR}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=should_reload(),
    )


if __name__ == "__main__":
    run_server()
