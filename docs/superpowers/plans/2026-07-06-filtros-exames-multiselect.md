# Filtros: classificação de exames + multiseleção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar os filtros multiselecionáveis e surfacar a classificação assistencial (Grupo) na UI, com cascata Grupo → Unidade → Especialidade e agrupamento das unidades por Grupo.

**Architecture:** Backend troca os predicados de igualdade (`col = :x`) por `IN (...)` construído dinamicamente em Python (parâmetros nomeados, sem interpolar valor do usuário), via um helper único reutilizado por KPIs, Gargalos e Eventos. O `/dimensoes` ganha o parâmetro `grupo` e passa a anotar cada unidade com seu grupo, permitindo ao frontend montar optgroups e escopar em cascata. Frontend migra os filtros de valor único para arrays.

**Tech Stack:** Python 3.11 · FastAPI · SQLAlchemy 2.0 Async · SQLite · pytest · Vue 3 + TypeScript · Pinia · Zod · Vitest

**Spec:** [../specs/2026-07-06-filtros-exames-multiselect-design.md](../specs/2026-07-06-filtros-exames-multiselect-design.md)

---

## Estrutura de arquivos

**Criar:**
- `backend/src/pija/sql_filtros.py` — dataclass `Filtros` + `build_filtros()` (única fonte dos fragmentos `IN`)
- `backend/tests/test_sql_filtros.py` — testes do helper
- `frontend/src/lib/dimensoes.ts` — `agruparUnidades()` (lógica pura de optgroups)
- `frontend/src/lib/dimensoes.test.ts` — testes da lógica pura
- `frontend/src/stores/useFilterStore.test.ts` — testes do store (arrays/toggle)

**Modificar:**
- SQL: `kpis/kpi_01.sql`, `kpi_03.sql`, `kpi_05.sql`, `kpi_06.sql`, `kpi_07.sql`, `kpi_07b.sql`, `eventos_filtrados.sql`, `eventos_count.sql`, `dimensoes.sql`, `especialidades_unidade.sql`
- Backend: `providers/kpis_provider.py`, `providers/gargalos_provider.py`, `providers/eventos_provider.py`, `providers/dimensoes_provider.py`, `controllers/{kpis,gargalos,eventos,dimensoes}_controller.py`, `schemas/dimensoes_schema.py`
- Frontend: `stores/useFilterStore.ts`, `stores/useDimensoesStore.ts`, `components/ui/FilterSelect.vue`, `components/ui/FilterBar.vue`, `services/api.ts`, `schemas/api.schemas.ts`, `types/api.types.ts`

**Regra de teste (frontend):** o projeto **não** tem `@vue/test-utils`/jsdom. Testar por unidade só **lógica pura** e **store**; componentes (`FilterSelect`, `FilterBar`) verificam-se por `type-check` + navegador (Playwright) nas tasks de verificação.

**Comandos base:**
- Backend: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest`
- Frontend: `cd frontend; npx vitest run` · `npm run type-check`

---

# FASE 1 — Fundação multiseleção (backend)

## Task 1: Helper de filtros multivalor

**Files:**
- Create: `backend/src/pija/sql_filtros.py`
- Test: `backend/tests/test_sql_filtros.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_sql_filtros.py
from pija.sql_filtros import Filtros, build_filtros


class TestBuildFiltros:
    def test_sem_filtros_nao_gera_clausula(self):
        frag, params = build_filtros(Filtros())
        assert frag == ""
        assert params == {}

    def test_um_valor_gera_in_com_um_parametro(self):
        frag, params = build_filtros(Filtros(unidade=["UAC: BIOQUÍMICA"]))
        assert frag == "AND unidade IN (:unidade_0)"
        assert params == {"unidade_0": "UAC: BIOQUÍMICA"}

    def test_varios_valores_geram_in_com_n_parametros(self):
        frag, params = build_filtros(Filtros(grupo=["Ambulatorial", "Internação"]))
        assert frag == "AND grupo IN (:grupo_0, :grupo_1)"
        assert params == {"grupo_0": "Ambulatorial", "grupo_1": "Internação"}

    def test_campos_combinados_geram_clausulas_and(self):
        frag, params = build_filtros(
            Filtros(unidade=["U1"], especialidade=["E1", "E2"])
        )
        assert "AND unidade IN (:unidade_0)" in frag
        assert "AND especialidade IN (:especialidade_0, :especialidade_1)" in frag
        assert params == {"unidade_0": "U1", "especialidade_0": "E1", "especialidade_1": "E2"}

    def test_prefixo_de_alias_e_aplicado(self):
        frag, _ = build_filtros(Filtros(unidade=["U1"]), prefix="pd.")
        assert frag == "AND pd.unidade IN (:unidade_0)"

    def test_lista_vazia_equivale_a_sem_filtro(self):
        frag, params = build_filtros(Filtros(unidade=[], grupo=[]))
        assert frag == ""
        assert params == {}

    def test_valor_do_usuario_nunca_e_interpolado_no_sql(self):
        # Aspas/;/-- ficam no parâmetro, nunca no fragmento SQL.
        malicioso = "'; DROP TABLE fato_eventos_jornada; --"
        frag, params = build_filtros(Filtros(unidade=[malicioso]))
        assert malicioso not in frag
        assert params["unidade_0"] == malicioso

    def test_datas_nao_entram_no_fragmento(self):
        frag, params = build_filtros(Filtros(data_inicio="2024-01-01", data_fim="2024-02-01"))
        assert frag == ""
        assert params == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_sql_filtros.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'pija.sql_filtros'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/pija/sql_filtros.py
"""Construção dos fragmentos SQL de filtro multivalor (IN) com parâmetros nomeados.

Fonte única usada por KPIs, Gargalos e Eventos. Os valores do usuário NUNCA são
interpolados no SQL — viram parâmetros nomeados (:campo_0, :campo_1, ...).
Lista vazia/None = filtro ausente (nenhuma cláusula gerada).
"""
from dataclasses import dataclass, field

# Campos multivalor suportados (mapeiam 1:1 para colunas do fato).
CAMPOS_MULTIVALOR = ("unidade", "especialidade", "grupo")


@dataclass(frozen=True)
class Filtros:
    """Filtros globais. Listas = multiseleção (OR interno); datas = intervalo."""

    unidade: list[str] | None = None
    especialidade: list[str] | None = None
    grupo: list[str] | None = None
    data_inicio: str | None = None
    data_fim: str | None = None


def build_filtros(filtros: Filtros, prefix: str = "") -> tuple[str, dict[str, str]]:
    """Devolve (fragmento_sql, params) para os campos multivalor preenchidos.

    `prefix` permite qualificar a coluna com o alias da query (ex.: "pd.").
    """
    fragmentos: list[str] = []
    params: dict[str, str] = {}
    for campo in CAMPOS_MULTIVALOR:
        valores = getattr(filtros, campo)
        if not valores:
            continue
        nomes: list[str] = []
        for i, valor in enumerate(valores):
            nome = f"{campo}_{i}"
            params[nome] = valor
            nomes.append(f":{nome}")
        fragmentos.append(f"AND {prefix}{campo} IN ({', '.join(nomes)})")
    return ("\n  ".join(fragmentos), params)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_sql_filtros.py -v`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/sql_filtros.py backend/tests/test_sql_filtros.py
git commit -m "feat(filtros): helper de fragmentos IN multivalor com params nomeados"
```

---

## Task 2: KPIs aceitam filtros multivalor

**Files:**
- Modify: `backend/src/pija/sql/kpis/kpi_01.sql`, `kpi_03.sql`, `kpi_05.sql`, `kpi_06.sql`, `kpi_07.sql`, `kpi_07b.sql`
- Modify: `backend/src/pija/providers/kpis_provider.py:87-139`
- Modify: `backend/src/pija/controllers/kpis_controller.py:12-35`
- Test: `backend/tests/test_kpis_multiselect.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_kpis_multiselect.py
from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


class TestKpisMultiselect:
    async def test_sem_filtro_retorna_tudo(self, fixture_db_session):
        r = await KpisProvider(fixture_db_session).compute("KPI-03", GroupBy.unidade, Filtros())
        assert r.n_global > 0

    async def test_filtro_por_uma_unidade(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        alvo = todos.breakdown[0].dimensao
        um = await p.compute("KPI-03", GroupBy.unidade, Filtros(unidade=[alvo]))
        assert [b.dimensao for b in um.breakdown] == [alvo]

    async def test_duas_unidades_somam_as_duas(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        assert len(todos.breakdown) >= 2, "fixture precisa de 2+ unidades no KPI-03"
        a, b = todos.breakdown[0].dimensao, todos.breakdown[1].dimensao
        duas = await p.compute("KPI-03", GroupBy.unidade, Filtros(unidade=[a, b]))
        assert set(d.dimensao for d in duas.breakdown) == {a, b}

    async def test_lista_vazia_equivale_a_sem_filtro(self, fixture_db_session):
        p = KpisProvider(fixture_db_session)
        vazio = await p.compute("KPI-03", GroupBy.unidade, Filtros(unidade=[]))
        todos = await p.compute("KPI-03", GroupBy.unidade, Filtros())
        assert vazio.n_global == todos.n_global

    async def test_kpi01_usa_prefixo_pd_sem_erro(self, fixture_db_session):
        # KPI-01 qualifica as colunas com o alias `pd.` — regressão de prefixo.
        r = await KpisProvider(fixture_db_session).compute(
            "KPI-01", GroupBy.unidade, Filtros(grupo=["Ambulatorial"])
        )
        assert r.codigo == "KPI-01"

    async def test_grupo_do_usuario_intersecta_com_escopo_fixo_do_kpi(self, fixture_db_session):
        # KPI-03 tem escopo fixo [Ambulatorial]. Pedir só "Internação" => interseção vazia.
        r = await KpisProvider(fixture_db_session).compute(
            "KPI-03", GroupBy.unidade, Filtros(grupo=["Internação"])
        )
        assert r.n_global == 0
        assert r.media_global is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis_multiselect.py -v`
Expected: FAIL — `TypeError`: `compute()` recebe `dict`, não `Filtros`

- [ ] **Step 3a: Trocar os predicados nos 5 SQLs sem alias**

Em **cada** um de `kpi_03.sql`, `kpi_05.sql`, `kpi_06.sql`, `kpi_07.sql`, `kpi_07b.sql`, remover estas três linhas:

```sql
  AND (:unidade       IS NULL OR unidade       = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:grupo IS NULL OR grupo = :grupo)
```

e colocar no lugar (mantendo `AND unidade NOT LIKE '%INATIVO%'` onde já existe):

```sql
  {filtros}
```

Resultado para `kpi_05.sql` (referência completa):

```sql
SELECT {group_col} AS dimensao,
       JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_solicitacao) AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'EXAME'
  AND timestamp_realizacao IS NOT NULL
  AND timestamp_solicitacao IS NOT NULL
  AND JULIANDAY(timestamp_realizacao) >= JULIANDAY(timestamp_solicitacao)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
```

- [ ] **Step 3b: Trocar os predicados em `kpi_01.sql` (usa alias `pd.`)**

Substituir o bloco `WHERE` final (linhas 27-34) por:

```sql
WHERE JULIANDAY(pe.dt_primeiro) >= JULIANDAY(p.dt_prontuario)
  AND pd.unidade NOT LIKE '%INATIVO%'
  {filtros}
  {grupo_scope}
  AND (:data_inicio   IS NULL OR pe.dt_primeiro >= :data_inicio)
  AND (:data_fim      IS NULL OR pe.dt_primeiro <= :data_fim)
```

- [ ] **Step 3c: Atualizar o provider**

Em `backend/src/pija/providers/kpis_provider.py`, trocar o import e os métodos `compute`/`get_kpis`:

```python
from pija.sql_filtros import Filtros, build_filtros
```

```python
    async def compute(self, code: str, group_by: GroupBy, filtros: Filtros) -> KpiResult:
        sql_name, descricao = KPI_META[code]
        col = GROUP_COL[group_by]
        # KPI-01 qualifica as colunas de dimensão com o alias `pd.`.
        prefix = "pd." if code == "KPI-01" else ""
        frag, fparams = build_filtros(filtros, prefix=prefix)
        base = (
            load_sql(sql_name)
            .replace("{group_col}", col)
            .replace("{grupo_scope}", self._scope_fragment(code))
            .replace("{filtros}", frag)
        )
        params = {
            **fparams,
            "data_inicio": filtros.data_inicio,
            "data_fim": filtros.data_fim,
        }
        rows = (await self._session.execute(text(_MEDIAN_SQL.format(base=base)), params)).all()
```

(o restante do corpo de `compute` — laço sobre `rows`, `breakdown.sort`, `return KpiResult(...)` — permanece inalterado)

```python
    async def get_kpis(
        self,
        *,
        kpi_codes: list[str] | None,
        group_by: GroupBy,
        filtros: Filtros,
    ) -> KpisResponse:
        codes = kpi_codes or ALL_KPIS
        results = [await self.compute(code, group_by, filtros) for code in codes]
        return KpisResponse(kpis=results)
```

- [ ] **Step 3d: Atualizar o controller**

Em `backend/src/pija/controllers/kpis_controller.py`, trocar os três `Query` escalares por listas e montar `Filtros`:

```python
from pija.sql_filtros import Filtros


async def get_kpis(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs a retornar (repita o parâmetro). Default: todos."),
    group_by: GroupBy = Query(GroupBy.unidade, description="Dimensão do breakdown: `unidade` (default) ou `especialidade`."),
    unidade: list[str] | None = Query(None, description="Restringe a uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Restringe a uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Restringe a um ou mais grupos assistenciais (repita o parâmetro)."),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`"),
    session: AsyncSession = Depends(get_db),
) -> KpisResponse:
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")
    filtros = Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
    return await KpisProvider(session).get_kpis(kpi_codes=kpi_codes, group_by=group_by, filtros=filtros)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis_multiselect.py tests/test_kpis.py tests/test_kpis_scope.py -v`
Expected: PASS. Se `test_kpis.py`/`test_kpis_scope.py` chamarem `compute(code, group_by, dict)`, atualizar essas chamadas para `Filtros(...)` — é a mesma mudança de assinatura.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/sql/kpis backend/src/pija/providers/kpis_provider.py backend/src/pija/controllers/kpis_controller.py backend/tests
git commit -m "feat(kpis): filtros multivalor (IN) em unidade/especialidade/grupo"
```

---

## Task 3: Gargalos aceita filtros multivalor

**Files:**
- Modify: `backend/src/pija/providers/gargalos_provider.py:21-55`
- Modify: `backend/src/pija/controllers/gargalos_controller.py:13-38`
- Test: `backend/tests/test_gargalos_multiselect.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_gargalos_multiselect.py
from pija.providers.gargalos_provider import GargalosProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


class TestGargalosMultiselect:
    async def test_sem_filtro_retorna_itens(self, fixture_db_session):
        r = await GargalosProvider(fixture_db_session).get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(), limit=10
        )
        assert len(r.items) > 0

    async def test_filtra_por_varias_unidades(self, fixture_db_session):
        p = GargalosProvider(fixture_db_session)
        todos = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(), limit=100
        )
        dims = list(dict.fromkeys(i.dimensao for i in todos.items))
        assert len(dims) >= 2, "fixture precisa de 2+ dimensões em gargalos"
        a, b = dims[0], dims[1]
        duas = await p.get_gargalos(
            kpi_codes=None, group_by=GroupBy.unidade, filtros=Filtros(unidade=[a, b]), limit=100
        )
        assert set(i.dimensao for i in duas.items) <= {a, b}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_gargalos_multiselect.py -v`
Expected: FAIL — `TypeError: get_gargalos() got an unexpected keyword argument 'filtros'`

- [ ] **Step 3a: Atualizar o provider**

Em `backend/src/pija/providers/gargalos_provider.py`, trocar o import e a assinatura:

```python
from pija.sql_filtros import Filtros
```

```python
    async def get_gargalos(
        self,
        *,
        kpi_codes: list[str] | None,
        group_by: GroupBy,
        filtros: Filtros,
        limit: int,
    ) -> GargalosResponse:
        codes = kpi_codes or DEFAULT_GARGALO_CODES
        items: list[GargaloItem] = []
        for code in codes:
            result = await self._kpis.compute(code, group_by, filtros)
            for b in result.breakdown:
                items.append(
                    GargaloItem(
                        dimensao_tipo=group_by.value,
                        dimensao=b.dimensao,
                        transicao=code,
                        media=b.media,
                        n=b.n,
                    )
                )
        items.sort(key=lambda x: (-x.media, x.transicao, x.dimensao))
        return GargalosResponse(items=items[:limit])
```

- [ ] **Step 3b: Atualizar o controller**

Em `backend/src/pija/controllers/gargalos_controller.py`, aplicar a mesma troca do Task 2 Step 3d (os três `Query` viram `list[str] | None`) e montar `Filtros`:

```python
from pija.sql_filtros import Filtros
```

```python
    unidade: list[str] | None = Query(None, description="Filtra o ranking para uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Filtra o ranking para uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Restringe a um ou mais grupos assistenciais (repita o parâmetro)."),
```

```python
    filtros = Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
    return await GargalosProvider(session).get_gargalos(
        kpi_codes=kpi_codes, group_by=group_by, filtros=filtros, limit=limit
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_gargalos_multiselect.py tests/test_gargalos.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/providers/gargalos_provider.py backend/src/pija/controllers/gargalos_controller.py backend/tests/test_gargalos_multiselect.py
git commit -m "feat(gargalos): filtros multivalor reusando Filtros do KpisProvider"
```

---

## Task 4: Eventos aceita filtros multivalor

**Files:**
- Modify: `backend/src/pija/sql/eventos_filtrados.sql:14-15`, `backend/src/pija/sql/eventos_count.sql:5-6`
- Modify: `backend/src/pija/providers/eventos_provider.py:14-41`
- Modify: `backend/src/pija/controllers/eventos_controller.py:12-33`
- Test: `backend/tests/test_eventos_multiselect.py`

Nota: Eventos passa a aceitar também `grupo` (hoje ignorado), para ficar coerente com a cascata.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_eventos_multiselect.py
from pija.providers.eventos_provider import EventosProvider
from pija.sql_filtros import Filtros


class TestEventosMultiselect:
    async def test_sem_filtro_retorna_eventos(self, fixture_db_session):
        r = await EventosProvider(fixture_db_session).list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(), limit=50, offset=0
        )
        assert r.total > 0

    async def test_filtra_por_duas_unidades(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        todos = await p.list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(), limit=500, offset=0
        )
        unidades = [u for u in dict.fromkeys(i.unidade for i in todos.items) if u]
        assert len(unidades) >= 2, "fixture precisa de 2+ unidades em eventos"
        a, b = unidades[0], unidades[1]
        duas = await p.list_eventos(
            paciente_id=None, tipo_entidade=None,
            filtros=Filtros(unidade=[a, b]), limit=500, offset=0,
        )
        assert set(i.unidade for i in duas.items) == {a, b}
        assert duas.total == len(duas.items)

    async def test_lista_vazia_equivale_a_sem_filtro(self, fixture_db_session):
        p = EventosProvider(fixture_db_session)
        vazio = await p.list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(unidade=[]), limit=50, offset=0
        )
        todos = await p.list_eventos(
            paciente_id=None, tipo_entidade=None, filtros=Filtros(), limit=50, offset=0
        )
        assert vazio.total == todos.total
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_eventos_multiselect.py -v`
Expected: FAIL — `TypeError: list_eventos() got an unexpected keyword argument 'filtros'`

- [ ] **Step 3a: Atualizar os dois SQLs**

Em `eventos_filtrados.sql`, remover as linhas 14-15 (`:unidade` e `:especialidade`) e colocar `{filtros}` logo após o predicado de `tipo_entidade`:

```sql
WHERE deleted_at IS NULL
  AND (:paciente_id   IS NULL OR paciente_id   = :paciente_id)
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
ORDER BY timestamp_principal DESC, evento_id
LIMIT :limit OFFSET :offset
```

Em `eventos_count.sql`, a mesma troca:

```sql
SELECT COUNT(*) AS total
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND (:paciente_id   IS NULL OR paciente_id   = :paciente_id)
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
```

- [ ] **Step 3b: Atualizar o provider**

```python
# backend/src/pija/providers/eventos_provider.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.eventos_schema import EventoItem, EventosResponse
from pija.sql_filtros import Filtros, build_filtros


class EventosProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("eventos_filtrados.sql")
        self._count_sql = load_sql("eventos_count.sql")

    async def list_eventos(
        self,
        *,
        paciente_id: str | None,
        tipo_entidade: str | None,
        filtros: Filtros,
        limit: int,
        offset: int,
    ) -> EventosResponse:
        frag, fparams = build_filtros(filtros)
        params = {
            **fparams,
            "paciente_id": paciente_id,
            "tipo_entidade": tipo_entidade,
            "data_inicio": filtros.data_inicio,
            "data_fim": filtros.data_fim,
        }
        count_sql = self._count_sql.replace("{filtros}", frag)
        total = (await self._session.execute(text(count_sql), params)).scalar() or 0

        sql = self._sql.replace("{filtros}", frag)
        rows = await self._session.execute(
            text(sql), {**params, "limit": limit, "offset": offset}
        )
        items = [EventoItem(**dict(r._mapping)) for r in rows]
        return EventosResponse(items=items, total=total, limit=limit, offset=offset)
```

- [ ] **Step 3c: Atualizar o controller**

Em `backend/src/pija/controllers/eventos_controller.py`:

```python
from pija.sql_filtros import Filtros
```

```python
    unidade: list[str] | None = Query(None, description="Filtra por uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Filtra por uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Filtra por um ou mais grupos assistenciais (repita o parâmetro)."),
```

```python
    filtros = Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
    return await EventosProvider(session).list_eventos(
        paciente_id=paciente_id,
        tipo_entidade=tipo_entidade.value if tipo_entidade else None,
        filtros=filtros,
        limit=limit,
        offset=offset,
    )
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest`
Expected: PASS (toda a suíte). Ajustar chamadas antigas de `list_eventos(unidade=..., especialidade=...)` em `test_eventos.py`/`test_integration_f2.py` para `filtros=Filtros(...)`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/sql backend/src/pija/providers/eventos_provider.py backend/src/pija/controllers/eventos_controller.py backend/tests
git commit -m "feat(eventos): filtros multivalor (inclui grupo) reusando o helper"
```

---

# FASE 2 — Fundação multiseleção (frontend)

## Task 5: `useFilterStore` com arrays

**Files:**
- Modify: `frontend/src/stores/useFilterStore.ts`
- Test: `frontend/src/stores/useFilterStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/stores/useFilterStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFilterStore } from './useFilterStore'

describe('useFilterStore (multiseleção)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('começa com listas vazias', () => {
    const s = useFilterStore()
    expect(s.grupo).toEqual([])
    expect(s.unidade).toEqual([])
    expect(s.especialidade).toEqual([])
  })

  it('toggle adiciona e remove', () => {
    const s = useFilterStore()
    s.toggleUnidade('A')
    s.toggleUnidade('B')
    expect(s.unidade).toEqual(['A', 'B'])
    s.toggleUnidade('A')
    expect(s.unidade).toEqual(['B'])
  })

  it('activeCount conta filtros não-vazios', () => {
    const s = useFilterStore()
    expect(s.activeCount).toBe(0)
    s.toggleGrupo('Ambulatorial')
    s.toggleUnidade('A')
    s.setDataInicio('2024-01-01')
    expect(s.activeCount).toBe(3)
  })

  it('activeFilters omite listas vazias e envia arrays', () => {
    const s = useFilterStore()
    expect(s.activeFilters.unidade).toBeUndefined()
    s.toggleUnidade('A')
    s.toggleUnidade('B')
    expect(s.activeFilters.unidade).toEqual(['A', 'B'])
  })

  it('setUnidades substitui a lista inteira', () => {
    const s = useFilterStore()
    s.setUnidades(['X', 'Y'])
    expect(s.unidade).toEqual(['X', 'Y'])
  })

  it('reset limpa tudo menos groupBy', () => {
    const s = useFilterStore()
    s.toggleGrupo('G'); s.toggleUnidade('U'); s.setGroupBy('especialidade')
    s.reset()
    expect(s.grupo).toEqual([])
    expect(s.unidade).toEqual([])
    expect(s.groupBy).toBe('especialidade')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/stores/useFilterStore.test.ts`
Expected: FAIL — `s.toggleUnidade is not a function`

- [ ] **Step 3: Write the implementation**

```typescript
// frontend/src/stores/useFilterStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GroupBy } from '@/types/api.types'

/**
 * useFilterStore — Filtros globais da plataforma PIJA.
 * Grupo/unidade/especialidade são MULTISELEÇÃO: lista vazia = "Todas".
 * Todos os stores de dados observam `activeFilters` e re-buscam automaticamente.
 */
export const useFilterStore = defineStore('filter', () => {
  // ── Estado ──────────────────────────────────────────────────
  const unidade       = ref<string[]>([])
  const grupo         = ref<string[]>([])
  const especialidade = ref<string[]>([])
  const dataInicio    = ref<string | null>(null)
  const dataFim       = ref<string | null>(null)
  const groupBy       = ref<GroupBy>('unidade')

  // Lista vazia é omitida da query (undefined) — o backend trata ausência como "sem filtro".
  const orUndefined = (l: string[]) => (l.length > 0 ? l : undefined)

  const activeFilters = computed(() => ({
    grupo:         orUndefined(grupo.value),
    unidade:       orUndefined(unidade.value),
    especialidade: orUndefined(especialidade.value),
    data_inicio:   dataInicio.value ?? undefined,
    data_fim:      dataFim.value ?? undefined,
    group_by:      groupBy.value,
  }))

  const activeCount = computed(() => {
    let count = 0
    if (grupo.value.length)         count++
    if (unidade.value.length)       count++
    if (especialidade.value.length) count++
    if (dataInicio.value)           count++
    if (dataFim.value)              count++
    return count
  })

  // ── Actions ───────────────────────────────────────────────────
  function toggle(lista: typeof unidade, valor: string): void {
    lista.value = lista.value.includes(valor)
      ? lista.value.filter((v) => v !== valor)
      : [...lista.value, valor]
  }

  const toggleUnidade       = (u: string) => toggle(unidade, u)
  const toggleGrupo         = (g: string) => toggle(grupo, g)
  const toggleEspecialidade = (e: string) => toggle(especialidade, e)

  const setUnidades       = (l: string[]) => { unidade.value = l }
  const setGrupos         = (l: string[]) => { grupo.value = l }
  const setEspecialidades = (l: string[]) => { especialidade.value = l }

  function setDataInicio(d: string | null): void { dataInicio.value = d }
  function setDataFim(d: string | null): void { dataFim.value = d }
  function setGroupBy(g: GroupBy): void { groupBy.value = g }

  function reset(): void {
    unidade.value = []
    grupo.value = []
    especialidade.value = []
    dataInicio.value = null
    dataFim.value = null
    // groupBy mantém a preferência do usuário
  }

  return {
    unidade, grupo, especialidade, dataInicio, dataFim, groupBy,
    activeFilters, activeCount,
    toggleUnidade, toggleGrupo, toggleEspecialidade,
    setUnidades, setGrupos, setEspecialidades,
    setDataInicio, setDataFim, setGroupBy, reset,
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/stores/useFilterStore.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useFilterStore.ts frontend/src/stores/useFilterStore.test.ts
git commit -m "feat(filtros): store de filtros com multiselecao (arrays + toggle)"
```

---

## Task 6: `FilterSelect` multiseleção (checkbox dropdown)

**Files:**
- Modify: `frontend/src/components/ui/FilterSelect.vue`
- Modify: `frontend/src/types/api.types.ts` (tipos dos params — ver Step 3b)

- [ ] **Step 1: Reescrever o componente**

```vue
<!-- frontend/src/components/ui/FilterSelect.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string[]
  options: readonly string[]
  label: string
  placeholder?: string
  /** Quando informado, renderiza as opções sob cabeçalhos (optgroup). */
  groups?: readonly { label: string; options: readonly string[] }[]
}>(), { placeholder: 'Todas' })

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const aberto = ref(false)
const raiz = ref<HTMLElement | null>(null)

const resumo = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder
  if (props.modelValue.length === 1) return props.modelValue[0]
  return `${props.modelValue.length} selecionados`
})

// Sem `groups`, trata tudo como um único bloco sem cabeçalho.
const blocos = computed(() =>
  props.groups ?? [{ label: '', options: props.options }],
)

function alternar(valor: string): void {
  const atual = props.modelValue
  emit('update:modelValue', atual.includes(valor)
    ? atual.filter((v) => v !== valor)
    : [...atual, valor])
}

function limpar(): void { emit('update:modelValue', []) }

function onClickFora(e: MouseEvent): void {
  if (raiz.value && !raiz.value.contains(e.target as Node)) aberto.value = false
}
onMounted(() => document.addEventListener('click', onClickFora))
onUnmounted(() => document.removeEventListener('click', onClickFora))
</script>

<template>
  <div ref="raiz" class="relative flex flex-col gap-1 text-xs">
    <span class="font-medium text-text-muted dark:text-text-dark-muted">{{ label }}</span>
    <button
      type="button"
      class="px-3 py-2 rounded-xl text-sm text-left bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text dark:text-text-dark min-w-[10rem] flex items-center justify-between gap-2"
      :aria-expanded="aberto" aria-haspopup="listbox"
      @click="aberto = !aberto"
    >
      <span class="truncate">{{ resumo }}</span>
      <span class="shrink-0 text-text-faint">▾</span>
    </button>

    <div
      v-if="aberto" role="listbox"
      class="absolute top-full left-0 z-40 mt-1 w-max min-w-full max-h-72 overflow-y-auto rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark shadow-card-hover p-1"
    >
      <button
        v-if="modelValue.length > 0" type="button"
        class="w-full text-left px-2 py-1.5 text-xs text-primary hover:bg-surface-offset dark:hover:bg-surface-dark-offset rounded-lg"
        @click="limpar"
      >
        Limpar seleção
      </button>
      <template v-for="bloco in blocos" :key="bloco.label">
        <div
          v-if="bloco.label"
          class="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-faint dark:text-text-dark-muted"
        >
          {{ bloco.label }}
        </div>
        <label
          v-for="opt in bloco.options" :key="opt"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-offset dark:hover:bg-surface-dark-offset"
        >
          <input
            type="checkbox" class="rounded border-border"
            :checked="modelValue.includes(opt)"
            @change="alternar(opt)"
          />
          <span class="text-sm text-text dark:text-text-dark">{{ opt }}</span>
        </label>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Atualizar os tipos de params da API**

Em `frontend/src/types/api.types.ts`, os campos de filtro dos params passam de `string` para `string[]`. Localizar as interfaces de params e trocar:

```typescript
  grupo?: string[]
  unidade?: string[]
  especialidade?: string[]
```

em `KpiParams`, `GargaloParams` e `EventosParams` (o `paramsSerializer` do `api.ts` já serializa arrays como chave repetida — nenhuma mudança necessária em `api.ts`).

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend; npm run type-check`
Expected: erros APENAS em `FilterBar.vue` (ainda passando valor único) — corrigidos no Task 7.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/FilterSelect.vue frontend/src/types/api.types.ts
git commit -m "feat(filtros): FilterSelect vira dropdown de multiselecao com checkboxes"
```

---

## Task 7: Ligar o `FilterBar` à multiseleção

**Files:**
- Modify: `frontend/src/components/ui/FilterBar.vue:34-48`

- [ ] **Step 1: Trocar os três selects**

```vue
      <FilterSelect
        label="Grupo" :options="dimensoes.grupos"
        :model-value="filter.grupo"
        @update:model-value="filter.setGrupos($event)"
      />
      <FilterSelect
        label="Unidade executora" :options="dimensoes.unidades"
        :model-value="filter.unidade"
        @update:model-value="filter.setUnidades($event)"
      />
      <FilterSelect
        label="Especialidade" :options="dimensoes.especialidades"
        :model-value="filter.especialidade"
        @update:model-value="filter.setEspecialidades($event)"
      />
```

E o watcher da cascata existente passa a receber lista (a cascata final vem no Task 11):

```typescript
watch(
  () => filter.unidade,
  (u) => {
    if (filter.especialidade.length) filter.setEspecialidades([])
    void dimensoes.scopeEspecialidades(u)
  },
  { deep: true },
)
```

- [ ] **Step 2: Migrar `scopeEspecialidades` para lista (interino)**

`filter.unidade` agora é `string[]`, mas `getDimensoes` ainda aceita **uma** unidade (só migra no Task 9). Trocar a função em `frontend/src/stores/useDimensoesStore.ts` por esta versão interina — sem ela o type-check quebra:

```typescript
  /** Cascata: escopa as especialidades pelas unidades selecionadas.
   *  INTERINO: a API ainda aceita uma unidade só; com 2+ selecionadas,
   *  mantém a lista completa. Vira escopo real por lista no Task 9. */
  async function scopeEspecialidades(unidade: string[]): Promise<void> {
    if (unidade.length !== 1) {
      especialidades.value = especialidadesFull.value
      return
    }
    const d = await getDimensoes(unidade[0])
    especialidades.value = d.especialidades
  }
```

- [ ] **Step 3: Verificar tipos e testes**

Run: `cd frontend; npm run type-check; npx vitest run`
Expected: type-check limpo; testes PASS.

- [ ] **Step 4: Verificar no navegador**

Run: `cd frontend; $env:VITE_USE_MOCK="true"; npm run dev` e abrir o dashboard.
Expected: os três filtros abrem um dropdown com checkboxes; marcar 2 valores mostra "2 selecionados"; "Limpar seleção" zera; os KPIs recarregam.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/FilterBar.vue frontend/src/stores/useDimensoesStore.ts
git commit -m "feat(filtros): FilterBar usa multiselecao nos tres filtros"
```

---

# FASE 3 — `/dimensoes` com grupo e anotação

## Task 8: `/dimensoes` — escopo por grupo e unidades anotadas

**Files:**
- Modify: `backend/src/pija/sql/dimensoes.sql`, `backend/src/pija/sql/especialidades_unidade.sql`
- Modify: `backend/src/pija/schemas/dimensoes_schema.py`
- Modify: `backend/src/pija/providers/dimensoes_provider.py`
- Modify: `backend/src/pija/controllers/dimensoes_controller.py`
- Test: `backend/tests/test_dimensoes_grupo.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_dimensoes_grupo.py
from pija.providers.dimensoes_provider import DimensoesProvider


class TestDimensoesGrupo:
    async def test_unidades_vem_anotadas_com_grupo(self, fixture_db_session):
        r = await DimensoesProvider(fixture_db_session).get_dimensoes()
        assert len(r.unidades) > 0
        u = r.unidades[0]
        assert hasattr(u, "valor") and hasattr(u, "grupo")
        assert u.valor

    async def test_escopo_por_grupo_filtra_unidades_e_especialidades(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        alvo = full.unidades[0].grupo
        assert alvo, "fixture precisa de unidade com grupo"
        scoped = await p.get_dimensoes(grupo=[alvo])
        assert all(u.grupo == alvo for u in scoped.unidades)
        assert set(scoped.especialidades) <= set(full.especialidades)

    async def test_escopo_por_varios_grupos_e_uniao(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        grupos = [g for g in dict.fromkeys(u.grupo for u in full.unidades) if g]
        if len(grupos) < 2:
            return  # fixture só tem um grupo — união já coberta pelo teste anterior
        scoped = await p.get_dimensoes(grupo=grupos[:2])
        assert set(u.grupo for u in scoped.unidades) <= set(grupos[:2])

    async def test_escopo_por_unidades_multivalor(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        alvos = [u.valor for u in full.unidades[:2]]
        scoped = await p.get_dimensoes(unidade=alvos)
        assert scoped.unidades == [] and scoped.grupos == []
        assert set(scoped.especialidades) <= set(full.especialidades)

    async def test_exclui_inativas_no_escopo_por_grupo(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        alvo = full.unidades[0].grupo
        scoped = await p.get_dimensoes(grupo=[alvo])
        assert all("INATIVO" not in u.valor for u in scoped.unidades)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_dimensoes_grupo.py -v`
Expected: FAIL — `AttributeError: 'str' object has no attribute 'valor'`

- [ ] **Step 3a: Schema com unidade anotada**

```python
# backend/src/pija/schemas/dimensoes_schema.py
"""Schema do endpoint /api/v1/dimensoes — valores reais para os filtros do frontend."""
from pydantic import BaseModel, Field


class UnidadeDim(BaseModel):
    """Unidade executora anotada com o grupo assistencial (para agrupar no filtro)."""

    valor: str = Field(description="Nome da unidade funcional.")
    grupo: str | None = Field(default=None, description="Grupo assistencial da unidade.")


class DimensoesResponse(BaseModel):
    grupos: list[str] = Field(description="Grupos de unidade distintos presentes na base.")
    unidades: list[UnidadeDim] = Field(description="Unidades funcionais distintas (exclui inativas), anotadas com o grupo.")
    especialidades: list[str] = Field(description="Especialidades médicas distintas presentes na base.")
```

- [ ] **Step 3b: SQLs**

`dimensoes.sql` — acrescentar a coluna `grupo` (NULL nas linhas que não são unidade) e o placeholder de escopo:

```sql
-- Valores distintos para popular os filtros do frontend (grupo, unidade, especialidade).
-- A linha de unidade vem anotada com seu grupo (para agrupar no filtro do front).
-- Exclui unidades inativas (sufixo "INATIVO") do AGHU. Ordenado por tipo e valor.
SELECT 'grupo' AS tipo, grupo AS valor, NULL AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND grupo IS NOT NULL AND grupo != ''
GROUP BY grupo
UNION ALL
SELECT 'unidade' AS tipo, unidade AS valor, grupo AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND unidade IS NOT NULL AND unidade != ''
  AND unidade NOT LIKE '%INATIVO%'
GROUP BY unidade
UNION ALL
SELECT 'especialidade' AS tipo, especialidade AS valor, NULL AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND especialidade IS NOT NULL AND especialidade != ''
GROUP BY especialidade
ORDER BY tipo, valor
```

Criar `backend/src/pija/sql/dimensoes_escopo.sql` (escopo por grupo — unidades anotadas + especialidades):

```sql
-- Escopo em cascata por GRUPO: unidades daquele(s) grupo(s) e suas especialidades.
-- {filtros} é preenchido pelo provider com "AND grupo IN (:grupo_0, ...)".
SELECT 'unidade' AS tipo, unidade AS valor, grupo AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND unidade IS NOT NULL AND unidade != ''
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
GROUP BY unidade
UNION ALL
SELECT 'especialidade' AS tipo, especialidade AS valor, NULL AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND especialidade IS NOT NULL AND especialidade != ''
  {filtros}
GROUP BY especialidade
ORDER BY tipo, valor
```

`especialidades_unidade.sql` — passar a aceitar várias unidades:

```sql
-- Especialidades distintas de UMA OU MAIS unidades executoras (filtro em cascata).
-- {filtros} é preenchido pelo provider com "AND unidade IN (:unidade_0, ...)".
SELECT especialidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND especialidade IS NOT NULL AND especialidade != ''
  {filtros}
GROUP BY especialidade
ORDER BY especialidade
```

- [ ] **Step 3c: Provider**

```python
# backend/src/pija/providers/dimensoes_provider.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.dimensoes_schema import DimensoesResponse, UnidadeDim
from pija.sql_filtros import Filtros, build_filtros


class DimensoesProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("dimensoes.sql")
        self._escopo_sql = load_sql("dimensoes_escopo.sql")
        self._esp_sql = load_sql("especialidades_unidade.sql")

    async def get_dimensoes(
        self,
        unidade: list[str] | None = None,
        grupo: list[str] | None = None,
    ) -> DimensoesResponse:
        # Cascata por UNIDADE: devolve só as especialidades daquelas unidades
        # (grupos/unidades não mudam — o front mantém os já carregados).
        if unidade:
            frag, params = build_filtros(Filtros(unidade=unidade))
            rows = await self._session.execute(
                text(self._esp_sql.replace("{filtros}", frag)), params
            )
            return DimensoesResponse(grupos=[], unidades=[], especialidades=[r[0] for r in rows])

        # Cascata por GRUPO: escopa unidades (anotadas) e especialidades.
        if grupo:
            frag, params = build_filtros(Filtros(grupo=grupo))
            rows = await self._session.execute(
                text(self._escopo_sql.replace("{filtros}", frag)), params
            )
            unidades: list[UnidadeDim] = []
            especialidades: list[str] = []
            for tipo, valor, grupo_da_unidade in rows:
                if tipo == "unidade":
                    unidades.append(UnidadeDim(valor=valor, grupo=grupo_da_unidade))
                else:
                    especialidades.append(valor)
            return DimensoesResponse(grupos=[], unidades=unidades, especialidades=especialidades)

        rows = await self._session.execute(text(self._sql))
        grupos: list[str] = []
        unidades = []
        especialidades = []
        for tipo, valor, grupo_da_unidade in rows:
            if tipo == "grupo":
                grupos.append(valor)
            elif tipo == "unidade":
                unidades.append(UnidadeDim(valor=valor, grupo=grupo_da_unidade))
            else:
                especialidades.append(valor)
        return DimensoesResponse(grupos=grupos, unidades=unidades, especialidades=especialidades)
```

- [ ] **Step 3d: Controller**

```python
# backend/src/pija/controllers/dimensoes_controller.py
from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.providers.dimensoes_provider import DimensoesProvider
from pija.schemas.dimensoes_schema import DimensoesResponse


async def get_dimensoes(
    unidade: list[str] | None = Query(
        None,
        description="Se informado (repetível), devolve apenas as especialidades daquelas unidades; grupos/unidades voltam vazios.",
    ),
    grupo: list[str] | None = Query(
        None,
        description="Se informado (repetível), escopa unidades e especialidades àqueles grupos assistenciais.",
    ),
    session: AsyncSession = Depends(get_db),
) -> DimensoesResponse:
    return await DimensoesProvider(session).get_dimensoes(unidade=unidade, grupo=grupo)
```

- [ ] **Step 4: Run tests**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_dimensoes_grupo.py tests/test_dimensoes.py -v`
Expected: PASS. `test_dimensoes.py` precisa de ajuste: `result.unidades` agora são objetos → comparar `u.valor` (ex.: `assert all("INATIVO" not in u.valor for u in result.unidades)` e `alvo = full.unidades[0].valor`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/pija/sql backend/src/pija/schemas/dimensoes_schema.py backend/src/pija/providers/dimensoes_provider.py backend/src/pija/controllers/dimensoes_controller.py backend/tests
git commit -m "feat(dimensoes): escopo por grupo e unidades anotadas com grupo"
```

---

## Task 9: Frontend consome o novo `/dimensoes`

**Files:**
- Modify: `frontend/src/schemas/api.schemas.ts:74-78`
- Modify: `frontend/src/services/api.ts` (assinatura de `getDimensoes`)
- Modify: `frontend/src/stores/useDimensoesStore.ts`
- Create: `frontend/src/lib/dimensoes.ts`
- Test: `frontend/src/lib/dimensoes.test.ts`

- [ ] **Step 1: Write the failing test (lógica pura de agrupamento)**

```typescript
// frontend/src/lib/dimensoes.test.ts
import { describe, it, expect } from 'vitest'
import { agruparUnidades } from './dimensoes'

describe('agruparUnidades', () => {
  it('agrupa por grupo preservando a ordem de aparição', () => {
    const r = agruparUnidades([
      { valor: 'UAC: BIOQUÍMICA', grupo: 'Análises Clínicas' },
      { valor: 'UDI: MAMOGRAFIA', grupo: 'Diagnóstico por Imagem' },
      { valor: 'UAC: SOROLOGIA', grupo: 'Análises Clínicas' },
    ])
    expect(r).toEqual([
      { label: 'Análises Clínicas', options: ['UAC: BIOQUÍMICA', 'UAC: SOROLOGIA'] },
      { label: 'Diagnóstico por Imagem', options: ['UDI: MAMOGRAFIA'] },
    ])
  })

  it('agrupa unidades sem grupo sob "Sem grupo"', () => {
    const r = agruparUnidades([{ valor: 'X', grupo: null }])
    expect(r).toEqual([{ label: 'Sem grupo', options: ['X'] }])
  })

  it('lista vazia devolve vazio', () => {
    expect(agruparUnidades([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/lib/dimensoes.test.ts`
Expected: FAIL — `Failed to resolve import "./dimensoes"`

- [ ] **Step 3a: Lógica pura**

```typescript
// frontend/src/lib/dimensoes.ts
import type { UnidadeDim } from '@/types/api.types'

export interface GrupoDeOpcoes {
  label: string
  options: string[]
}

/** Agrupa unidades por grupo assistencial, preservando a ordem de aparição. */
export function agruparUnidades(unidades: readonly UnidadeDim[]): GrupoDeOpcoes[] {
  const blocos: GrupoDeOpcoes[] = []
  const indice = new Map<string, GrupoDeOpcoes>()
  for (const u of unidades) {
    const label = u.grupo ?? 'Sem grupo'
    let bloco = indice.get(label)
    if (!bloco) {
      bloco = { label, options: [] }
      indice.set(label, bloco)
      blocos.push(bloco)
    }
    bloco.options.push(u.valor)
  }
  return blocos
}
```

- [ ] **Step 3b: Tipo, schema Zod e api**

Em `frontend/src/types/api.types.ts`, adicionar:

```typescript
export interface UnidadeDim {
  valor: string
  grupo: string | null
}
```

Em `frontend/src/schemas/api.schemas.ts`, trocar o schema de dimensões:

```typescript
export const UnidadeDimSchema = z.object({
  valor: z.string(),
  grupo: z.string().nullable(),
})

export const DimensoesResponseSchema = z.object({
  grupos: z.array(z.string()),
  unidades: z.array(UnidadeDimSchema),
  especialidades: z.array(z.string()),
})
```

Em `frontend/src/services/api.ts`, substituir **toda** a função `getDimensoes` (linhas 120-134). O mock é **inline** (não existe `mockDimensoes`); ele passa a devolver `unidades` como objetos e a respeitar o escopo por grupo:

```typescript
/**
 * GET /api/v1/dimensoes
 * Sem params: listas completas. Com `grupo`/`unidade`: listas escopadas (cascata).
 * Em modo mock, devolve as listas estáticas de exemplo.
 */
export async function getDimensoes(
  params: { grupo?: string[]; unidade?: string[] } = {},
): Promise<DimensoesResponse> {
  if (USE_MOCK) {
    await delay(200)
    // No mock, todas as unidades pertencem ao grupo "Ambulatorial".
    const unidades = UNIDADES.map((u) => ({ valor: u, grupo: 'Ambulatorial' }))
    const escopadas = params.grupo?.length
      ? unidades.filter((u) => params.grupo!.includes(u.grupo))
      : unidades
    return {
      grupos: [...GRUPOS],
      unidades: escopadas,
      especialidades: [...ESPECIALIDADES],
    }
  }
  const { data } = await client.get<DimensoesResponse>('/dimensoes', { params })
  return DimensoesResponseSchema.parse(data)
}
```

(o `paramsSerializer` do `api.ts` já serializa arrays como chave repetida — nada a mudar nele)

- [ ] **Step 3c: Store de dimensões**

```typescript
// frontend/src/stores/useDimensoesStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDimensoes } from '@/services/api'
import { agruparUnidades } from '@/lib/dimensoes'
import type { UnidadeDim } from '@/types/api.types'

/**
 * useDimensoesStore — valores reais dos filtros (grupo, unidade, especialidade).
 * Carrega uma vez; `scopeByGrupo`/`scopeEspecialidades` aplicam a cascata.
 */
export const useDimensoesStore = defineStore('dimensoes', () => {
  const grupos = ref<string[]>([])
  const unidades = ref<UnidadeDim[]>([])
  const especialidades = ref<string[]>([])
  // Listas completas (sem escopo) — usadas ao limpar a seleção do pai.
  const unidadesFull = ref<UnidadeDim[]>([])
  const especialidadesFull = ref<string[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  /** Unidades agrupadas por grupo, para os optgroups do filtro. */
  const unidadesAgrupadas = computed(() => agruparUnidades(unidades.value))
  /** Nomes das unidades (lista plana), para o `options` do FilterSelect. */
  const unidadesValores = computed(() => unidades.value.map((u) => u.valor))

  async function load(): Promise<void> {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const d = await getDimensoes()
      grupos.value = d.grupos
      unidades.value = d.unidades
      unidadesFull.value = d.unidades
      especialidades.value = d.especialidades
      especialidadesFull.value = d.especialidades
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** Cascata nível 1: escopa unidades E especialidades pelos grupos (ou restaura tudo). */
  async function scopeByGrupo(grupo: string[]): Promise<void> {
    if (grupo.length === 0) {
      unidades.value = unidadesFull.value
      especialidades.value = especialidadesFull.value
      return
    }
    const d = await getDimensoes({ grupo })
    unidades.value = d.unidades
    especialidades.value = d.especialidades
  }

  /** Cascata nível 2: escopa especialidades pelas unidades (ou volta ao escopo do grupo). */
  async function scopeEspecialidades(unidade: string[]): Promise<void> {
    if (unidade.length === 0) {
      especialidades.value = especialidadesFull.value
      return
    }
    const d = await getDimensoes({ unidade })
    especialidades.value = d.especialidades
  }

  return {
    grupos, unidades, especialidades, unidadesFull, especialidadesFull, loaded, loading,
    unidadesAgrupadas, unidadesValores,
    load, scopeByGrupo, scopeEspecialidades,
  }
})
```

- [ ] **Step 4: Run tests + type-check**

Run: `cd frontend; npx vitest run; npm run type-check`
Expected: testes PASS; type-check aponta `FilterBar.vue` (usa `dimensoes.unidades` como `string[]`) — corrigido no Task 11.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/dimensoes.ts frontend/src/lib/dimensoes.test.ts frontend/src/types/api.types.ts frontend/src/schemas/api.schemas.ts frontend/src/services/api.ts frontend/src/stores/useDimensoesStore.ts
git commit -m "feat(dimensoes): front consome unidades anotadas e expoe agrupamento/escopo por grupo"
```

---

# FASE 4 — Cascata completa + optgroups

## Task 10: Travar o agrupamento por rótulo exato (regressão)

**Files:**
- Test: `frontend/src/lib/dimensoes.test.ts` (acrescentar bloco)

- [ ] **Step 1: Acrescentar o teste**

```typescript
describe('agruparUnidades — estabilidade', () => {
  it('não mistura opções entre grupos com nomes parecidos', () => {
    const r = agruparUnidades([
      { valor: 'A1', grupo: 'Ambulatorial' },
      { valor: 'B1', grupo: 'Ambulatório' },
      { valor: 'A2', grupo: 'Ambulatorial' },
    ])
    expect(r.map((b) => b.label)).toEqual(['Ambulatorial', 'Ambulatório'])
    expect(r[0].options).toEqual(['A1', 'A2'])
    expect(r[1].options).toEqual(['B1'])
  })
})
```

- [ ] **Step 2: Run**

Run: `cd frontend; npx vitest run src/lib/dimensoes.test.ts`
Expected: PASS (a implementação do Task 9 já satisfaz — este teste trava o comportamento)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/dimensoes.test.ts
git commit -m "test(dimensoes): trava agrupamento por rotulo exato"
```

---

## Task 11: `FilterBar` com cascata Grupo → Unidade → Especialidade e optgroups

**Files:**
- Modify: `frontend/src/components/ui/FilterBar.vue`

- [ ] **Step 1: Reescrever o script e os selects**

```vue
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useFilterStore } from '@/stores/useFilterStore'
import { useDimensoesStore } from '@/stores/useDimensoesStore'
import FilterSelect from './FilterSelect.vue'
import SegmentedControl from './SegmentedControl.vue'
import BaseButton from './BaseButton.vue'

const filter = useFilterStore()
const dimensoes = useDimensoesStore()

// Popula os filtros com os valores reais da base (uma vez).
onMounted(() => dimensoes.load())

// Cascata nível 1: ao trocar o Grupo, limpa os filhos e reescopa unidade+especialidade.
watch(
  () => filter.grupo,
  (g) => {
    if (filter.unidade.length) filter.setUnidades([])
    if (filter.especialidade.length) filter.setEspecialidades([])
    void dimensoes.scopeByGrupo(g)
  },
  { deep: true },
)

// Cascata nível 2: ao trocar a Unidade, limpa a especialidade e reescopa a lista.
watch(
  () => filter.unidade,
  (u) => {
    if (filter.especialidade.length) filter.setEspecialidades([])
    void dimensoes.scopeEspecialidades(u)
  },
  { deep: true },
)

const groupByOptions = [
  { value: 'unidade', label: 'Por unidade' },
  { value: 'especialidade', label: 'Por especialidade' },
]
</script>
```

E os três selects (note `:groups` na Unidade):

```vue
      <FilterSelect
        label="Grupo" :options="dimensoes.grupos"
        :model-value="filter.grupo"
        @update:model-value="filter.setGrupos($event)"
      />
      <FilterSelect
        label="Unidade executora"
        :options="dimensoes.unidadesValores"
        :groups="dimensoes.unidadesAgrupadas"
        :model-value="filter.unidade"
        @update:model-value="filter.setUnidades($event)"
      />
      <FilterSelect
        label="Especialidade" :options="dimensoes.especialidades"
        :model-value="filter.especialidade"
        @update:model-value="filter.setEspecialidades($event)"
      />
```

- [ ] **Step 2: Verificar tipos e a suíte**

Run: `cd frontend; npm run type-check; npx vitest run`
Expected: type-check limpo; todos os testes PASS.

- [ ] **Step 3: Verificar no navegador (dados reais)**

Run: `cd frontend; npm run dev` (com `VITE_USE_MOCK=false` e o backend no ar) e abrir o dashboard.
Expected:
1. "Unidade executora" abre com as unidades **sob cabeçalhos por Grupo** (Análises Clínicas, Diagnóstico por Imagem, Anatomia Patológica, Ambulatorial, Internação, …).
2. Marcar **Grupo = Diagnóstico por Imagem** → a lista de Unidade passa a mostrar só executores `UDI:` e a de Especialidade encolhe.
3. Marcar 2 grupos → a Unidade mostra os dois blocos.
4. Limpar o Grupo → listas completas voltam.
5. Marcar 2 unidades → KPIs recalculam considerando as duas.

- [ ] **Step 4: Rodar a suíte backend completa**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest`
Expected: PASS (toda a suíte)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/FilterBar.vue
git commit -m "feat(filtros): cascata Grupo->Unidade->Especialidade com unidades agrupadas por grupo"
```

---

## Verificação final

- [ ] Suíte backend completa verde
- [ ] `npx vitest run` e `npm run type-check` verdes
- [ ] Navegador: cascata, optgroups e multiseleção conferidos com dados reais
- [ ] Atualizar `docs/superpowers/plans/2026-07-06-feedback-apresentacao.md` marcando §6 como concluído
