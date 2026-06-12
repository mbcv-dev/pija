# Design — Fase 2: 3 Endpoints Analíticos

> **Status:** aprovado em brainstorming (2026-06-12). Contrato de design da F2.
> Próximo passo: plano de implementação em `docs/plans/`.

## Contexto

F0 (scaffold) + F1 (ETL) entregues. `backend/data/pija.db` tem 2.261.659 eventos em `fato_eventos_jornada`. A F2 entrega os 3 endpoints analíticos do MVP, criando toda a camada de API (hoje só existe `/health`).

Fluxo obrigatório (SPEC §3-4): `.sql → Resources → Providers → Controllers → Routers`. SQL nativo para toda agregação analítica; SQLAlchemy async só executa esse SQL nativo sobre a tabela interna `fato_eventos_jornada`.

## Decisões de design (brainstorming 2026-06-12)

| Tema | Decisão |
|---|---|
| Cálculo dos KPIs | **SQL puro** (toda agregação em `.sql`); Python só aplica regras de negócio finais (conversão de unidade, montagem global+breakdown, top-N) |
| Forma da resposta de KPI | **Global + breakdown** por dimensão |
| Dimensão do breakdown | Param `group_by` ∈ {`unidade`, `especialidade`}, default `unidade` |
| `/gargalos` | **Ranking combinado** (dimensão × transição), ordenado por tempo médio DESC, top-N — **reusa** os SQLs de breakdown dos KPIs (não duplica SQL) |
| KPI-06 | **"última consulta → internação subsequente"** (canônico CLAUDE.md / validado HC). Corrigir SPEC/PLANO que dizem "solicitação → internação" |
| `/eventos` | Envelope `{ items, total, limit, offset }` (com `COUNT` extra) |
| Auditoria de consulta | **Deferida para F3** (depende de identidade de usuário). Endpoints ficam prontos para receber `Depends(get_current_user)` |

## Arquitetura e estrutura de arquivos

```
backend/src/pija/
├── sql/                              # SQL nativo (toda a agregação aqui)
│   ├── eventos_filtrados.sql
│   ├── eventos_count.sql
│   └── kpis/
│       ├── kpi_01_prontuario_1evento.sql
│       ├── kpi_03_consulta_agend_realiz.sql
│       ├── kpi_05_exame_solic_realiz.sql
│       ├── kpi_06_consulta_internacao.sql
│       └── kpi_07_internacao_permanencia.sql
├── resources/
│   └── sql_runner.py                 # camada Resource analítica
├── providers/
│   ├── eventos_provider.py
│   ├── kpis_provider.py
│   └── gargalos_provider.py
├── controllers/
│   ├── eventos_controller.py
│   ├── kpis_controller.py
│   └── gargalos_controller.py
├── schemas/
│   ├── common.py                     # GroupBy enum, filtros, paginação
│   ├── eventos.py
│   ├── kpis.py
│   └── gargalos.py
├── routers/
│   ├── eventos.py
│   ├── kpis.py
│   └── gargalos.py
├── deps.py                           # Depends(get_session)
├── db.py                             # + lifespan: engine/sessionmaker
└── main.py                           # registra os 3 routers
```

> Não há `gargalos.sql` — `/gargalos` reusa os SQLs de breakdown dos KPIs e faz merge/sort/top-N em Python (regra final), evitando divergência entre o ranking e os KPIs.

### Camadas

- **`SqlRunner`** (camada "Resource" analítica): `await runner.fetch_all(sql_name, params) -> list[dict]`. Carrega o arquivo de `sql/`, executa `text(sql)` com bind params na conexão async, devolve dicts. Cacheia o texto dos arquivos `.sql` em memória.
- **Providers**: chamam o `SqlRunner` e aplicam regras finais em Python (conversão de unidade, montagem do `KpiResult` global+breakdown, merge/sort/top-N do gargalos).
- **Controllers**: orquestração fina — recebem params já validados, chamam provider, devolvem DTO.
- **Routers**: `APIRouter` com prefixo `/api/v1`, `Depends(get_session)`, params validados por Pydantic v2.

### Segurança do `group_by`

`unidade`/`especialidade` são **nomes de coluna**, não podem ser bind params. Resolução: enum Pydantic `GroupBy` + whitelist. Cada SQL com breakdown tem placeholder `{group_col}` preenchido a partir de um mapa fixo `{GroupBy.unidade: "unidade", GroupBy.especialidade: "especialidade"}` — nunca de string crua do usuário. Sem risco de injeção.

### Filtros de data

Comparação lexicográfica sobre ISO 8601 (válida para ordenação cronológica). `/eventos` filtra `timestamp_principal`. Cada KPI filtra o `timestamp_principal` da sua entidade-base (documentado por KPI). Params de filtro são opcionais e aplicados via padrão `(:param IS NULL OR coluna = :param)` / `(:data_inicio IS NULL OR timestamp_principal >= :data_inicio)`.

## Contrato dos endpoints

### `GET /api/v1/eventos`

Params: `tipo_entidade?`, `unidade?`, `especialidade?`, `data_inicio?`, `data_fim?`, `limit` (1–500, default 50), `offset` (≥0, default 0).

Resposta `EventosPage`:
```json
{
  "items": [
    {
      "evento_id": "C-12345",
      "paciente_id": "987654",
      "tipo_entidade": "CONSULTA",
      "entidade_id": "12345",
      "timestamp_principal": "2026-03-01T10:00:00",
      "unidade": "AMBULATORIO X",
      "especialidade": "CARDIOLOGIA",
      "tipo_evento": "...",
      "situacao": "PACIENTE ATENDIDO"
    }
  ],
  "total": 167578,
  "limit": 50,
  "offset": 0
}
```
Sem PII: `paciente_id` é o número do prontuário (permitido). SQLs: `eventos_filtrados.sql` (filtros + LIMIT/OFFSET) e `eventos_count.sql` (mesmo WHERE, `COUNT(*)`).

### `GET /api/v1/kpis/tempos-medios`

Params: `kpi_codes?` (lista; default todos os 5), `group_by` (default `unidade`), `unidade?`, `especialidade?`, `data_inicio?`, `data_fim?`.

Resposta `KpisResponse`:
```json
{
  "kpis": [
    {
      "codigo": "KPI-03",
      "descricao": "Tempo médio agendamento → realização (consulta)",
      "unidade_tempo": "dias",
      "media_global": 12.4,
      "n_global": 130000,
      "breakdown": [
        { "dimensao": "AMBULATORIO X", "media": 15.1, "n": 4200 },
        { "dimensao": "AMBULATORIO Y", "media": 9.8, "n": 3100 }
      ]
    }
  ]
}
```
KPI sem dados no recorte → `media_global: null, n_global: 0, breakdown: []` (não é erro). `media` em dias (float).

### `GET /api/v1/gargalos`

Params: `group_by` (default `unidade`), `kpi_codes?` (transições a incluir; **default = KPI-03, KPI-05, KPI-06, KPI-07** — as transições com dimensão clara; KPI-01 só entra se pedido explicitamente), `unidade?`, `especialidade?`, `data_inicio?`, `data_fim?`, `limit` (top-N, default 10).

Resposta `GargalosResponse`:
```json
{
  "items": [
    { "dimensao_tipo": "unidade", "dimensao": "AMBULATORIO X", "transicao": "KPI-05", "media": 30.2, "n": 1200 },
    { "dimensao_tipo": "unidade", "dimensao": "AMBULATORIO Z", "transicao": "KPI-03", "media": 22.7, "n": 800 }
  ]
}
```
Itens ordenados por `media DESC`, cortados em `limit`.

## Semântica SQL dos 5 KPIs

Tempo em **dias** = `julianday(fim) − julianday(inicio)`. Cada KPI: 1 query global + 1 query com `GROUP BY {group_col}`. Todos filtram `deleted_at IS NULL`.

### KPI-01 — prontuário → 1º evento clínico
- Para cada paciente: `MIN(timestamp_principal)` dos eventos **não-PRONTUARIO** menos o `timestamp_principal` da linha PRONTUARIO.
- `AVG` sobre pacientes que têm ambos os lados.
- `group_by`: dimensão tirada do **primeiro evento clínico** (a linha PRONTUARIO não tem unidade/especialidade).
- Implementação: CTE `primeiro_evento` (min timestamp + dimensão do primeiro evento por paciente) + join com a linha PRONTUARIO do mesmo paciente.

### KPI-03 — consulta: agendamento → realização
- `WHERE tipo_entidade='CONSULTA' AND timestamp_realizacao IS NOT NULL`
- `AVG(julianday(timestamp_realizacao) − julianday(timestamp_agendamento))`
- Consultas futuras/não-atendidas excluídas automaticamente (`timestamp_realizacao` só existe quando `retorno = 'PACIENTE ATENDIDO'`).

### KPI-05 — exame: solicitação → realização
- `WHERE tipo_entidade='EXAME' AND timestamp_realizacao IS NOT NULL`
- `AVG(julianday(timestamp_realizacao) − julianday(timestamp_solicitacao))`
- **Caveat (documentar no card / UI):** dados de exames cobrem só jan–mai/2026 (janela ~4,5 meses; ver DADOS-ESTADO.md §9 achado #3). É limitação de export do HC, não bug.

### KPI-06 — última consulta → internação subsequente
- Para cada INTERNACAO, subquery correlata acha a CONSULTA **mais recente do mesmo paciente realizada antes da admissão**: `MAX(timestamp_realizacao)` com `timestamp_realizacao IS NOT NULL AND timestamp_realizacao < internacao.timestamp_principal`.
- `AVG(julianday(internacao.timestamp_principal) − julianday(ultima_consulta_realizacao))`
- `group_by`: dimensão da **internação**.
- **Decisão registrada:** "última consulta" = última consulta *realizada* antes da admissão (não a agendada). Revisável com HC.
- **Perf:** query cross-table/cross-patient — a mais cara. Plano: medir contra o DB real; adicionar índice `(paciente_id, timestamp_principal)` **só se** a query passar de poucos segundos (HANDOFF §"medir antes de adicionar").

### KPI-07 — permanência na internação
- `WHERE tipo_entidade='INTERNACAO' AND timestamp_alta_administrativa IS NOT NULL`
- `AVG(julianday(timestamp_alta_administrativa) − julianday(timestamp_principal))`
- **Caveat:** `timestamp_alta_medica` é proxy de `dthr_fim` (não há campo separado de alta médica) — relevante para obstetrícia; documentar no card.

## `/gargalos` — composição

`gargalos_provider` reusa os SQLs de **breakdown** dos KPIs aplicáveis (KPI-03, KPI-05, KPI-06, KPI-07; KPI-01 opcional), marca cada linha resultante com a `transicao` (código do KPI), concatena tudo, ordena por `media DESC` em Python e corta em `limit`. Sem SQL próprio → impossível divergir dos números dos KPIs.

## Testes (T2-4 / T2-5) — TDD, tolerância 0%

### Fixture determinística (`backend/tests/fixtures/`)
- Mini-banco SQLite: **~12 prontuários, ~50 eventos** cobrindo as 7 entidades, com datas escolhidas a dedo.
- `EXPECTED.md`: cada KPI calculado **à mão** (global + breakdown), ranking de gargalos esperado, contagens de `/eventos` por filtro.
- Casos-limite incluídos: consulta não-atendida (`realizacao` NULL → fora do KPI-03), consulta futura, internação sem alta (fora do KPI-07), paciente sem evento clínico (fora do KPI-01), exame sem realização (fora do KPI-05).

### Testes
- TDD: escrever testes contra `EXPECTED.md` **antes** dos providers.
- `httpx.AsyncClient` + override de `Depends(get_session)` apontando para a fixture.
- Cobre: cada KPI (global + breakdown) exato; gargalos na ordem exata; `/eventos` com cada filtro retorna só o recorte; paginação (`total` correto); `400/422` para params inválidos.
- Meta: cobertura ≥80% em providers/controllers (gate do PLANO §5).

## Tratamento de erros

- Param inválido → `422` (Pydantic/FastAPI automático) ou `400` explícito quando aplicável.
- KPI sem dados no recorte → resposta válida com `null`/`0`, **não** erro.
- `group_by`/`tipo_entidade` fora do enum → `422`.

## Itens fora de escopo da F2 (YAGNI)

- Auditoria de consulta (F3 — precisa de identidade de usuário).
- Autenticação / RBAC (F3).
- Drill-down por paciente individual e exportação (pós-MVP).
- Cache de resultados de KPI (medir necessidade antes).

## Docs a atualizar junto da implementação (convenção "tudo em MD")

1. `SPEC.md §5` e `docs/PLANO.md` — corrigir KPI-06 para "última consulta → internação subsequente".
2. `CLAUDE.md` — atualizar "Estado atual do desenvolvimento" (F0+F1 entregues; F2 em andamento).
3. `docs/DADOS-ESTADO.md` — já atualizado (achado #3 EXAME resolvido em 2026-06-12).