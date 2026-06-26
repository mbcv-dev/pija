# Fase 2 — Escopo dos KPIs por tipo de unidade (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar task-a-task. Steps usam checkbox (`- [ ]`).

**Goal:** Aplicar no backend o escopo dos KPIs por tipo de unidade que o HC pediu (KPI-01/03 → Ambulatorial, KPI-05 → grupos executores de exame, KPI-06/07 → Internação), renomear KPI-01 e adicionar filtro por `grupo`.

**Architecture:** Cada KPI SQL ganha (a) um recorte fixo de `grupo` (escopo, injetado de uma whitelist de constantes — seguro) e (b) o filtro opcional `:grupo`. O provider monta o fragmento de escopo; controller expõe `grupo`. O filtro de **unidade executora** já é coberto pelo parâmetro `unidade` existente.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.0 Async + aiosqlite, pytest + pytest-asyncio + httpx.

**Fora de escopo (vai para a Fase 7 — repaginação do front):** "KPIs sem número", filtro de métrica no gargalos e os seletores de filtro na UI. Aqui mexemos só no **backend**, pois o front será refeito.

**Referências:** [docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md](2026-06-26-roadmap-pos-reuniao-hc.md) (seção A) e [docs/DADOS-ESTADO.md](../DADOS-ESTADO.md).

---

## Ambiente (rodar do REPO ROOT)
```bash
source backend/venv/Scripts/activate
export JWT_SECRET="any-string-with-at-least-32-characters-yes"
export PYTHONIOENCODING=utf-8
cd backend && pytest -q
```

## File Structure

| Arquivo | Mudança |
|---|---|
| `backend/src/pija/providers/kpis_provider.py` | `KPI_GRUPO_SCOPE`, descrição KPI-01, injeção de `{grupo_scope}`, param `grupo` |
| `backend/src/pija/controllers/kpis_controller.py` | novo query param `grupo` |
| `backend/src/pija/controllers/gargalos_controller.py` | novo query param `grupo` |
| `backend/src/pija/providers/gargalos_provider.py` | repassar `grupo` no params |
| `backend/src/pija/sql/kpis/kpi_01.sql` | `pd.grupo` no CTE + `{grupo_scope}` + filtro `:grupo` |
| `backend/src/pija/sql/kpis/kpi_03.sql` `kpi_05.sql` `kpi_06.sql` `kpi_07.sql` | `{grupo_scope}` + filtro `:grupo` |
| `backend/tests/conftest.py` | fixture redesenhada com `grupo` coerente ao escopo |
| `backend/tests/test_kpis.py` `test_gargalos.py` `test_eventos.py` | expectativas recalculadas |

---

## Task 1: Renomear KPI-01 e adicionar o mapa de escopo

**Files:**
- Modify: `backend/src/pija/providers/kpis_provider.py`
- Test: `backend/tests/test_kpis_scope.py` (novo)

- [ ] **Step 1: Escrever o teste falhando**

Criar `backend/tests/test_kpis_scope.py`:
```python
from pija.providers.kpis_provider import KPI_GRUPO_SCOPE, KPI_META


def test_kpi01_renomeado():
    assert KPI_META["KPI-01"][1] == "Prontuário → 1º evento assistencial"


def test_escopo_por_grupo_definido():
    assert KPI_GRUPO_SCOPE["KPI-01"] == ["Ambulatorial"]
    assert KPI_GRUPO_SCOPE["KPI-03"] == ["Ambulatorial"]
    assert set(KPI_GRUPO_SCOPE["KPI-05"]) == {
        "Análises Clínicas", "Diagnóstico por Imagem", "Anatomia Patológica"
    }
    assert KPI_GRUPO_SCOPE["KPI-06"] == ["Internação"]
    assert KPI_GRUPO_SCOPE["KPI-07"] == ["Internação"]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && pytest tests/test_kpis_scope.py -q`
Expected: FAIL — `ImportError: cannot import name 'KPI_GRUPO_SCOPE'`.

- [ ] **Step 3: Implementar**

Em `backend/src/pija/providers/kpis_provider.py`, trocar a descrição do KPI-01 e adicionar o mapa de escopo. Substituir o bloco `KPI_META = {...}` por:
```python
from pija.unidades import (
    GRUPO_AMBULATORIAL,
    GRUPO_ANALISES_CLINICAS,
    GRUPO_ANATOMIA_PATOLOGICA,
    GRUPO_DIAGNOSTICO_IMAGEM,
    GRUPO_INTERNACAO,
)

# code → (arquivo .sql, descrição)
KPI_META: dict[str, tuple[str, str]] = {
    "KPI-01": ("kpis/kpi_01.sql", "Prontuário → 1º evento assistencial"),
    "KPI-03": ("kpis/kpi_03.sql", "Agendamento → realização (consulta)"),
    "KPI-05": ("kpis/kpi_05.sql", "Solicitação → realização (exame)"),
    "KPI-06": ("kpis/kpi_06.sql", "Última consulta → internação subsequente"),
    "KPI-07": ("kpis/kpi_07.sql", "Tempo de permanência no leito"),
}

# Recorte fixo de grupos por KPI (decisão HC 2026-06-26). Valores vêm de
# constantes (whitelist) — nunca de entrada do usuário.
KPI_GRUPO_SCOPE: dict[str, list[str]] = {
    "KPI-01": [GRUPO_AMBULATORIAL],
    "KPI-03": [GRUPO_AMBULATORIAL],
    "KPI-05": [GRUPO_ANALISES_CLINICAS, GRUPO_DIAGNOSTICO_IMAGEM, GRUPO_ANATOMIA_PATOLOGICA],
    "KPI-06": [GRUPO_INTERNACAO],
    "KPI-07": [GRUPO_INTERNACAO],
}
ALL_KPIS: list[str] = list(KPI_META)
```
(Remover a linha antiga `ALL_KPIS = list(KPI_META)` duplicada se já existir abaixo.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && pytest tests/test_kpis_scope.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add backend/src/pija/providers/kpis_provider.py backend/tests/test_kpis_scope.py
git commit -m "F2: rename KPI-01 to '1o evento assistencial' + add KPI_GRUPO_SCOPE map"
```

---

## Task 2: Redesenhar a fixture com `grupo` coerente ao escopo

A fixture atual usa `grupo='CARDIOLOGIA'`, que não é um grupo válido — com escopo, os KPIs ficariam vazios. Redesenhar para grupos reais, mantendo a aritmética de tempo simples.

**Files:**
- Modify: `backend/tests/conftest.py` (fixture `fixture_db_session`)

- [ ] **Step 1: Substituir a lista `events` da fixture**

Em `backend/tests/conftest.py`, substituir todo o bloco `events = [ ... ]` por:
```python
    events = [
        # PRONTUARIOS (pacientes 001–005)
        FatoEvento(evento_id="P-001", paciente_id="001", tipo_entidade="PRONTUARIO", entidade_id="001", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-002", paciente_id="002", tipo_entidade="PRONTUARIO", entidade_id="002", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-003", paciente_id="003", tipo_entidade="PRONTUARIO", entidade_id="003", timestamp_principal="2024-01-10", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-004", paciente_id="004", tipo_entidade="PRONTUARIO", entidade_id="004", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        FatoEvento(evento_id="P-005", paciente_id="005", tipo_entidade="PRONTUARIO", entidade_id="005", timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        # CONSULTAS — grupo Ambulatorial (KPI-01 e KPI-03)
        FatoEvento(evento_id="C-001", paciente_id="001", tipo_entidade="CONSULTA", entidade_id="C001",
                   timestamp_principal="2024-01-10", timestamp_agendamento="2024-01-10", timestamp_realizacao="2024-01-20",
                   unidade="CARDIOLOGIA (AMBULATÓRIO)", grupo="Ambulatorial", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-002", paciente_id="002", tipo_entidade="CONSULTA", entidade_id="C002",
                   timestamp_principal="2024-01-15", timestamp_agendamento="2024-01-15", timestamp_realizacao="2024-01-25",
                   unidade="CARDIOLOGIA (AMBULATÓRIO)", grupo="Ambulatorial", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-003", paciente_id="003", tipo_entidade="CONSULTA", entidade_id="C003",
                   timestamp_principal="2024-01-21", timestamp_agendamento="2024-01-21", timestamp_realizacao="2024-01-30",
                   unidade="ORTOPEDIA (AMBULATÓRIO)", grupo="Ambulatorial", especialidade="ORTOPEDIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-004", paciente_id="004", tipo_entidade="CONSULTA", entidade_id="C004",
                   timestamp_principal="2024-01-08", timestamp_agendamento="2024-01-08", timestamp_realizacao="2024-01-15",
                   unidade="ORTOPEDIA (AMBULATÓRIO)", grupo="Ambulatorial", especialidade="ORTOPEDIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-005", paciente_id="005", tipo_entidade="CONSULTA", entidade_id="C005",
                   timestamp_principal="2024-01-11", timestamp_agendamento="2024-01-11", timestamp_realizacao="2024-01-21",
                   unidade="CARDIOLOGIA (AMBULATÓRIO)", grupo="Ambulatorial", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE ATENDIDO", dt_carga="2024-01-01"),
        FatoEvento(evento_id="C-006", paciente_id="001", tipo_entidade="CONSULTA", entidade_id="C006",
                   timestamp_principal="2024-04-01", timestamp_agendamento="2024-04-01", timestamp_realizacao=None,
                   unidade="CARDIOLOGIA (AMBULATÓRIO)", grupo="Ambulatorial", especialidade="CARDIOLOGIA",
                   situacao="PACIENTE AGENDADO", dt_carga="2024-01-01"),
        # EXAMES — grupos executores (KPI-05); pacientes 008/009 SEM prontuário (não afetam KPI-01)
        FatoEvento(evento_id="E-001", paciente_id="008", tipo_entidade="EXAME", entidade_id="E001",
                   timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01", timestamp_realizacao="2024-03-05",
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="E-002", paciente_id="009", tipo_entidade="EXAME", entidade_id="E002",
                   timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01", timestamp_realizacao="2024-03-08",
                   unidade="UDI: ULTRASSONOGRAFIA", grupo="Diagnóstico por Imagem", especialidade="ORTOPEDIA", dt_carga="2024-01-01"),
        # INTERNAÇÕES — grupo Internação (KPI-06 e KPI-07)
        FatoEvento(evento_id="I-001", paciente_id="001", tipo_entidade="INTERNACAO", entidade_id="I001",
                   timestamp_principal="2024-02-05", timestamp_alta_administrativa="2024-02-10",
                   unidade="9º NORTE", grupo="Internação", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="I-002", paciente_id="002", tipo_entidade="INTERNACAO", entidade_id="I002",
                   timestamp_principal="2024-02-05", timestamp_alta_administrativa="2024-02-08",
                   unidade="9º NORTE", grupo="Internação", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="I-003", paciente_id="003", tipo_entidade="INTERNACAO", entidade_id="I003",
                   timestamp_principal="2024-02-05", timestamp_alta_administrativa="2024-02-12",
                   unidade="10º SUL", grupo="Internação", especialidade="ORTOPEDIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="I-006", paciente_id="009", tipo_entidade="INTERNACAO", entidade_id="I006",
                   timestamp_principal="2024-03-10", timestamp_alta_administrativa=None,
                   unidade="10º SUL", grupo="Internação", especialidade="ORTOPEDIA", dt_carga="2024-01-01"),
    ]
```
Atualizar o docstring da fixture para "17 eventos".

> **Valores esperados (group_by=unidade) com este dataset** — usados nas Tasks 4/5:
> - **KPI-01** (scope Ambulatorial): global 10.2 (n5); `CARDIOLOGIA (AMBULATÓRIO)` 11.0 (n3); `ORTOPEDIA (AMBULATÓRIO)` 9.0 (n2).
> - **KPI-03** (scope Ambulatorial): global 9.2 (n5); `CARDIOLOGIA (AMBULATÓRIO)` 10.0 (n3); `ORTOPEDIA (AMBULATÓRIO)` 8.0 (n2).
> - **KPI-05** (scope executores): global 5.5 (n2); `UAC: BIOQUÍMICA` 4.0 (n1); `UDI: ULTRASSONOGRAFIA` 7.0 (n1).
> - **KPI-06** (scope Internação): global 11.0 (n3); `9º NORTE` 13.5 (n2); `10º SUL` 6.0 (n1).
> - **KPI-07** (scope Internação): global 5.0 (n3); `9º NORTE` 4.0 (n2); `10º SUL` 7.0 (n1).
> - **/eventos**: total 17; CONSULTA 6; EXAME 2; INTERNACAO 4; PRONTUARIO 5.

- [ ] **Step 2: Commit**
```bash
git add backend/tests/conftest.py
git commit -m "F2: redesign test fixture with scope-coherent grupo values"
```
> Os testes existentes vão quebrar aqui (valores antigos) — são consertados nas Tasks 4/5. Commit isolado para deixar a mudança de fixture rastreável.

---

## Task 3: Filtro opcional por `grupo` (SQL + provider + controller)

**Files:**
- Modify: os 5 `backend/src/pija/sql/kpis/kpi_0*.sql`
- Modify: `kpis_provider.py`, `kpis_controller.py`, `gargalos_provider.py`, `gargalos_controller.py`

- [ ] **Step 1: Adicionar `:grupo` aos SQLs single-table (kpi_03, kpi_05, kpi_07)**

Em cada um de `kpi_03.sql`, `kpi_05.sql`, `kpi_07.sql`, adicionar **antes** da linha `GROUP BY {group_col}`:
```sql
  AND (:grupo IS NULL OR grupo = :grupo)
  {grupo_scope}
```

- [ ] **Step 2: Adicionar `:grupo` + `{grupo_scope}` ao kpi_06.sql**

Em `kpi_06.sql`, dentro da CTE `internacoes`, adicionar após a linha de `:especialidade`:
```sql
      AND (:grupo IS NULL OR grupo = :grupo)
      {grupo_scope}
```

- [ ] **Step 3: Adicionar `:grupo` + `{grupo_scope}` ao kpi_01.sql (usa `pd.grupo`)**

Em `kpi_01.sql`:
1. Na CTE `primeiro_dim`, incluir `f.grupo` no SELECT:
   ```sql
   SELECT f.paciente_id, MIN(f.evento_id) AS evento_id, f.unidade, f.especialidade, f.grupo
   ```
2. No WHERE final, após a linha de `:especialidade`, adicionar:
   ```sql
     AND (:grupo IS NULL OR pd.grupo = :grupo)
     {grupo_scope}
   ```

- [ ] **Step 4: Provider injeta `{grupo_scope}` e passa `grupo`**

Em `kpis_provider.py`, substituir o método `compute` e `get_kpis` por:
```python
    def _scope_fragment(self, code: str) -> str:
        scope = KPI_GRUPO_SCOPE.get(code) or []
        if not scope:
            return ""
        col = "pd.grupo" if code == "KPI-01" else "grupo"
        quoted = ", ".join("'" + g.replace("'", "''") + "'" for g in scope)
        return f"AND {col} IN ({quoted})"

    async def compute(self, code: str, group_by: GroupBy, params: dict) -> KpiResult:
        sql_name, descricao = KPI_META[code]
        col = GROUP_COL[group_by]
        sql = (
            load_sql(sql_name)
            .replace("{group_col}", col)
            .replace("{grupo_scope}", self._scope_fragment(code))
        )
        rows = (await self._session.execute(text(sql), params)).all()

        breakdown: list[KpiBreakdownItem] = []
        total_soma = 0.0
        total_n = 0
        for r in rows:
            m = r._mapping
            n = int(m["n"] or 0)
            if n == 0:
                continue
            soma = float(m["soma_dias"] or 0.0)
            total_soma += soma
            total_n += n
            if m["dimensao"] is not None:
                breakdown.append(KpiBreakdownItem(dimensao=m["dimensao"], media=soma / n, n=n))

        breakdown.sort(key=lambda b: (-b.media, b.dimensao))
        media_global = (total_soma / total_n) if total_n else None
        return KpiResult(
            codigo=code, descricao=descricao,
            media_global=media_global, n_global=total_n, breakdown=breakdown,
        )

    async def get_kpis(
        self,
        *,
        kpi_codes: list[str] | None,
        group_by: GroupBy,
        unidade: str | None,
        especialidade: str | None,
        grupo: str | None,
        data_inicio: str | None,
        data_fim: str | None,
    ) -> KpisResponse:
        codes = kpi_codes or ALL_KPIS
        params = dict(
            unidade=unidade, especialidade=especialidade, grupo=grupo,
            data_inicio=data_inicio, data_fim=data_fim,
        )
        results = [await self.compute(code, group_by, params) for code in codes]
        return KpisResponse(kpis=results)
```

- [ ] **Step 5: Controller de KPIs aceita `grupo`**

Em `kpis_controller.py`, adicionar o parâmetro e repassá-lo:
```python
    grupo: str | None = Query(None, description="Restringe a um grupo assistencial. Ex: `Ambulatorial`, `Internação`."),
```
(colocar logo após o parâmetro `especialidade`), e no `return await provider.get_kpis(...)` adicionar `grupo=grupo,`.

- [ ] **Step 6: Gargalos repassa `grupo`**

Em `gargalos_provider.py`, no método `get_gargalos`, adicionar `grupo: str | None,` na assinatura (após `especialidade`) e incluir `grupo=grupo,` no dict `params`.
Em `gargalos_controller.py`, adicionar o mesmo `grupo: str | None = Query(None, ...)` (após `especialidade`) e repassar `grupo=grupo,` na chamada `get_gargalos(...)`.

- [ ] **Step 7: Rodar testes de unidade do provider (ainda vão falhar por valores — ok) e checar import/SQL**

Run: `cd backend && pytest tests/test_kpis_scope.py tests/test_app_wiring.py -q`
Expected: test_kpis_scope PASS; app sobe sem erro de import.

- [ ] **Step 8: Commit**
```bash
git add backend/src/pija/sql/kpis/ backend/src/pija/providers/kpis_provider.py backend/src/pija/controllers/kpis_controller.py backend/src/pija/providers/gargalos_provider.py backend/src/pija/controllers/gargalos_controller.py
git commit -m "F2: scope KPIs by grupo + optional grupo filter (SQL/provider/controller)"
```

---

## Task 4: Atualizar testes de KPIs e gargalos aos novos valores

**Files:**
- Modify: `backend/tests/test_kpis.py`, `backend/tests/test_gargalos.py`

- [ ] **Step 1: Atualizar `test_kpis.py`**

Substituir os asserts dos KPIs pelos valores da Task 2 e adicionar a chamada com `grupo`. Trocar a função helper e os testes:
```python
async def _kpis(session, **over):
    provider = KpisProvider(session)
    params = dict(kpi_codes=None, group_by=GroupBy.unidade,
                  unidade=None, especialidade=None, grupo=None,
                  data_inicio=None, data_fim=None)
    params.update(over)
    result = await provider.get_kpis(**params)
    return {k.codigo: k for k in result.kpis}
```
e os valores:
```python
    async def test_kpi_01(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-01"]
        assert k.media_global == pytest.approx(10.2, abs=1e-9)
        assert k.n_global == 5
        assert _bd(k)["CARDIOLOGIA (AMBULATÓRIO)"] == (pytest.approx(11.0), 3)
        assert _bd(k)["ORTOPEDIA (AMBULATÓRIO)"] == (pytest.approx(9.0), 2)

    async def test_kpi_03(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-03"]
        assert k.media_global == pytest.approx(9.2, abs=1e-9)
        assert k.n_global == 5

    async def test_kpi_05_calculado(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-05"]
        assert k.media_global == pytest.approx(5.5, abs=1e-9)
        assert k.n_global == 2

    async def test_kpi_06(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-06"]
        assert k.media_global == pytest.approx(11.0, abs=1e-9)
        assert k.n_global == 3

    async def test_kpi_07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-07"]
        assert k.media_global == pytest.approx(5.0, abs=1e-9)
        assert k.n_global == 3
```
Remover/ajustar `test_filtro_especialidade_kpi07` para o novo dataset:
```python
    async def test_filtro_especialidade_kpi07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, especialidade="CARDIOLOGIA"))["KPI-07"]
        assert k.media_global == pytest.approx(4.0, abs=1e-9)  # I-001(5), I-002(3)
        assert k.n_global == 2
```
Adicionar teste do escopo e do filtro de grupo:
```python
    async def test_escopo_exclui_grupo_fora(self, fixture_db_session):
        # KPI-03 só conta grupo Ambulatorial; internações/exames não entram
        k = (await _kpis(fixture_db_session))["KPI-03"]
        assert all("AMBULAT" in b.dimensao.upper() for b in k.breakdown)

    async def test_filtro_grupo_internacao_no_kpi07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, grupo="Internação"))["KPI-07"]
        assert k.n_global == 3  # todas as internações são Internação
        k2 = (await _kpis(fixture_db_session, grupo="Ambulatorial"))["KPI-07"]
        assert k2.n_global == 0  # nenhuma internação é Ambulatorial
```
Manter `test_group_by_especialidade` e `test_subconjunto_kpi_codes` (ajustar valores se referenciarem médias).

- [ ] **Step 2: Atualizar `test_gargalos.py`**

Recalcular o ranking esperado. Itens (media) = KPI-03 CARD 10.0, KPI-03 ORTO 8.0, KPI-05 UAC 4.0, KPI-05 UDI 7.0, KPI-06 9N 13.5, KPI-06 10S 6.0, KPI-07 9N 4.0, KPI-07 10S 7.0. Ordenado por `(-media, transicao, dimensao)`:
```python
    async def test_ranking_completo_determinista(self, fixture_db_session):
        result = await _gargalos(fixture_db_session)
        got = [(i.transicao, i.dimensao, round(i.media, 2)) for i in result.items]
        assert got == [
            ("KPI-06", "9º NORTE", 13.5),
            ("KPI-03", "CARDIOLOGIA (AMBULATÓRIO)", 10.0),
            ("KPI-03", "ORTOPEDIA (AMBULATÓRIO)", 8.0),
            ("KPI-05", "UDI: ULTRASSONOGRAFIA", 7.0),
            ("KPI-07", "10º SUL", 7.0),
            ("KPI-06", "10º SUL", 6.0),
            ("KPI-05", "UAC: BIOQUÍMICA", 4.0),
            ("KPI-07", "9º NORTE", 4.0),
        ]
```
Atualizar `_gargalos` para passar `grupo=None`:
```python
async def _gargalos(session, **over):
    provider = GargalosProvider(session)
    params = dict(kpi_codes=None, group_by=GroupBy.unidade,
                  unidade=None, especialidade=None, grupo=None,
                  data_inicio=None, data_fim=None, limit=10)
    params.update(over)
    return await provider.get_gargalos(**params)
```
E o `test_top1_kpi06_cardiologia` → ajustar para a nova dimensão:
```python
    async def test_top1(self, fixture_db_session):
        top = (await _gargalos(fixture_db_session)).items[0]
        assert top.transicao == "KPI-06"
        assert top.dimensao == "9º NORTE"
        assert top.media == pytest.approx(13.5, abs=1e-9)
```

- [ ] **Step 3: Rodar**

Run: `cd backend && pytest tests/test_kpis.py tests/test_gargalos.py -q`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add backend/tests/test_kpis.py backend/tests/test_gargalos.py
git commit -m "F2: update KPI/gargalos tests for scope + new fixture values"
```

---

## Task 5: Atualizar /eventos tests, suíte completa e smoke real

**Files:**
- Modify: `backend/tests/test_eventos.py`

- [ ] **Step 1: Ajustar expectativas de `/eventos` ao novo dataset**

No `test_eventos.py`, atualizar:
```python
    async def test_total_sem_filtros(self, fixture_db_session):
        result = await _list(fixture_db_session)
        assert result.total == 17

    async def test_filtra_por_tipo_entidade(self, fixture_db_session):
        result = await _list(fixture_db_session, tipo_entidade="CONSULTA")
        assert result.total == 6
```
Trocar `test_filtra_por_unidade` para uma unidade que existe no novo dataset:
```python
    async def test_filtra_por_unidade(self, fixture_db_session):
        result = await _list(fixture_db_session, unidade="9º NORTE")
        assert result.total == 2  # I-001, I-002
```
Ajustar `test_filtra_por_periodo` (consultas 10–15 jan): C-001(10), C-005(11), C-002(15) ⇒ total 3 (mantém). `test_paginacao_sem_sobreposicao`: 17 itens ⇒ p1=8, p2=8 (mantém). `test_campos_nao_nulos_no_item`: PRONTUARIO unidade "" (mantém).

- [ ] **Step 2: Suíte completa**

Run: `cd backend && pytest -q`
Expected: tudo verde.

- [ ] **Step 3: Smoke contra o DB real (KPIs escopados)**

Run (repo root):
```bash
python - <<'PY'
import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy
NF = dict(unidade=None, especialidade=None, grupo=None, data_inicio=None, data_fim=None)
async def main():
    eng = create_async_engine("sqlite+aiosqlite:///./backend/data/pija.db")
    sm = async_sessionmaker(eng, expire_on_commit=False)
    async with sm() as s:
        r = await KpisProvider(s).get_kpis(kpi_codes=None, group_by=GroupBy.unidade, **NF)
        for k in r.kpis:
            print(f"{k.codigo}: global={k.media_global} n={k.n_global} top_dim={k.breakdown[0].dimensao if k.breakdown else '-'}")
    await eng.dispose()
asyncio.run(main())
PY
```
Expected: cada KPI retorna n>0 e o `top_dim` coerente com o escopo (KPI-03 deve trazer unidades de ambulatório; KPI-05, unidades executoras de exame; KPI-06/07, unidades de internação). Anotar números.

- [ ] **Step 4: Commit**
```bash
git add backend/tests/test_eventos.py
git commit -m "F2: update /eventos tests for new fixture; full suite green"
```

---

## Task 6: Atualizar docs

**Files:**
- Modify: `docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md` (marcar itens de Fase 2 backend como feitos)
- Modify: `SPEC.md` / `docs/PLANO.md` se descreverem os KPIs sem o escopo

- [ ] **Step 1: Marcar Fase 2 (backend) no roadmap**
Marcar `[x]` os itens de escopo/rename/filtro `grupo` e anotar que os itens de UX foram para a Fase 7.

- [ ] **Step 2: Commit**
```bash
git add docs/
git commit -m "docs: mark F2 backend (KPI scoping) done; UX deferred to F7"
```

---

## Self-Review

**1. Spec coverage (roadmap seção A):**
- KPI-01 renomear + escopo Ambulatorial → Task 1 (rename) + Task 3 (scope) ✓
- KPI-03 escopo Ambulatorial → Task 3 ✓
- KPI-05 escopo executores + filtro unidade executora → Task 3 (scope) + filtro `unidade` já existente (documentado) ✓
- KPI-06 escopo Internação → Task 3 ✓
- KPI-07 escopo Internação → Task 3 ✓ (sub-métrica alta→saída **fora de escopo** — bloqueada por dado; aguardando HC)
- Filtro por `grupo` → Task 3 ✓
- Fixture coerente + valores → Task 2/4/5 ✓
- Itens de UX (KPIs sem número, gargalos por métrica) → **explicitamente diferidos para Fase 7** ✓

**2. Placeholder scan:** sem TBD; todo passo tem código/comando. O `{grupo_scope}` é substituído por fragmento construído de constantes (seguro) — não é placeholder de plano.

**3. Type consistency:** `get_kpis(..., grupo=...)` e `get_gargalos(..., grupo=...)` adicionados de forma consistente em provider+controller; `compute()` inalterado na assinatura (só corpo); `KPI_GRUPO_SCOPE` e `_scope_fragment` coerentes; `pd.grupo` só no KPI-01 (CTE atualizada na Task 3 Step 3). Ranking do gargalos recalculado e corrigido no Step 2 da Task 4.
