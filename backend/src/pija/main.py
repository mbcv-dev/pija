from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pija.db import make_engine, make_sessionmaker
from pija.routers.dimensoes_router import router as dimensoes_router
from pija.routers.eventos_router import router as eventos_router
from pija.routers.gargalos_router import router as gargalos_router
from pija.routers.kpis_router import router as kpis_router
from pija.settings import Settings

_settings = Settings()

_DESCRIPTION = """
**PIJA — Plataforma Integrada da Jornada Assistencial**

API analítica que expõe indicadores sobre a jornada do paciente no HC-UFPE.
Os dados são provenientes das views do AGHU (sistema hospitalar) carregadas via ETL.

## Recursos disponíveis

- **Eventos** — lista paginada de eventos clínicos (consultas, exames, internações, cirurgias…)
- **KPIs** — tempos médios de espera e permanência ao longo da jornada
- **Gargalos** — ranking de unidades/especialidades com maior tempo de espera

> Esta API é **somente leitura**. Nenhum dado é gravado ou alterado no AGHU.
"""

_TAGS_METADATA = [
    {
        "name": "eventos",
        "description": "Listagem paginada de eventos da jornada assistencial registrados no banco local.",
    },
    {
        "name": "kpis",
        "description": "Indicadores de desempenho calculados sobre os tempos médios da jornada do paciente.",
    },
    {
        "name": "gargalos",
        "description": "Ranking de unidades e especialidades com maior tempo médio de espera entre eventos.",
    },
    {
        "name": "infra",
        "description": "Endpoints de infraestrutura e monitoramento da aplicação.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = make_engine(f"sqlite+aiosqlite:///{_settings.sqlite_path}")
    app.state.session_factory = make_sessionmaker(engine)
    yield
    await engine.dispose()


app = FastAPI(
    title="PIJA",
    version="0.1.0",
    description=_DESCRIPTION,
    contact={
        "name": "Time 2 — Perspectiva Assistencial",
        "url": "https://github.com/cin-ufpe/pija",
    },
    license_info={"name": "Uso interno HC-UFPE"},
    openapi_tags=_TAGS_METADATA,
    lifespan=lifespan,
)

_cors_origins = _settings.cors_origins_list()
_cors_regex = _settings.cors_origins_regex or None
if _cors_origins or _cors_regex:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_origin_regex=_cors_regex,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=False,
    )

app.include_router(eventos_router, prefix="/api/v1")
app.include_router(kpis_router, prefix="/api/v1")
app.include_router(gargalos_router, prefix="/api/v1")
app.include_router(dimensoes_router, prefix="/api/v1")


@app.get(
    "/health",
    tags=["infra"],
    summary="Verificação de saúde",
    description="Retorna `200 OK` enquanto o servidor estiver no ar. Use para monitoramento e health checks.",
    response_description="Status da aplicação",
)
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "pija-backend"}
