# Endurecimento do backlog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar os cinco itens abertos do backlog acumulado nas reviews de julho/agosto — dependência de filtros nos controllers, fixture de client compartilhada, cancelamento de requisições obsoletas, invariantes da distribuição no dado real, e parse por KPI em vez de tudo-ou-nada.

**Architecture:** Nenhuma mudança de contrato HTTP e nenhuma mudança de `.sql`. Backend: extrair uma dependência `FiltrosQuery` injetada por `Depends()` (o FastAPI continua expondo os params no OpenAPI) e mover uma fixture de teste para `conftest.py`. Frontend: `AbortController` nos fetches que reagem a filtro, `.superRefine` no zod da distribuição, e validação por entrada em vez de por resposta.

**Tech Stack:** FastAPI + pytest (backend); Vue 3 + TS + Pinia + zod + vitest (frontend).

**Spec:** [docs/superpowers/specs/2026-08-05-endurecimento-backlog-design.md](../specs/2026-08-05-endurecimento-backlog-design.md) — decisões travadas, NÃO re-perguntar.

---

## Contexto essencial do repo (leia antes da Task 1)

- **Branch:** `feat/endurecimento-e-cirurgia`. Não voltar para `main`.
- **Testes:** backend `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q` (**186 hoje**, ou 188 se o plano do KPI-05 já rodou) · frontend `cd frontend; npx vitest run` (**189 hoje**) e `npm run type-check`. **Não regredir.**
- Comentários/docstrings em português explicando o porquê. Commits: imperativa, corpo explica o porquê, sem `Co-Authored-By`, **sem acentos na mensagem**.
- **Não commitar `backend/data/`.**
- **Ao final:** `railway up --no-gitignore` a partir de `backend/` (a Task 1 muda o backend).

### O item que virou pré-requisito

A **Task 5** (parse por KPI) é pré-requisito da frente de Cirurgia. Adicionar KPI-10/10B cria uma
janela em que backend e frontend discordam sobre os códigos válidos — e essa janela é real, porque
o frontend na Vercel faz deploy automático e o backend no Railway exige `railway up` manual. Com o
parse estrito de hoje, um `codigo` desconhecido **derruba os seis histogramas de uma vez**.
Se for preciso cortar escopo desta frente, corte qualquer outra task, não a 5.

### O item 2.4 da spec não tem task

O defeito "submétrica sem dado é reportada como acima da meta" foi resolvido **por deleção**: a
barra de meta de 4h inteira sai na frente de
[simplificação](2026-08-05-simplificacao-breakdown-e-cores.md). Sem barra, não há defeito.
Está riscado na spec de propósito — não reabrir.

---

### Task 1: `FiltrosQuery` — dependência única para os filtros comuns

**Files:**
- Create: `backend/src/pija/deps/filtros_dep.py`
- Modify: `backend/src/pija/controllers/kpis_controller.py`
- Modify: `backend/src/pija/controllers/ciclicidade_controller.py`
- Modify: `backend/src/pija/controllers/eventos_controller.py`
- Modify: `backend/src/pija/controllers/gargalos_controller.py`
- Create: `backend/tests/test_filtros_dep.py`

Os cinco endpoints repetem as mesmas declarações `Query()` de `unidade` / `especialidade` / `grupo` /
`data_inicio` / `data_fim` e a mesma montagem de `Filtros`. Params **específicos** de cada endpoint
(`group_by`, `kpi_codes`, `limit`, `offset`, `paciente_id`, `tipo_entidade`) **continuam declarados
no próprio controller** — a dependência cobre só o conjunto comum.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/test_filtros_dep.py`:

```python
"""A dependência de filtros precisa continuar aparecendo no OpenAPI.

Uma dependência mal construída some com os parâmetros da documentação sem
quebrar nenhum teste funcional — o cliente continua podendo mandar os filtros,
mas ninguém descobre que eles existem. Por isso o teste olha o schema gerado,
não só o comportamento.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from pija.main import app

COMUNS = {"unidade", "especialidade", "grupo", "data_inicio", "data_fim"}

ROTAS_COM_FILTRO = [
    "/api/v1/kpis/tempos-medios",
    "/api/v1/kpis/distribuicoes",
    "/api/v1/gargalos",
    "/api/v1/eventos",
    "/api/v1/ciclicidade",
]


@pytest.fixture
async def openapi():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/openapi.json")
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.parametrize("rota", ROTAS_COM_FILTRO)
async def test_filtros_comuns_continuam_no_openapi(openapi, rota):
    params = {p["name"] for p in openapi["paths"][rota]["get"].get("parameters", [])}
    assert COMUNS <= params, f"faltam em {rota}: {COMUNS - params}"


def test_params_especificos_nao_foram_engolidos(openapi):
    def nomes(rota):
        return {p["name"] for p in openapi["paths"][rota]["get"].get("parameters", [])}

    assert "group_by" in nomes("/api/v1/kpis/tempos-medios")
    assert "group_by" not in nomes("/api/v1/kpis/distribuicoes")
    assert {"limit", "offset"} <= nomes("/api/v1/eventos")
    assert "limit" in nomes("/api/v1/gargalos")
    assert "paciente_id" in nomes("/api/v1/ciclicidade")
```

- [ ] **Step 2: Rodar — deve PASSAR já**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_filtros_dep.py -q`
Expected: **PASS**. Este é um teste de caracterização: ele fixa o comportamento atual **antes** da
refatoração, para que a refatoração não possa alterá-lo em silêncio. Se falhar agora, o mapa de
rotas acima está errado — corrija os caminhos antes de continuar.

- [ ] **Step 3: Criar a dependência**

Criar `backend/src/pija/deps/filtros_dep.py` (criar também `backend/src/pija/deps/__init__.py` vazio
se o pacote não existir):

```python
"""Dependência única dos filtros comuns a todos os endpoints analíticos.

Existe porque cinco controllers repetiam as mesmas cinco declarações `Query()`
e a mesma montagem de `Filtros`. Uma função compartilhada comum NÃO resolveria:
o FastAPI só documenta no OpenAPI os parâmetros declarados na assinatura do
endpoint ou de uma dependência — por isso isto é uma dependência, e não um helper.
"""
from datetime import date

from fastapi import Query

from pija.sql_filtros import Filtros


def filtros_comuns(
    unidade: list[str] | None = Query(None, description="Restringe a uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Restringe a uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Restringe a um ou mais grupos assistenciais (repita o parâmetro)."),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`"),
) -> Filtros:
    """Monta o `Filtros` a partir dos parâmetros de query comuns."""
    return Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
```

- [ ] **Step 4: Adotar no `kpis_controller.py`**

Substituir o conteúdo de `backend/src/pija/controllers/kpis_controller.py` por:

```python
from fastapi import Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import get_db
from pija.deps.filtros_dep import filtros_comuns
from pija.providers.kpis_provider import ALL_KPIS, KpisProvider
from pija.schemas.common import GroupBy
from pija.schemas.kpis_schema import DistribuicoesResponse, KpisResponse
from pija.sql_filtros import Filtros


def _validar_kpi_codes(kpi_codes: list[str] | None) -> None:
    """400 em código desconhecido — mesma regra dos dois endpoints."""
    if kpi_codes:
        invalidos = [c for c in kpi_codes if c not in ALL_KPIS]
        if invalidos:
            raise HTTPException(status_code=400, detail=f"kpi_codes inválidos: {invalidos}")


async def get_kpis(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs a retornar (repita o parâmetro). Default: todos."),
    group_by: GroupBy = Query(GroupBy.unidade, description="Dimensão do breakdown: `unidade` (default) ou `especialidade`."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> KpisResponse:
    _validar_kpi_codes(kpi_codes)
    return await KpisProvider(session).get_kpis(kpi_codes=kpi_codes, group_by=group_by, filtros=filtros)


async def get_distribuicoes(
    kpi_codes: list[str] | None = Query(None, description="Subconjunto de KPIs a retornar (repita o parâmetro). Default: todos."),
    filtros: Filtros = Depends(filtros_comuns),
    session: AsyncSession = Depends(get_db),
) -> DistribuicoesResponse:
    # Sem group_by: a distribuição não tem breakdown por dimensão, só o histograma global.
    _validar_kpi_codes(kpi_codes)
    return await KpisProvider(session).get_distribuicoes(kpi_codes=kpi_codes, filtros=filtros)
```

- [ ] **Step 5: Adotar nos outros três controllers**

Aplicar a mesma transformação em `ciclicidade_controller.py`, `eventos_controller.py` e
`gargalos_controller.py`. Em cada um:

1. Importar `from pija.deps.filtros_dep import filtros_comuns` e `from pija.sql_filtros import Filtros`.
2. **Apagar** as cinco declarações `Query()` de `unidade`, `especialidade`, `grupo`, `data_inicio`, `data_fim`.
3. **Adicionar** `filtros: Filtros = Depends(filtros_comuns),` no lugar delas.
4. **Apagar** o bloco `filtros = Filtros(...)` do corpo — a variável já chega pronta.
5. **Manter intactos** os params próprios: `paciente_id` (ciclicidade e eventos), `tipo_entidade`,
   `limit`, `offset` (eventos), `kpi_codes`, `group_by`, `limit` (gargalos).

Cuidado: em `ciclicidade_controller.py` as descrições dos filtros falam de "coorte", não de
"filtra" — ao passar a usar a descrição genérica da dependência, essa nuance se perde no OpenAPI.
É aceitável (o texto genérico não fica errado), mas **registre no relatório** que isso aconteceu.

- [ ] **Step 6: Rodar a suíte completa**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: tudo PASS, incluindo `test_filtros_dep.py`. Se algum teste de API quebrar, a refatoração
mudou a interface HTTP — corrija a refatoração, **não o teste**.

- [ ] **Step 7: Commit**

```bash
git add backend/src/pija/deps/ backend/src/pija/controllers/ backend/tests/test_filtros_dep.py
git commit -m "refactor(api): filtros comuns viram dependencia injetada" -m "Cinco controllers repetiam as mesmas cinco declaracoes Query e a mesma montagem de Filtros. Uma funcao compartilhada comum nao resolveria: o FastAPI so documenta no OpenAPI o que esta na assinatura do endpoint ou de uma dependencia. Teste novo fixa que os filtros continuam no schema gerado e que os params especificos de cada rota nao foram engolidos."
```

---

### Task 2: Fixture `client` sobe para o `conftest.py`

**Files:**
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_kpis_distribuicoes.py`
- Modify: `backend/tests/test_kpis_multiselect.py`
- Modify: `backend/tests/test_gargalos_multiselect.py`
- Modify: `backend/tests/test_ciclicidade.py`
- Modify: `backend/tests/test_integration_f2.py`

- [ ] **Step 1: Adicionar a fixture ao `conftest.py`**

Ao final de `backend/tests/conftest.py`:

```python
@pytest.fixture
async def client(async_engine, fixture_db_session):
    """HTTP client ASGI apontando para o mesmo engine populado por `fixture_db_session`.

    Depende de `fixture_db_session` de propósito: é o que garante que o banco já
    está populado antes da primeira requisição. Estava duplicada em cinco arquivos
    de teste antes de subir para cá.
    """
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from pija.main import app

    app.state.session_factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

> Os imports ficam dentro da função porque `conftest.py` define variáveis de ambiente no topo
> (`JWT_SECRET`, `SQLITE_PATH`) antes de importar qualquer coisa de `pija` — importar `pija.main`
> no topo do arquivo quebraria essa ordem.

- [ ] **Step 2: Remover as cinco cópias**

Em cada um dos cinco arquivos listados, apagar o bloco `@pytest.fixture ... async def client(...)`
e os imports que ficarem órfãos (`ASGITransport`, `AsyncClient`, `async_sessionmaker`, `app`).
**Não** apagar imports ainda usados pelo resto do arquivo — conferir cada um.

- [ ] **Step 3: Rodar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: mesmo número de testes de antes, todos passando. Se algum arquivo ficar com import não
usado, o `ruff check` acusa:

Run: `cd backend; .\venv\Scripts\python.exe -m ruff check tests/`
Expected: sem erros novos nos cinco arquivos tocados.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: sobe a fixture do client HTTP para o conftest" -m "Cinco arquivos carregavam copias quase identicas. A unica parte por-arquivo -- depender de fixture_db_session para o banco estar populado -- continua sendo do contrato da fixture, agora num lugar so."
```

---

### Task 3: Invariantes estruturais da distribuição valem no dado real

**Files:**
- Modify: `frontend/src/schemas/api.schemas.ts`
- Create: `frontend/src/schemas/api.schemas.test.ts`

Hoje `frontend/src/mocks/distribuicoes.mock.test.ts` garante que `teto === buckets[último].de` e que
existe exatamente uma cauda aberta, sempre por último — mas só para o **mock**. O componente
`HistogramaTempos.vue` depende da segunda invariante, e o caminho da resposta **real** não tem essa
garantia.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/schemas/api.schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DistribuicoesResponseSchema } from './api.schemas'

/** Distribuição válida no formato que o backend devolve: 2 lineares + cauda aberta. */
const valida = {
  codigo: 'KPI-05',
  unidade_tempo: 'dias',
  p50: 1, p95: 10, teto: 10, n_total: 100,
  buckets: [
    { de: 0, ate: 5, n: 60 },
    { de: 5, ate: 10, n: 30 },
    { de: 10, ate: null, n: 10 },
  ],
}

const parse = (d: unknown) => DistribuicoesResponseSchema.safeParse({ distribuicoes: [d] })

describe('KpiDistribuicaoSchema — invariantes estruturais', () => {
  it('aceita a forma normal', () => {
    expect(parse(valida).success).toBe(true)
  })

  it('rejeita teto diferente do inicio do ultimo balde', () => {
    // O componente escala o eixo por `teto` e desenha a cauda a partir de
    // buckets[last].de. Se divergirem, o grafico mente sobre onde a cauda comeca.
    expect(parse({ ...valida, teto: 99 }).success).toBe(false)
  })

  it('rejeita duas caudas abertas', () => {
    expect(parse({
      ...valida,
      buckets: [{ de: 0, ate: null, n: 60 }, { de: 10, ate: null, n: 40 }],
    }).success).toBe(false)
  })

  it('rejeita cauda aberta que nao e a ultima', () => {
    expect(parse({
      ...valida,
      buckets: [{ de: 0, ate: null, n: 60 }, { de: 5, ate: 10, n: 40 }],
    }).success).toBe(false)
  })

  it('aceita o degenerado sem dados', () => {
    expect(parse({
      ...valida, p50: null, p95: null, teto: null, n_total: 0, buckets: [],
    }).success).toBe(true)
  })

  it('aceita o degenerado tudo-zero (um balde aberto so)', () => {
    expect(parse({
      ...valida, p50: 0, p95: 0, teto: 0, n_total: 50,
      buckets: [{ de: 0, ate: null, n: 50 }],
    }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/schemas/api.schemas.test.ts`
Expected: FAIL nos três casos de rejeição — o schema atual aceita tudo.

- [ ] **Step 3: Adicionar o `.superRefine`**

Em `frontend/src/schemas/api.schemas.ts`, substituir o `KpiDistribuicaoSchema` por:

```ts
export const KpiDistribuicaoSchema = z.object({
  codigo: KpiCodeSchema,
  unidade_tempo: z.enum(['dias', 'horas']),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  // Teto do eixo linear (= buckets[last].de), não necessariamente o p95.
  teto: z.number().nullable(),
  n_total: z.number().int().nonnegative(),
  // Vazio quando n_total = 0; 1 balde quando todos os casos são zero.
  buckets: z.array(DistBucketSchema),
}).superRefine((d, ctx) => {
  // O mock já era testado contra estas duas invariantes; aqui elas passam a
  // valer para o dado REAL, que é de onde o gráfico realmente lê.
  if (d.buckets.length === 0) return  // sem dados: nada a verificar

  const caudas = d.buckets.filter((b) => b.ate === null)
  if (caudas.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `esperava exatamente 1 balde de cauda aberta, veio ${caudas.length}`,
      path: ['buckets'],
    })
  } else if (d.buckets[d.buckets.length - 1].ate !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'a cauda aberta precisa ser o ultimo balde',
      path: ['buckets'],
    })
  }

  // HistogramaTempos escala o eixo por `teto` e desenha a cauda a partir de
  // buckets[last].de — divergência aqui faz o gráfico mentir sobre a cauda.
  const ultimo = d.buckets[d.buckets.length - 1]
  if (d.teto !== null && d.teto !== ultimo.de) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `teto (${d.teto}) precisa ser igual ao inicio do ultimo balde (${ultimo.de})`,
      path: ['teto'],
    })
  }
})
```

- [ ] **Step 4: Rodar**

Run: `cd frontend; npx vitest run` e `cd frontend; npm run type-check`
Expected: os 6 testes novos passam, o resto continua verde. **Se `distribuicoes.mock.test.ts`
quebrar, o mock viola uma invariante que ele mesmo afirmava** — investigar o mock, não afrouxar o schema.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/schemas/api.schemas.ts frontend/src/schemas/api.schemas.test.ts
git commit -m "feat(front): valida as invariantes da distribuicao no dado real" -m "O teste do mock ja garantia teto == buckets[ultimo].de e exatamente uma cauda aberta por ultimo; o HistogramaTempos depende da segunda. O caminho da resposta real nao tinha essa garantia -- agora tem, sem quebrar os dois degenerados legitimos (sem dados e tudo-zero)."
```

---

### Task 4: Parse por KPI em vez de tudo-ou-nada

**Files:**
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/services/api.test.ts`

**Esta é a task pré-requisito da frente de Cirurgia.** Hoje, um `codigo` desconhecido na resposta
faz `DistribuicoesResponseSchema.parse` lançar e o `catch` do store apaga **os seis histogramas**.

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/services/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// O módulo lê import.meta.env no topo; USE_MOCK precisa estar false para
// exercitarmos o caminho real (o do parse).
vi.mock('axios', () => {
  const get = vi.fn()
  return { default: { create: () => ({ get, interceptors: { response: { use: vi.fn() } } }) }, __get: get }
})

const bucketsOk = [{ de: 0, ate: 10, n: 90 }, { de: 10, ate: null, n: 10 }]
const dist = (codigo: string) => ({
  codigo, unidade_tempo: 'dias', p50: 1, p95: 10, teto: 10, n_total: 100, buckets: bucketsOk,
})

describe('getDistribuicoes — degradacao por KPI', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.restoreAllMocks())

  it('descarta so a entrada invalida e mantem as validas', async () => {
    const axios = (await import('axios')) as unknown as { __get: ReturnType<typeof vi.fn> }
    axios.__get.mockResolvedValue({
      data: { distribuicoes: [dist('KPI-01'), dist('KPI-99'), dist('KPI-05')] },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { getDistribuicoes } = await import('./api')
    const r = await getDistribuicoes({})

    expect(r.distribuicoes.map((d) => d.codigo)).toEqual(['KPI-01', 'KPI-05'])
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0])).toContain('KPI-99')
  })

  it('envelope malformado continua sendo erro', async () => {
    const axios = (await import('axios')) as unknown as { __get: ReturnType<typeof vi.fn> }
    axios.__get.mockResolvedValue({ data: { nada: [] } })

    const { getDistribuicoes } = await import('./api')
    await expect(getDistribuicoes({})).rejects.toThrow()
  })
})
```

> Se o mock de `axios` não casar com a forma real do módulo (`client` é criado com
> `axios.create` e usa `paramsSerializer`), ajuste o mock ao que o arquivo realmente faz — leia
> `src/services/api.ts` antes. O contrato dos dois testes é o que importa, não o formato do mock.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/services/api.test.ts`
Expected: FAIL no primeiro teste — hoje a resposta inteira é rejeitada.

- [ ] **Step 3: Implementar**

Em `frontend/src/services/api.ts`, adicionar o import do schema por entrada e substituir
`getDistribuicoes`:

```ts
import { KpiDistribuicaoSchema } from '@/schemas/api.schemas'
```

```ts
/**
 * GET /api/v1/kpis/distribuicoes — histograma dos tempos por KPI.
 *
 * Valida ENTRADA POR ENTRADA, não a resposta inteira: o histograma é
 * enhancement e enhancement degrada em partes. Um código desconhecido
 * (backend com KPI novo, frontend ainda não deployado — janela real, porque o
 * backend sobe manualmente e o front sobe automático) descartaria os seis
 * gráficos de uma vez se o parse fosse tudo-ou-nada.
 * O ENVELOPE continua estrito: se a forma externa está errada, não há o que salvar.
 */
export async function getDistribuicoes(params: DistribuicoesParams): Promise<DistribuicoesResponse> {
  if (USE_MOCK) {
    await delay(300)
    return mockDistribuicoes(params)
  }
  const { data } = await client.get<unknown>('/kpis/distribuicoes', { params })

  const envelope = z.object({ distribuicoes: z.array(z.unknown()) }).parse(data)

  const distribuicoes: DistribuicoesResponse['distribuicoes'] = []
  for (const bruta of envelope.distribuicoes) {
    const r = KpiDistribuicaoSchema.safeParse(bruta)
    if (r.success) {
      distribuicoes.push(r.data)
    } else {
      const codigo = (bruta as { codigo?: unknown })?.codigo ?? '(sem codigo)'
      console.warn(
        `[api] distribuicao descartada para ${String(codigo)}; os demais graficos seguem`,
        r.error.issues,
      )
    }
  }
  return { distribuicoes }
}
```

Adicionar `import { z } from 'zod'` no topo do arquivo se ainda não existir.

- [ ] **Step 4: Rodar**

Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: verde, sem regressão.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/services/api.test.ts
git commit -m "feat(front): distribuicao degrada por KPI, nao por resposta" -m "Um codigo desconhecido derrubava os seis histogramas de uma vez. A janela em que back e front discordam dos codigos validos e real: o front sobe automatico na Vercel e o backend exige railway up manual. Envelope segue estrito -- forma externa errada nao tem o que salvar."
```

---

### Task 5: `AbortController` nos fetches que reagem a filtro

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/stores/useKpiStore.ts`
- Modify: `frontend/src/stores/useKpiStore.test.ts`
- Modify: `frontend/src/stores/useGargaloStore.ts`
- Modify: `frontend/src/stores/useCiclicidadeStore.ts`
- Modify: `frontend/src/stores/useDimensoesStore.ts`

Hoje o guarda de sequência **descarta** a resposta obsoleta, mas a requisição continua rodando: duas
mudanças de filtro custam duas varreduras completas no backend. O guarda **permanece** — `abort()`
não é garantia (a resposta pode já estar a caminho), então ele continua sendo a proteção de
correção e o abort vira otimização de custo.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `frontend/src/stores/useKpiStore.test.ts`, dentro do `describe` existente:

```ts
  it('mudanca de filtro aborta a busca anterior', async () => {
    const abortadas: AbortSignal[] = []
    vi.mocked(getDistribuicoes).mockImplementation(async (_p, opts) => {
      if (opts?.signal) abortadas.push(opts.signal)
      return new Promise(() => {}) as never  // nunca resolve
    })

    const store = useKpiStore()
    void store.fetchDistribuicoes()
    void store.fetchDistribuicoes()

    await vi.waitFor(() => expect(abortadas.length).toBe(2))
    expect(abortadas[0].aborted).toBe(true)   // a primeira foi cancelada
    expect(abortadas[1].aborted).toBe(false)  // a mais recente segue viva
  })

  it('abort nao vira erro visivel', async () => {
    // Um AbortError e cancelamento nosso, nao falha do backend: nao pode setar
    // `error` nem deixar o store num estado de falha.
    const erroAbort = Object.assign(new Error('canceled'), { name: 'CanceledError' })
    vi.mocked(getDistribuicoes).mockRejectedValueOnce(erroAbort)

    const store = useKpiStore()
    await store.fetchDistribuicoes()

    expect(store.error).toBeNull()
  })
```

O mock de `@/services/api` no topo do arquivo precisa aceitar o segundo argumento — ajustar a
assinatura da `vi.fn` de `getDistribuicoes` para `(params, opts)`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend; npx vitest run src/stores/useKpiStore.test.ts`
Expected: FAIL — `opts` é `undefined`, `abortadas` fica vazio.

- [ ] **Step 3: Services aceitam `signal`**

Em `frontend/src/services/api.ts`, adicionar o parâmetro opcional às funções que reagem a filtro
(`getKpis`, `getDistribuicoes`, `getGargalos`, `getDimensoes`, `getCiclicidade`). Padrão, aplicado a
cada uma:

```ts
export async function getDistribuicoes(
  params: DistribuicoesParams,
  opts?: { signal?: AbortSignal },
): Promise<DistribuicoesResponse> {
  if (USE_MOCK) {
    await delay(300)
    return mockDistribuicoes(params)
  }
  const { data } = await client.get<unknown>('/kpis/distribuicoes', { params, signal: opts?.signal })
  // ... resto igual à Task 4
}
```

O `signal` entra no config do axios; nada mais muda no corpo.

- [ ] **Step 4: `useKpiStore` cancela a busca anterior**

Em `frontend/src/stores/useKpiStore.ts`, ao lado de `let distReqId = 0`, adicionar:

```ts
  /**
   * Cancela a requisição da busca anterior. O guarda de sequência continua sendo
   * a proteção de CORREÇÃO (abort não é garantia: a resposta pode já estar a
   * caminho quando ele chega); isto aqui é economia — sem ele, duas mudanças de
   * filtro seguidas custam duas varreduras completas no backend e só uma é usada.
   */
  let distAbort: AbortController | null = null
```

E no início de `fetchDistribuicoes`, logo após `const reqId = ++distReqId`:

```ts
    distAbort?.abort()
    const controller = new AbortController()
    distAbort = controller
```

Trocar a chamada:

```ts
      const response = await getDistribuicoes(params, { signal: controller.signal })
```

E no `catch`, distinguir cancelamento de falha real:

```ts
    } catch (e) {
      // Cancelamento nosso não é falha: acontece toda vez que o filtro muda
      // antes da resposta chegar. Warn só para falha de verdade.
      if (!controller.signal.aborted) {
        console.warn('[useKpiStore] falha ao buscar distribuicoes; histograma oculto', e)
        if (isCurrent()) distribuicoes.value = new Map()
      }
    } finally {
```

- [ ] **Step 5: Aplicar o mesmo padrão nos outros três stores**

`useGargaloStore.ts`, `useCiclicidadeStore.ts` e `useDimensoesStore.ts` reagem aos mesmos filtros.
Em cada um: ler o arquivo, localizar a função de busca que lê `activeFilters`, e aplicar
**exatamente** os quatro elementos do Step 4 — o `let xAbort: AbortController | null = null` no
escopo do store, o `abort()` + novo controller no início da busca, o `signal` na chamada do service,
e o `if (!controller.signal.aborted)` no catch para não transformar cancelamento em erro visível.

Atenção: `useGargaloStore` e `useCiclicidadeStore` **setam `error`** no catch (diferente do
`useKpiStore`, cuja falha é silenciosa). Nesses dois, o `if (!controller.signal.aborted)` precisa
envolver a atribuição de `error` — senão toda mudança rápida de filtro pinta um ErrorState na tela.
**Esse é o bug mais provável desta task; teste-o.**

- [ ] **Step 6: Rodar**

Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: verde. Se um teste existente de `useGargaloStore`/`useCiclicidadeStore` começar a falhar
por `error` nulo, releia o Step 5 — provavelmente o guarda ficou no lugar errado.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/stores/
git commit -m "perf(front): cancela requisicoes obsoletas ao mudar filtro" -m "O guarda de sequencia descartava a resposta antiga mas a requisicao seguia rodando: duas mudancas de filtro custavam duas varreduras completas. O guarda permanece como protecao de correcao (abort nao e garantia); o abort e economia. Cancelamento nao pode virar ErrorState nos stores que setam error."
```

---

### Task 6: Verificação e deploy

**Files:** nenhum código. Ao final, registrar em "Registro de execução".

- [ ] **Step 1: Suítes completas**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: tudo verde, contagens **maiores** que o baseline.

- [ ] **Step 2: Browser com backend real**

Subir os dois servidores (comandos no plano do KPI-05, seção Task 6) e verificar:

- Trocar filtro **duas vezes rápido** e olhar a aba Network: a primeira chamada de
  `/kpis/distribuicoes` deve aparecer como **cancelada**, não como concluída.
- Nenhum ErrorState aparece durante a troca rápida de filtros (o risco do Step 5 da Task 5).
- Os histogramas continuam aparecendo normalmente.
- Abrir `http://127.0.0.1:8000/docs` e confirmar que os cinco endpoints ainda listam
  `unidade`, `especialidade`, `grupo`, `data_inicio`, `data_fim`.

- [ ] **Step 3: Encerrar servidores, registrar e commitar o registro.**

- [ ] **Step 4: Deploy do backend**

```powershell
cd backend; railway up --no-gitignore
```

Confirmar: `https://pija-backend-production.up.railway.app/docs` mostra os filtros nos cinco endpoints.

---

## Registro de execução

_(preencher durante a execução)_

## Self-review (do plano, já aplicado)

- Spec §2.1 → Task 1 · §2.2 → Task 2 · §2.3 → Task 5 · §2.4 → **sem task, resolvido por deleção na
  frente de simplificação** (documentado no contexto) · §2.5 → Task 3 · §2.6 → Task 4 · §4
  (verificação) → Task 6.
- Ordem: as tasks são independentes entre si; a Task 4 é a que não pode ser cortada, por ser
  pré-requisito da frente de Cirurgia.
- Nomes conferidos contra o código real: `Filtros`, `build_filtros`, `get_db`, `ALL_KPIS`,
  `KpiDistribuicaoSchema`, `DistribuicoesResponseSchema`, `mockDistribuicoes`, `USE_MOCK`,
  `activeFilters`, `distReqId`, `isCurrent`, `loadingDist`.
- Riscos nomeados onde eles moram: descrições de "coorte" perdidas no OpenAPI (Task 1 Step 5),
  imports órfãos (Task 2 Step 3), mock de axios que pode não casar (Task 4 Step 1), e o guarda de
  `error` nos stores que não são silenciosos (Task 5 Step 5).

## Fora de escopo

Qualquer refatoração não listada · mudanças em `.sql` · mudanças na lógica de mediana ou
bucketização · a barra de meta de 4h (frente de simplificação) · KPI-10/10B (frente de cirurgia).
