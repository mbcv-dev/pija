# Indicadores gráficos (histograma de tempos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada KPI de tempo ganha um histograma da distribuição (SVG à mão, no card, sempre visível) mostrando a cauda que a mediana esconde, alimentado por um endpoint batch novo `GET /api/v1/kpis/distribuicoes` que reusa os `.sql` existentes.

**Architecture:** Backend: os `.sql` de `sql/kpis/` já são produtores de linhas `(dimensao, valor)`; um novo envelope `_DIST_SQL` (análogo ao `_MEDIAN_SQL`) bucketiza `valor` em 16 baldes lineares de 0 a p95 + 1 balde de cauda `≥ p95`, numa passada. Frontend: segunda chamada desacoplada no `useKpiStore` (falha não derruba os cards) + componente burro `HistogramaTempos.vue` renderizado pelo `KpiCard` (inclusive na submétrica KPI-07B, o caso-âncora).

**Tech Stack:** FastAPI + SQLAlchemy async + SQLite (backend); Vue 3 + TS + Pinia + zod + SVG à mão (frontend); pytest / vitest.

**Spec:** [docs/superpowers/specs/2026-08-03-indicadores-graficos-design.md](../specs/2026-08-03-indicadores-graficos-design.md) — decisões travadas, NÃO re-perguntar.

---

## Prompt de abertura (colar na sessão de implementação)

> Execute o plano em `docs/superpowers/plans/2026-08-03-indicadores-graficos.md` com a skill
> superpowers:subagent-driven-development (ou executing-plans), na ordem das tasks. As decisões da
> spec (`docs/superpowers/specs/2026-08-03-indicadores-graficos-design.md`) estão travadas — não
> re-perguntar. Crie a branch `feat/indicadores-graficos` a partir de `main`. Na Task 5 (SVG), o
> implementador DEVE invocar a skill `dataviz` antes de codar. Verifique no browser com o backend
> real (comandos na seção "Como rodar"). Não commitar o banco (repo público + dado de paciente).

## Contexto essencial do repo (leia antes da Task 1)

- **Criar branch** `feat/indicadores-graficos` a partir de `main` (não trabalhar em main).
- **Testes:** backend `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q` (160 hoje) · frontend `cd frontend; npx vitest run` (126 hoje) e `npm run type-check`. NÃO regredir.
- **Rodar em dev (PowerShell):**
  ```powershell
  cd backend; $env:SQLITE_PATH="./data/pija_demo.db"; $env:JWT_SECRET="dev-secret-not-for-production-min-32-chars"; $env:CORS_ORIGINS="http://localhost:5173,http://localhost:5174"; .\venv\Scripts\python.exe -m uvicorn pija.main:app --app-dir src --host 127.0.0.1 --port 8000
  cd frontend; $env:VITE_USE_MOCK="false"; $env:VITE_API_BASE_URL="http://127.0.0.1:8000"; npm run dev
  ```
  Ao terminar, encerrar os servidores (portas 8000/5173). A 1ª carga do dashboard leva segundos (base de 2,26M eventos) — normal.
- **Backend, arquitetura obrigatória:** `.sql → Provider → Controller → Router → Schema` + teste (SPEC.md §3-4). Filtros multivalor via `pija.sql_filtros.build_filtros`. O `kpis_provider.py` tem o molde: `KPI_META` (code → sql), `KPI_GRUPO_SCOPE`, `KPI_DIM_PREFIX`, envelope `_MEDIAN_SQL` com `{base}`. Teste de provider usa a fixture `fixture_db_session` (ver `backend/tests/test_kpis.py` — helpers `_kpis`/`_bd`).
- **Frontend:** tipos + schemas zod em `frontend/src/types/api.types.ts` (`KpiResponseSchema.parse` no service); services centralizados em `src/services/api.ts` com camada mock (`USE_MOCK` + `mockKpis`); `useKpiStore` com `initWatcher` re-buscando quando `useFilterStore.activeFilters` muda. `KpiCard.vue` recebe `{ kpi, submetric? }`; a submétrica KPI-07B renderiza num bloco próprio dentro do card do KPI-07. **Atenção:** `AreaNav.vue` observa `kpiStore.loading` (comentário no store avisa) — a nova busca de distribuições NÃO deve mexer nesse `loading`.
- **Unidade dos valores:** cada `.sql` produz `valor` na unidade nativa do KPI (KPI-07B em horas — confirme lendo `sql/kpis/kpi_07b.sql`). A distribuição herda a unidade; nenhuma conversão.
- Comentários/JSDoc em português explicando o porquê. Commits: imperativa, corpo explica o porquê, sem `Co-Authored-By`, **sem acentos** na mensagem.
- **Não commitar `backend/data/`** (banco com dado de paciente; repo público).

---

### Task 1: Backend — schema + provider `get_distribuicoes`

**Files:**
- Modify: `backend/src/pija/schemas/kpis_schema.py`
- Modify: `backend/src/pija/providers/kpis_provider.py`
- Create: `backend/tests/test_kpis_distribuicoes.py`

- [ ] **Step 1: Write the failing tests**

Criar `backend/tests/test_kpis_distribuicoes.py`:

```python
import pytest

from pija.providers.kpis_provider import KpisProvider, _N_BUCKETS
from pija.sql_filtros import Filtros


async def _dist(session, **filtro_kwargs):
    filtros = Filtros(
        unidade=filtro_kwargs.get("unidade"),
        especialidade=filtro_kwargs.get("especialidade"),
        grupo=filtro_kwargs.get("grupo"),
        data_inicio=filtro_kwargs.get("data_inicio"),
        data_fim=filtro_kwargs.get("data_fim"),
    )
    result = await KpisProvider(session).get_distribuicoes(kpi_codes=None, filtros=filtros)
    return {d.codigo: d for d in result.distribuicoes}


class TestDistribuicoes:
    async def test_retorna_todos_os_codigos(self, fixture_db_session):
        dists = await _dist(fixture_db_session)
        assert set(dists) == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07", "KPI-07B"}

    async def test_contagens_somam_n_total(self, fixture_db_session):
        for d in (await _dist(fixture_db_session)).values():
            assert sum(b.n for b in d.buckets) == d.n_total

    async def test_n_total_bate_com_tempos_medios(self, fixture_db_session):
        # A distribuição usa as MESMAS linhas do cálculo da mediana.
        from pija.schemas.common import GroupBy
        provider = KpisProvider(fixture_db_session)
        kpis = {k.codigo: k for k in (await provider.get_kpis(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(
                unidade=None, especialidade=None, grupo=None, data_inicio=None, data_fim=None,
            ))).kpis}
        for codigo, d in (await _dist(fixture_db_session)).items():
            assert d.n_total == kpis[codigo].n_global

    async def test_baldes_lineares_cobrem_0_a_p95_e_cauda_e_aberta(self, fixture_db_session):
        for d in (await _dist(fixture_db_session)).values():
            if d.n_total == 0 or d.p95 is None or d.p95 <= 0:
                continue
            lineares = [b for b in d.buckets if b.ate is not None]
            cauda = [b for b in d.buckets if b.ate is None]
            assert len(cauda) == 1 and cauda[0].de == pytest.approx(d.p95)
            assert lineares[0].de == pytest.approx(0.0)
            assert lineares[-1].ate == pytest.approx(d.p95)
            assert len(lineares) == _N_BUCKETS
            # contíguos: o fim de um é o começo do próximo
            for a, b in zip(lineares, lineares[1:]):
                assert a.ate == pytest.approx(b.de)

    async def test_p50_bate_com_a_mediana_do_tempos_medios(self, fixture_db_session):
        from pija.schemas.common import GroupBy
        provider = KpisProvider(fixture_db_session)
        kpis = {k.codigo: k for k in (await provider.get_kpis(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(
                unidade=None, especialidade=None, grupo=None, data_inicio=None, data_fim=None,
            ))).kpis}
        for codigo, d in (await _dist(fixture_db_session)).items():
            if d.n_total == 0:
                assert d.p50 is None
            else:
                assert d.p50 == pytest.approx(kpis[codigo].media_global)

    async def test_filtro_restringe(self, fixture_db_session):
        tudo = await _dist(fixture_db_session)
        # Use uma unidade que exista na fixture (ver test_kpis.py; ajuste o valor
        # ao dataset da fixture — o teste deve reduzir n_total de ao menos 1 KPI).
        recorte = await _dist(fixture_db_session, unidade=["UAC: BIOQUÍMICA"])
        assert any(
            recorte[c].n_total < tudo[c].n_total
            for c in tudo if tudo[c].n_total > 0
        )

    async def test_kpi_sem_dados_vem_vazio(self, fixture_db_session):
        # Recorte impossível → todo KPI zera, com buckets [].
        vazio = await _dist(fixture_db_session, unidade=["__NAO_EXISTE__"])
        for d in vazio.values():
            assert d.n_total == 0 and d.buckets == [] and d.p50 is None and d.p95 is None
```

> Nota: em `test_filtro_restringe`, confira em `backend/tests/test_kpis.py`/fixtures qual unidade
> existe no dataset de teste e ajuste o literal se necessário — o objetivo é o recorte reduzir
> `n_total`, não o valor específico da unidade.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis_distribuicoes.py -q`
Expected: FAIL — `ImportError: cannot import name '_N_BUCKETS'` (ou `AttributeError: get_distribuicoes`).

- [ ] **Step 3: Schema**

Em `backend/src/pija/schemas/kpis_schema.py`, adicionar ao final:

```python
class DistBucket(BaseModel):
    de: float = Field(description="Limite inferior do balde (inclusivo), na unidade do KPI.")
    ate: float | None = Field(None, description="Limite superior (exclusivo). `null` = balde de cauda aberta (>= p95).")
    n: int = Field(description="Número de casos no balde.")


class KpiDistribuicao(BaseModel):
    codigo: str = Field(description="Código do KPI.", examples=["KPI-07B"])
    unidade_tempo: str = Field(default="dias", description="Unidade dos valores (mesma do KPI).")
    p50: float | None = Field(None, description="Mediana. `null` sem dados.")
    p95: float | None = Field(None, description="Percentil 95 (teto dos baldes lineares). `null` sem dados.")
    n_total: int = Field(0, description="Total de casos no recorte.")
    buckets: list[DistBucket] = Field(default_factory=list, description="Baldes em ordem: lineares 0→p95 e por último a cauda (ate=null).")


class DistribuicoesResponse(BaseModel):
    distribuicoes: list[KpiDistribuicao] = Field(description="Uma distribuição por KPI solicitado.")
```

- [ ] **Step 4: Provider**

Em `backend/src/pija/providers/kpis_provider.py`:

(a) Importar os schemas novos junto aos existentes:

```python
from pija.schemas.kpis_schema import (
    DistBucket,
    DistribuicoesResponse,
    KpiBreakdownItem,
    KpiDistribuicao,
    KpiResult,
    KpisResponse,
)
```

(b) Extrair a montagem do SQL-base (hoje inline no `compute`) para um helper — DRY entre mediana e
distribuição. Adicionar ao `KpisProvider`:

```python
    def _base_sql(self, code: str, group_by: GroupBy, filtros: Filtros) -> tuple[str, dict]:
        """Monta o produtor de linhas (dimensao, valor) do KPI com filtros/escopo aplicados."""
        sql_name, _ = KPI_META[code]
        col = GROUP_COL[group_by]
        prefix = KPI_DIM_PREFIX.get(code, "")
        frag, fparams = build_filtros(filtros, prefix=prefix)
        base = (
            load_sql(sql_name)
            .replace("{group_col}", col)
            .replace("{grupo_scope}", self._scope_fragment(code))
            .replace("{filtros}", frag)
        )
        params = {**fparams, "data_inicio": filtros.data_inicio, "data_fim": filtros.data_fim}
        return base, params
```

E no `compute`, substituir o bloco equivalente por `base, params = self._base_sql(code, group_by, filtros)`
(o comportamento não muda; os testes existentes de `test_kpis*.py` cobrem a regressão).

(c) Constante + envelope de distribuição (módulo, perto do `_MEDIAN_SQL`):

```python
# Baldes lineares entre 0 e p95; o que passa de p95 cai num único balde de cauda.
# O cap em p95 existe porque a cauda é o objeto de interesse: sem ele, um único
# outlier esmagaria todos os demais baldes num histograma ilegível.
_N_BUCKETS = 16

_DIST_SQL = """
WITH base AS (
{base}
),
ranked AS (
  SELECT valor,
         ROW_NUMBER() OVER (ORDER BY valor) AS rn,
         COUNT(*)     OVER ()               AS cnt
  FROM base
  WHERE valor IS NOT NULL
),
stats AS (
  SELECT
    (SELECT AVG(valor) FROM ranked WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2)) AS p50,
    (SELECT valor FROM ranked WHERE rn = MAX(1, (cnt * 95 + 99) / 100) LIMIT 1) AS p95,
    (SELECT MAX(cnt) FROM ranked)                                               AS n_total
)
SELECT
  CASE
    WHEN s.p95 IS NULL OR s.p95 <= 0 THEN 0
    WHEN r.valor >= s.p95 THEN :n_buckets
    ELSE CAST(r.valor * :n_buckets / s.p95 AS INTEGER)
  END            AS idx,
  COUNT(*)       AS n,
  MAX(s.p50)     AS p50,
  MAX(s.p95)     AS p95,
  MAX(s.n_total) AS n_total
FROM ranked r CROSS JOIN stats s
GROUP BY idx
ORDER BY idx
"""
```

(d) Método novo no `KpisProvider`:

```python
    async def get_distribuicoes(
        self, *, kpi_codes: list[str] | None, filtros: Filtros
    ) -> DistribuicoesResponse:
        """Distribuição dos tempos por KPI (histograma). O group_by não importa aqui —
        a coluna `dimensao` do produtor de linhas é ignorada; usamos `unidade` só
        para satisfazer o placeholder {group_col}."""
        codes = kpi_codes or ALL_KPIS
        out: list[KpiDistribuicao] = []
        for code in codes:
            base, params = self._base_sql(code, GroupBy.unidade, filtros)
            rows = (await self._session.execute(
                text(_DIST_SQL.format(base=base)), {**params, "n_buckets": _N_BUCKETS},
            )).all()

            por_idx: dict[int, int] = {}
            p50 = p95 = None
            n_total = 0
            for r in rows:
                m = r._mapping
                por_idx[int(m["idx"])] = int(m["n"])
                p50 = float(m["p50"]) if m["p50"] is not None else None
                p95 = float(m["p95"]) if m["p95"] is not None else None
                n_total = int(m["n_total"] or 0)

            buckets: list[DistBucket] = []
            if n_total > 0 and p95 is not None and p95 > 0:
                largura = p95 / _N_BUCKETS
                # Lineares (preenche baldes vazios com n=0 — o histograma é contínuo)…
                buckets = [
                    DistBucket(de=i * largura, ate=(i + 1) * largura, n=por_idx.get(i, 0))
                    for i in range(_N_BUCKETS)
                ]
                # …e a cauda aberta por último.
                buckets.append(DistBucket(de=p95, ate=None, n=por_idx.get(_N_BUCKETS, 0)))
            elif n_total > 0:
                # Degenerado (p95 <= 0: todos os valores são 0) — um balde só.
                buckets = [DistBucket(de=0.0, ate=0.0, n=n_total)]

            out.append(KpiDistribuicao(
                codigo=code,
                unidade_tempo=KPI_UNIDADE_TEMPO.get(code, "dias"),
                p50=p50 if n_total else None,
                p95=p95 if n_total else None,
                n_total=n_total,
                buckets=buckets,
            ))
        return DistribuicoesResponse(distribuicoes=out)
```

- [ ] **Step 5: Run tests**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis_distribuicoes.py tests/test_kpis.py -q`
Expected: PASS (novos + regressão da refatoração `_base_sql`). Depois a suíte completa: `...\python.exe -m pytest -q` → 160 + novos.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/schemas/kpis_schema.py backend/src/pija/providers/kpis_provider.py backend/tests/test_kpis_distribuicoes.py
git commit -m "feat(kpis): distribuicao dos tempos por KPI no provider" -m "Envelope _DIST_SQL bucketiza os mesmos .sql produtores de linhas: 16 baldes lineares 0..p95 + cauda aberta (>= p95). O cap em p95 existe porque a cauda e o objeto de interesse -- sem ele um outlier esmaga o histograma. Extrai _base_sql compartilhado com o compute (mediana). Caso degenerado p95<=0 vira balde unico."
```

---

### Task 2: Backend — controller + rota `/kpis/distribuicoes`

**Files:**
- Modify: `backend/src/pija/controllers/kpis_controller.py`
- Modify: `backend/src/pija/routers/kpis_router.py`
- Test: adicionar casos de API em `backend/tests/test_kpis_distribuicoes.py`

- [ ] **Step 1: Write the failing test** (na classe nova, no mesmo arquivo de teste; siga o padrão
de teste de API usado em `backend/tests/` — procure um teste que use o client HTTP async, ex.:
`test_api_*.py` ou como `test_kpis_multiselect.py` chama a API — e replique o setup):

```python
class TestDistribuicoesApi:
    async def test_endpoint_devolve_distribuicoes(self, fixture_api_client):
        resp = await fixture_api_client.get("/api/v1/kpis/distribuicoes")
        assert resp.status_code == 200
        dados = resp.json()["distribuicoes"]
        assert {d["codigo"] for d in dados} == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07", "KPI-07B"}

    async def test_kpi_codes_invalido_da_400(self, fixture_api_client):
        resp = await fixture_api_client.get("/api/v1/kpis/distribuicoes", params={"kpi_codes": "KPI-99"})
        assert resp.status_code == 400
```

> Se o nome real da fixture do client for outro (`client`, `async_client`…), use o existente.

- [ ] **Step 2: Run to verify it fails** — 404 na rota.

- [ ] **Step 3: Controller** — em `kpis_controller.py`, adicionar (mesmos params do `get_kpis`,
menos `group_by`, que a distribuição não usa):

```python
async def get_distribuicoes(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs (repita o parâmetro). Default: todos."),
    unidade: list[str] | None = Query(None, description="Restringe a uma ou mais unidades."),
    especialidade: list[str] | None = Query(None, description="Restringe a uma ou mais especialidades."),
    grupo: list[str] | None = Query(None, description="Restringe a um ou mais grupos assistenciais."),
    data_inicio: date | None = Query(None, description="Eventos a partir desta data (YYYY-MM-DD)."),
    data_fim: date | None = Query(None, description="Eventos até esta data (YYYY-MM-DD)."),
    session: AsyncSession = Depends(get_db),
) -> DistribuicoesResponse:
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")
    filtros = Filtros(
        unidade=unidade, especialidade=especialidade, grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
    return await KpisProvider(session).get_distribuicoes(kpi_codes=kpi_codes, filtros=filtros)
```

(importar `DistribuicoesResponse` de `pija.schemas.kpis_schema`).

- [ ] **Step 4: Rota** — em `kpis_router.py`:

```python
from pija.controllers.kpis_controller import get_distribuicoes, get_kpis
from pija.schemas.kpis_schema import DistribuicoesResponse, KpisResponse
...
router.add_api_route(
    "/kpis/distribuicoes",
    get_distribuicoes,
    methods=["GET"],
    response_model=DistribuicoesResponse,
    summary="Distribuição dos tempos por KPI (histograma)",
    description=(
        "Histograma dos tempos de cada KPI: 16 baldes lineares de 0 a p95 e um balde de cauda "
        "aberta (>= p95). Mostra a cauda que a mediana do /tempos-medios esconde. "
        "Mesmos filtros do /tempos-medios."
    ),
    response_description="Uma distribuição (baldes + p50/p95) por KPI solicitado",
)
```

- [ ] **Step 5: Run** — arquivo novo + suíte completa do backend. Expected: tudo PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/controllers/kpis_controller.py backend/src/pija/routers/kpis_router.py backend/tests/test_kpis_distribuicoes.py
git commit -m "feat(kpis): endpoint GET /kpis/distribuicoes" -m "Batch como o /tempos-medios (todos os codigos numa requisicao), mesmos filtros, kpi_codes invalido da 400. Cadeia .sql -> provider -> controller -> router -> schema mantida."
```

---

### Task 3: Frontend — tipos zod + service + mock

**Files:**
- Modify: `frontend/src/types/api.types.ts`
- Modify: `frontend/src/services/api.ts` (e o módulo de mocks que ele usa — localize `mockKpis` e coloque o novo mock ao lado)
- Test: `frontend/src/services/api.test.ts` só se já existir padrão de teste de service; senão a validação fica nos testes de store (Task 4)

- [ ] **Step 1: Tipos + schema zod** — em `api.types.ts`, seguindo o padrão dos schemas existentes
(localize `KpiResponseSchema` e replique o estilo):

```ts
export const DistBucketSchema = z.object({
  de: z.number(),
  ate: z.number().nullable(), // null = balde de cauda aberta (≥ p95)
  n: z.number(),
})
export const KpiDistribuicaoSchema = z.object({
  codigo: KpiCodeSchema, // reuse o schema/enum de código existente; se não houver, z.string()
  unidade_tempo: z.enum(['dias', 'horas']),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  n_total: z.number(),
  buckets: z.array(DistBucketSchema),
})
export const DistribuicoesResponseSchema = z.object({
  distribuicoes: z.array(KpiDistribuicaoSchema),
})
export type DistBucket = z.infer<typeof DistBucketSchema>
export type KpiDistribuicao = z.infer<typeof KpiDistribuicaoSchema>
export type DistribuicoesResponse = z.infer<typeof DistribuicoesResponseSchema>
```

> Ajuste `KpiCodeSchema`/`z.enum` ao que o arquivo realmente tem — leia antes. O tipo `KpiCode` já existe.

- [ ] **Step 2: Service** — em `services/api.ts`, ao lado do `getKpis`:

```ts
/**
 * GET /api/v1/kpis/distribuicoes — histograma dos tempos por KPI.
 * Mesmos filtros do getKpis; group_by não se aplica.
 */
export async function getDistribuicoes(params: Omit<KpiParams, 'group_by'>): Promise<DistribuicoesResponse> {
  if (USE_MOCK) {
    await delay(300)
    return mockDistribuicoes()
  }
  const { data } = await client.get<DistribuicoesResponse>('/kpis/distribuicoes', { params })
  return DistribuicoesResponseSchema.parse(data)
}
```

Mock (junto do `mockKpis`): devolver distribuições plausíveis para os 6 códigos — 16 baldes lineares
decrescentes + cauda pequena, `p50`/`p95` coerentes. Suficiente para o dev com `VITE_USE_MOCK=true`.

- [ ] **Step 3: Verify** — `cd frontend; npm run type-check` limpo. (Comportamento é coberto na Task 4.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/api.types.ts frontend/src/services/api.ts <arquivo-de-mock-se-separado>
git commit -m "feat(front): service e tipos da distribuicao de tempos" -m "getDistribuicoes espelha o getKpis (mesmos filtros, sem group_by), com schema zod e mock."
```

---

### Task 4: Frontend — `useKpiStore` busca distribuições desacoplada

**Files:**
- Modify: `frontend/src/stores/useKpiStore.ts`
- Create: `frontend/src/stores/useKpiStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { KpiDistribuicao } from '@/types/api.types'

const dist = (codigo: string): KpiDistribuicao => ({
  codigo: codigo as KpiDistribuicao['codigo'], unidade_tempo: 'dias',
  p50: 1, p95: 10, n_total: 100,
  buckets: [{ de: 0, ate: 10, n: 90 }, { de: 10, ate: null, n: 10 }],
})

vi.mock('@/services/api', () => ({
  getKpis: vi.fn(async () => ({ kpis: [] })),
  getDistribuicoes: vi.fn(async () => ({ distribuicoes: [dist('KPI-01')] })),
}))

import { getDistribuicoes } from '@/services/api'
import { useKpiStore } from './useKpiStore'

describe('useKpiStore — distribuições', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchKpis dispara também a busca das distribuições', async () => {
    const store = useKpiStore()
    await store.fetchKpis()
    await vi.waitFor(() => expect(store.distribuicoes.get('KPI-01')).toBeDefined())
    expect(getDistribuicoes).toHaveBeenCalledTimes(1)
  })

  it('falha da distribuição NÃO seta o error global nem mexe no loading dos cards', async () => {
    vi.mocked(getDistribuicoes).mockRejectedValueOnce(new Error('boom'))
    const store = useKpiStore()
    await store.fetchKpis()
    await vi.waitFor(() => expect(getDistribuicoes).toHaveBeenCalled())
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.distribuicoes.size).toBe(0)
  })

  it('o loading dos cards não espera a distribuição (desacoplado)', async () => {
    // getDistribuicoes pendurado para sempre; fetchKpis tem que resolver mesmo assim.
    vi.mocked(getDistribuicoes).mockImplementationOnce(() => new Promise(() => {}))
    const store = useKpiStore()
    await store.fetchKpis()
    expect(store.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `distribuicoes` não existe no store.

- [ ] **Step 3: Implement** — em `useKpiStore.ts`:

```ts
import type { KpiCode, KpiDistribuicao, KpiItem } from '@/types/api.types'
import { getDistribuicoes, getKpis } from '@/services/api'
...
  const distribuicoes = ref<Map<KpiCode, KpiDistribuicao>>(new Map())
  const loadingDist = ref(false)

  /**
   * Distribuições são ENHANCEMENT: buscadas em paralelo, nunca bloqueiam nem
   * derrubam os cards. Falha aqui = histograma some em silêncio (sem ErrorState).
   * Atenção: NÃO mexer em `loading` — o AreaNav observa esse campo (scroll-spy).
   */
  async function fetchDistribuicoes(): Promise<void> {
    const filterStore = useFilterStore()
    loadingDist.value = true
    try {
      const { group_by: _ignorado, ...params } = filterStore.activeFilters
      const response = await getDistribuicoes(params)
      distribuicoes.value = new Map(
        response.distribuicoes.map((d) => [d.codigo as KpiCode, d]),
      )
    } catch {
      distribuicoes.value = new Map() // silencioso de propósito (enhancement)
    } finally {
      loadingDist.value = false
    }
  }
```

No `fetchKpis`, primeira linha do corpo: `void fetchDistribuicoes()` (fire-and-forget — o watcher
existente já re-dispara `fetchKpis` a cada mudança de filtro, então as duas buscas andam juntas sem
segundo watcher). Exportar `distribuicoes`, `loadingDist`, `fetchDistribuicoes` no return.

> Se `activeFilters` não tiver o shape `{ group_by, ... }` exatamente, leia `useFilterStore.ts` e
> adapte o destructuring — o requisito é: mesmos filtros, sem `group_by`.

- [ ] **Step 4: Run** — arquivo novo + `npx vitest run` completo + type-check. Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useKpiStore.ts frontend/src/stores/useKpiStore.test.ts
git commit -m "feat(front): store busca distribuicoes desacoplada dos cards" -m "Fire-and-forget dentro do fetchKpis: falha ou lentidao da distribuicao nao derruba nem atrasa os KPIs (histograma e enhancement). Nao mexe no loading que o AreaNav observa."
```

---

### Task 5: Frontend — `HistogramaTempos.vue` (SVG à mão)

> **REQUIRED SUB-SKILL antes de codar:** invocar a skill **`dataviz`** — paleta, acessibilidade,
> formas. O código abaixo é a baseline funcional; a skill pode refinar cores/espaçamentos, mas os
> `data-*` e o contrato de props ficam como especificados (os testes dependem deles).

**Files:**
- Create: `frontend/src/components/kpis/HistogramaTempos.vue`
- Create: `frontend/src/components/kpis/HistogramaTempos.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HistogramaTempos from './HistogramaTempos.vue'
import type { KpiDistribuicao } from '@/types/api.types'

const base: KpiDistribuicao = {
  codigo: 'KPI-05' as KpiDistribuicao['codigo'], unidade_tempo: 'dias',
  p50: 2, p95: 16, n_total: 100,
  buckets: [
    ...Array.from({ length: 16 }, (_, i) => ({ de: i, ate: i + 1, n: 16 - i })),
    { de: 16, ate: null, n: 5 },
  ],
}

describe('HistogramaTempos', () => {
  it('renderiza uma barra por balde', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('[data-balde]')).toHaveLength(17)
  })

  it('marca a linha da mediana', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-mediana]').exists()).toBe(true)
  })

  it('o balde de cauda tem estilo distinto', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.findAll('[data-cauda]')).toHaveLength(1)
  })

  it('sem dados não renderiza nada', () => {
    const w = mount(HistogramaTempos, {
      props: { dist: { ...base, n_total: 0, buckets: [], p50: null, p95: null } },
    })
    expect(w.find('svg').exists()).toBe(false)
  })

  it('tooltip do balde traz faixa e contagem', () => {
    const w = mount(HistogramaTempos, { props: { dist: base } })
    expect(w.find('[data-balde] title').text()).toMatch(/casos/)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — módulo não existe.

- [ ] **Step 3: Implement** (baseline; refinar com a skill `dataviz`):

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { KpiDistribuicao } from '@/types/api.types'
import { formatDuration } from '@/lib/format'

/**
 * Histograma compacto da distribuição de tempos de um KPI.
 * Mostra a cauda que a mediana esconde: baldes lineares 0→p95 e um balde de
 * cauda (≥ p95) com estilo distinto. Linha vertical marca a mediana — "metade
 * dos casos até aqui" (conecta com a página de metodologia).
 * Componente burro: recebe a distribuição pronta, não busca nada.
 */
const props = defineProps<{ dist: KpiDistribuicao }>()

const W = 280
const H = 56
const GAP = 1.5
const CAUDA_GAP = 4 // respiro extra antes da cauda: ela está noutra escala de eixo

const tem = computed(() => props.dist.n_total > 0 && props.dist.buckets.length > 0)
const maxN = computed(() => Math.max(1, ...props.dist.buckets.map((b) => b.n)))

const barras = computed(() => {
  const bs = props.dist.buckets
  const larg = (W - GAP * (bs.length - 1) - CAUDA_GAP) / bs.length
  return bs.map((b, i) => {
    const cauda = b.ate === null
    const h = Math.max(b.n > 0 ? 2 : 0, (b.n / maxN.value) * H)
    const faixa = cauda
      ? `≥ ${formatDuration(b.de, props.dist.unidade_tempo)}`
      : `${formatDuration(b.de, props.dist.unidade_tempo)} – ${formatDuration(b.ate!, props.dist.unidade_tempo)}`
    return {
      x: i * (larg + GAP) + (cauda ? CAUDA_GAP : 0),
      y: H - h, w: larg, h, cauda,
      titulo: `${faixa} · ${b.n.toLocaleString('pt-BR')} casos`,
    }
  })
})

// Posição da mediana no eixo linear (0→p95). Clamp por segurança.
const medianaX = computed(() => {
  if (props.dist.p50 === null || props.dist.p95 === null || props.dist.p95 <= 0) return null
  const larguraLinear = W - CAUDA_GAP - (W / props.dist.buckets.length)
  return Math.min(larguraLinear, Math.max(0, (props.dist.p50 / props.dist.p95) * larguraLinear))
})
</script>

<template>
  <svg
    v-if="tem" :viewBox="`0 0 ${W} ${H + 14}`" class="w-full select-none" role="img"
    :aria-label="`Distribuição dos tempos: mediana ${formatDuration(dist.p50, dist.unidade_tempo)}, 95% dos casos até ${formatDuration(dist.p95, dist.unidade_tempo)}`"
  >
    <g v-for="(b, i) in barras" :key="i" :data-balde="i" :data-cauda="b.cauda ? '' : undefined">
      <title>{{ b.titulo }}</title>
      <rect
        :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="1"
        :class="b.cauda ? 'fill-caution/70' : 'fill-primary/60 dark:fill-accent/60'"
      />
    </g>
    <line
      v-if="medianaX !== null" data-mediana
      :x1="medianaX" :x2="medianaX" y1="0" :y2="H"
      class="stroke-text dark:stroke-text-dark" stroke-width="1.5" stroke-dasharray="3 2"
    />
    <text
      v-if="medianaX !== null" :x="medianaX" :y="H + 11" text-anchor="middle" font-size="9"
      class="fill-text-muted dark:fill-text-dark-muted"
    >mediana</text>
  </svg>
</template>
```

> Cuidados: `data-cauda` só no balde de cauda (o `undefined` remove o atributo); `formatDuration`
> aceita `(valor, unidade)` — confirme a assinatura em `lib/format.ts` antes; o caso degenerado
> (balde único `de=0, ate=0`) renderiza uma barra cheia sem linha de mediana (p95<=0 → `medianaX` null).

- [ ] **Step 4: Run** — arquivo + type-check. Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/kpis/HistogramaTempos.vue frontend/src/components/kpis/HistogramaTempos.test.ts
git commit -m "feat(front): histograma compacto da distribuicao de tempos" -m "SVG a mao (sem lib, stack travada): baldes lineares 0..p95, cauda com estilo e respiro proprios (escala de eixo diferente), linha da mediana com rotulo. Componente burro; skill dataviz aplicada."
```

---

### Task 6: Frontend — integração no `KpiCard` (KPI + submétrica 07B)

**Files:**
- Modify: `frontend/src/components/kpis/KpiGrid.vue` (passar as distribuições)
- Modify: `frontend/src/components/kpis/KpiCard.vue`
- Modify: `frontend/src/components/kpis/KpiGrid.test.ts` (mock do service ganha `getDistribuicoes`)
- Create/extend: casos no `KpiGrid.test.ts`

- [ ] **Step 1: Write the failing tests** (em `KpiGrid.test.ts`; o `vi.mock('@/services/api')`
existente PRECISA ganhar `getDistribuicoes: vi.fn(async () => ({ distribuicoes: [...] }))` com
distribuições para KPI-05 e KPI-07B — sem isso os testes atuais quebram com o store novo):

```ts
  it('card com distribuição renderiza o histograma', async () => {
    const w = await montar()
    const exames = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'exames')!
    await vi.waitFor(() => expect(exames.find('[data-balde]').exists()).toBe(true))
  })

  it('card sem distribuição continua íntegro (enhancement)', async () => {
    const w = await montar()
    const entrada = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'entrada')!
    expect(entrada.findComponent(KpiCard).exists()).toBe(true)
    expect(entrada.find('[data-balde]').exists()).toBe(false)
  })

  it('a submétrica KPI-07B ganha histograma próprio', async () => {
    const w = await montar()
    const internacao = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'internacao')!
    await vi.waitFor(() =>
      expect(internacao.findAll('[data-balde]').length).toBeGreaterThan(0))
    // dois histogramas no card do KPI-07 se o mock tiver dist p/ KPI-07 E KPI-07B;
    // com dist só p/ 07B, o histograma aparece no bloco da submétrica.
  })
```

> Calibre os asserts ao mock que você montar (quais códigos têm distribuição). O essencial:
> (a) com distribuição → histograma aparece no card certo; (b) sem → card íntegro e sem histograma;
> (c) 07B renderiza no bloco da submétrica.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement**

`KpiGrid.vue`: expor as distribuições do store e passar aos cards:

```ts
// no script setup (o store já está lá):
const distDe = (codigo: string) => store.distribuicoes.get(codigo as never)
```

```html
<KpiCard
  v-for="kpi in cardsDaArea(...)" :key="kpi.codigo" :kpi="kpi"
  :submetric="kpi.codigo === 'KPI-07' ? submetric : undefined"
  :dist="distDe(kpi.codigo)"
  :sub-dist="kpi.codigo === 'KPI-07' ? distDe('KPI-07B') : undefined"
/>
```

(adapte à estrutura real do template — o `v-for` usa `areasComCards`; leia o arquivo.)

`KpiCard.vue`: novas props opcionais + render:

```ts
const props = defineProps<{
  kpi: KpiItem
  submetric?: KpiItem
  dist?: KpiDistribuicao
  subDist?: KpiDistribuicao
}>()
```

- Histograma principal: logo após o bloco do valor principal, `v-if="dist && dist.n_total > 0"` →
  `<HistogramaTempos :dist="dist" />`.
- Submétrica: dentro do bloco da submétrica (após a barra de meta), `v-if="subDist && subDist.n_total > 0"` →
  `<HistogramaTempos :dist="subDist" />`.
- Sem skeleton dedicado no card (o histograma simplesmente aparece quando chega — enhancement;
  decisão da spec §3.2).

- [ ] **Step 4: Run** — `npx vitest run` completo + type-check. Expected: verde, sem regressões
(os testes existentes do KpiGrid seguem passando com o mock estendido).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/kpis/KpiGrid.vue frontend/src/components/kpis/KpiCard.vue frontend/src/components/kpis/KpiGrid.test.ts
git commit -m "feat(front): histograma de tempos nos cards de KPI" -m "Card mostra a distribuicao abaixo do valor principal; a submetrica KPI-07B (caso-ancora: mediana ~0 escondendo cauda de horas) ganha o proprio histograma. Sem distribuicao o card fica identico ao de antes (enhancement)."
```

---

### Task 7: Verificação no browser (backend real) + registro

**Files:** nenhum código; ao final, atualizar este arquivo (seção "Registro de execução").

- [ ] **Step 1:** Subir backend + frontend (comandos no topo).
- [ ] **Step 2:** Checklist em `http://localhost:5173/dashboard`, nos DOIS temas:
  - Todo card com dados tem histograma; a linha da mediana bate com o valor grande do card.
  - **KPI-07B:** histograma no bloco da submétrica mostrando a cauda (o valor global é "< 1 min",
    mas a cauda deve aparecer — é o caso-âncora).
  - Balde de cauda visualmente distinto dos lineares.
  - Aplicar filtro (ex.: Especialidade) → histogramas atualizam junto com os cards.
  - Matar o backend com a página aberta e refazer o filtro → cards mostram erro normal; **sem** erro
    extra por causa da distribuição (falha silenciosa).
  - Network: exatamente 1 chamada a `/kpis/distribuicoes` por mudança de filtro, em paralelo à
    `/kpis/tempos-medios` (não sequencial).
  - Mobile (viewport ~390px): histograma não estoura o card; sem rolagem horizontal.
- [ ] **Step 3:** Encerrar os servidores. Registrar achados/decisões na seção "Registro de execução"
  deste arquivo (convenção do repo) e commitar o registro.

---

## Self-review (do plano, já aplicado)

- Spec §2→Tasks 1–2 · §3.1→Task 5 · §3.2→Task 4 · §3.3→Tasks 3, 6 · §4→testes distribuídos + Task 7. Modal: sem task (spec emendada — já estava pronto).
- Tipos consistentes: `DistBucket/KpiDistribuicao/DistribuicoesResponse` idênticos entre schema Pydantic (Task 1), zod (Task 3) e consumo (Tasks 4–6); `data-balde`/`data-mediana`/`data-cauda` idênticos entre Task 5 (componente) e Tasks 5–6 (testes); `_N_BUCKETS` exportado (Task 1) e usado no teste.
- Placeholders: os pontos onde o implementador precisa LER o repo antes (nome de fixture do client HTTP, shape de `activeFilters`, assinatura de `formatDuration`, unidade que existe na fixture de teste) estão marcados explicitamente como verificação, não como lacuna.

## Registro de execução

### 2026-08-03 — base da branch: `feat/dashboard-areas`, não `main`

O prompt de abertura manda criar `feat/indicadores-graficos` a partir de `main`. Ao conferir o repo,
`main` **não contém** o trabalho do dashboard por áreas do qual este plano depende: não há
`AreaNav.vue`, nem as seções `data-area` do `KpiGrid` (usadas nos testes da Task 6), nem `lib/layout`
— e os próprios arquivos deste plano e da spec só existem em `feat/dashboard-areas` (a Task 7 pediria
para editar um arquivo inexistente). A instrução era premissa desatualizada, escrita supondo o merge
de `feat/dashboard-areas` já feito.

**Decisão (confirmada com o usuário):** branch criada a partir de `feat/dashboard-areas`
(`7469357`). Nenhuma outra alteração no plano.

## Fora de escopo (reafirmado)

Biblioteca de gráficos · tendência temporal · gráficos em Ciclicidade/Gargalos · mudanças nos `.sql`
existentes · `AreaSection.vue` · mudanças no `KpiDetailModal` (já tem escala comum e rótulos).
