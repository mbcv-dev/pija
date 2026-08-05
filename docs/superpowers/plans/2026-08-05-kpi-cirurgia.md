# KPIs de Cirurgia (KPI-10 e KPI-10B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Preencher a área Cirurgias do dashboard, hoje vazia, com KPI-10 (tempo de cirurgia) e KPI-10B (espera em sala, submétrica), reusando inteiro o modelo de card + histograma que já existe.

**Architecture:** Dois `.sql` produtores de linhas novos sobre colunas que o ETL **já popula** — nenhuma mudança de carga. Backend: registro em `KPI_META` e os endpoints batch os pegam de graça. Frontend: um segundo par KPI/submétrica obriga a extrair o mapeamento hoje hardcoded para KPI-07/07B.

**Tech Stack:** SQLite + SQLAlchemy async + FastAPI (backend); Vue 3 + TS + Pinia + zod (frontend); pytest / vitest.

**Spec:** [docs/superpowers/specs/2026-08-05-kpi-cirurgia-design.md](../specs/2026-08-05-kpi-cirurgia-design.md) — decisões travadas, NÃO re-perguntar.

---

## Contexto essencial do repo (leia antes da Task 1)

- **Branch:** `feat/endurecimento-e-cirurgia`.
- **PRÉ-REQUISITO OBRIGATÓRIO:** a Task 4 do plano de
  [endurecimento](2026-08-05-endurecimento-backlog.md) (parse por KPI em vez de tudo-ou-nada)
  precisa estar **feita e deployada**. Sem ela, enquanto o backend tiver KPI-10 e o frontend não,
  um `codigo` desconhecido derruba **os seis histogramas de uma vez**. A janela é real: o front sobe
  automático na Vercel, o backend exige `railway up` manual. **Confirme antes de começar.**
- **Testes:** backend `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q` · frontend `cd frontend; npx vitest run` e `npm run type-check`.
- Comentários/docstrings em português explicando o porquê. Commits: imperativa, sem `Co-Authored-By`, **sem acentos na mensagem**.
- **Não commitar `backend/data/`.**
- **Ao final:** `railway up --no-gitignore` a partir de `backend/`.

### O dado que já existe (não re-explorar)

`docs/DADOS-ESTADO.md` §4.6 documenta o mapeamento de `vw_cirurgias` para o fato:

| Coluna do fato | Origem no CSV | Significado |
|---|---|---|
| `timestamp_agendamento` | `Entrada na Sala` | paciente entra na sala |
| `timestamp_principal` | `data_inicio_cirurgia` | cirurgia começa |
| `timestamp_realizacao` | `data_fim_cirurgia` | cirurgia termina |
| `situacao` | `situacao` | `RZDA` \| `CANC` \| `AGND` … |
| `tipo_evento` | `{Tipo}/{Natureza}` | `CIRURGIA/ELETIVA`, `PDT/URGÊNCIA` |

**Nenhuma mudança de ETL é necessária** para os dois KPIs. (A Task 1 pode descobrir o contrário —
veja lá.)

### Fixture de teste: cuidado herdado

`backend/tests/conftest.py` tem **17 eventos** e `tests/test_eventos.py` fixa esse número
(`total == 17`, paginação `8+8+1`). **Não adicione eventos à fixture compartilhada** — a Task 3 usa
fixture local com banco próprio, como o plano do KPI-05 fez.

---

### Task 1: Investigação bloqueante — a duplicação de ~32% em `vw_cirurgias`

**Files:**
- Create: script temporário no scratchpad (NÃO commitar)
- Modify: `docs/DADOS-ESTADO.md`

`DADOS-ESTADO.md` §8 registra, como pendência a resolver **antes de KPIs cirúrgicos**: 40.934 linhas
carregadas → 27.745 distintos. O upsert usa `evento_id = "X-{cirurgia_id}"`, então **a última linha
lida vence**. Se as linhas duplicadas carregam recortes diferentes do mesmo evento, a que sobrevive
pode ter timestamps incompletos — e os dois KPIs dependem exatamente desses três timestamps.

**Esta task é bloqueante. Não escreva `.sql` antes de terminá-la.**

- [ ] **Step 1: Medir**

Criar um script no scratchpad (caminho em `C:\Users\Matheus\AppData\Local\Temp\claude\...\scratchpad`)
e rodar com `cd backend; .\venv\Scripts\python.exe <script>`:

```python
import sqlite3
c = sqlite3.connect("data/pija_demo.db")

print("=== volume e situacao ===")
for s, n in c.execute("""
SELECT COALESCE(situacao,'(nulo)'), COUNT(*) FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND tipo_entidade='CIRURGIA' GROUP BY 1 ORDER BY 2 DESC
"""):
    print(f"  {s:20} {n:>8,}")

print()
print("=== cobertura dos tres timestamps (so RZDA) ===")
r = c.execute("""
SELECT COUNT(*),
       SUM(timestamp_agendamento IS NOT NULL),
       SUM(timestamp_principal   IS NOT NULL),
       SUM(timestamp_realizacao  IS NOT NULL),
       SUM(timestamp_agendamento IS NOT NULL AND timestamp_principal IS NOT NULL
           AND timestamp_realizacao IS NOT NULL)
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND tipo_entidade='CIRURGIA' AND situacao='RZDA'
""").fetchone()
for k, v in zip(["total RZDA","entrada sala","inicio","fim","os tres"], r):
    print(f"  {k:14} {v:>8,}")

print()
print("=== ordem coerente? (entrada <= inicio <= fim) ===")
r = c.execute("""
SELECT COUNT(*),
       SUM(JULIANDAY(timestamp_realizacao) >= JULIANDAY(timestamp_principal)),
       SUM(JULIANDAY(timestamp_principal)  >= JULIANDAY(timestamp_agendamento))
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND tipo_entidade='CIRURGIA' AND situacao='RZDA'
  AND timestamp_agendamento IS NOT NULL AND timestamp_principal IS NOT NULL
  AND timestamp_realizacao IS NOT NULL
""").fetchone()
print(f"  com os tres: {r[0]:,}   fim>=inicio: {r[1]:,}   inicio>=entrada: {r[2]:,}")

print()
print("=== n final estimado de cada KPI ===")
for nome, ini, fim in [("KPI-10  duracao      ", "timestamp_principal", "timestamp_realizacao"),
                       ("KPI-10B espera sala  ", "timestamp_agendamento", "timestamp_principal")]:
    r = c.execute(f"""
    SELECT COUNT(*), ROUND(AVG((JULIANDAY({fim})-JULIANDAY({ini}))*24), 2)
    FROM fato_eventos_jornada
    WHERE deleted_at IS NULL AND tipo_entidade='CIRURGIA' AND situacao='RZDA'
      AND {ini} IS NOT NULL AND {fim} IS NOT NULL
      AND JULIANDAY({fim}) >= JULIANDAY({ini})
      AND unidade NOT LIKE '%INATIVO%'
    """).fetchone()
    print(f"  {nome} n={r[0]:>8,}  media={r[1]} h")

print()
print("=== unidades que aparecem (decide o grupo_scope) ===")
for u, g, n in c.execute("""
SELECT COALESCE(unidade,'(nulo)'), COALESCE(grupo,'(nulo)'), COUNT(*)
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND tipo_entidade='CIRURGIA' AND situacao='RZDA'
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15
"""):
    print(f"  {u[:34]:36} [{g[:22]:24}] {n:>7,}")
```

- [ ] **Step 2: Decidir e registrar em MD ANTES de codar**

Com os números na mão, responder no `docs/DADOS-ESTADO.md` (seção nova, no padrão da §12):

1. Qual a taxa de cirurgias `RZDA` com os três timestamps preenchidos e em ordem coerente? Isso
   dimensiona o `n` real dos dois KPIs.
2. A linha que sobrevive ao upsert tem informação suficiente? Se a taxa do item 1 for alta
   (digamos > 80%), a duplicação **não** está destruindo os timestamps e o upsert atual serve.
3. Qual `KPI_GRUPO_SCOPE` usar? Critério da spec §5: olhar as unidades que aparecem e decidir entre
   (a) sem escopo — o filtro `tipo_entidade = 'CIRURGIA'` já restringe, (b) reusar
   `GRUPO_PROCEDIMENTAL`, (c) constante nova em `unidades.py`. **Registrar a evidência, não só a
   escolha.**

**Ramo de exceção:** se o item 2 concluir que a última-linha-vence está perdendo timestamps (taxa
baixa, ou `entrada > inicio` em massa), então **a correção do ETL entra nesta frente** e este plano
precisa ganhar tarefas antes da Task 2. Nesse caso, **pare e reporte** em vez de improvisar um KPI
sobre dado que você já sabe estar quebrado. O escopo de KPI não muda; o caminho até ele, sim.

- [ ] **Step 3: Commit do achado**

```bash
git add docs/DADOS-ESTADO.md
git commit -m "docs(dados): mede a duplicacao de vw_cirurgias antes dos KPIs cirurgicos" -m "Pendencia registrada desde a exploracao dos CSVs: 40.934 linhas viram 27.745 distintos e o upsert mantem a ultima. Mede a cobertura dos tres timestamps em cirurgias realizadas e decide o grupo_scope com evidencia, nao por palpite."
```

---

### Task 2: Os dois `.sql` e o registro no provider

**Files:**
- Create: `backend/src/pija/sql/kpis/kpi_10.sql`
- Create: `backend/src/pija/sql/kpis/kpi_10b.sql`
- Modify: `backend/src/pija/providers/kpis_provider.py`
- Modify: `backend/tests/test_kpis.py`

- [ ] **Step 1: Escrever o teste que falha**

Em `backend/tests/test_kpis.py`, dentro de `TestKpisProvider`:

```python
    async def test_kpis_de_cirurgia_estao_registrados(self, fixture_db_session):
        """Os dois códigos novos entram na resposta batch, mesmo sem dado na fixture.

        A fixture não tem cirurgias — sem dado o KPI vem com media_global None e
        n_global 0, que é o contrato de "KPI sem dados no recorte". O que este
        teste fixa é o REGISTRO: se alguém esquecer de adicionar ao KPI_META, os
        endpoints batch simplesmente não devolvem o código e ninguém percebe.
        """
        kpis = await _kpis(fixture_db_session)
        assert {"KPI-10", "KPI-10B"} <= set(kpis)
        assert kpis["KPI-10"].n_global == 0
        assert kpis["KPI-10"].media_global is None
```

E atualizar o teste existente que fixa o conjunto de códigos (`test_kpis.py:31`):

```python
        assert set(kpis) == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07", "KPI-07B", "KPI-10", "KPI-10B"}
```

Fazer o mesmo em `backend/tests/test_kpis_distribuicoes.py` nas duas asserções de conjunto
(linhas ~59 e ~295).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis.py -q`
Expected: FAIL — `KPI-10` não existe.

- [ ] **Step 3: `kpi_10.sql`**

Criar `backend/src/pija/sql/kpis/kpi_10.sql`:

```sql
-- KPI-10: duração da cirurgia (início → fim), em HORAS.
-- Só cirurgias realizadas: uma cirurgia cancelada ou apenas agendada não tem duração.
-- `timestamp_principal` = data_inicio_cirurgia e `timestamp_realizacao` = data_fim_cirurgia
-- (ver DADOS-ESTADO §4.6) — o nome das colunas do fato é genérico, o significado é este.
SELECT {group_col} AS dimensao,
       (JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_principal)) * 24 AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CIRURGIA'
  AND situacao = 'RZDA'
  AND timestamp_realizacao IS NOT NULL
  AND timestamp_principal IS NOT NULL
  AND JULIANDAY(timestamp_realizacao) >= JULIANDAY(timestamp_principal)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
```

- [ ] **Step 4: `kpi_10b.sql`**

Criar `backend/src/pija/sql/kpis/kpi_10b.sql`:

```sql
-- KPI-10B: espera em sala (entrada na sala → início da cirurgia), em HORAS.
-- É o tempo com a sala ocupada sem procedimento em curso — onde ineficiência
-- operacional aparece, e acionável de um jeito que a duração da cirurgia não é
-- (a duração depende do procedimento; a espera depende da organização).
-- `timestamp_agendamento` = Entrada na Sala (ver DADOS-ESTADO §4.6): o nome da
-- coluna do fato diz "agendamento", mas para CIRURGIA o ETL grava a entrada na sala.
SELECT {group_col} AS dimensao,
       (JULIANDAY(timestamp_principal) - JULIANDAY(timestamp_agendamento)) * 24 AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CIRURGIA'
  AND situacao = 'RZDA'
  AND timestamp_principal IS NOT NULL
  AND timestamp_agendamento IS NOT NULL
  AND JULIANDAY(timestamp_principal) >= JULIANDAY(timestamp_agendamento)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
```

- [ ] **Step 5: Registrar no provider**

Em `backend/src/pija/providers/kpis_provider.py`:

Em `KPI_META`, adicionar ao final do dicionário:

```python
    "KPI-10": ("kpis/kpi_10.sql", "Duração da cirurgia"),
    "KPI-10B": ("kpis/kpi_10b.sql", "Entrada na sala → início da cirurgia"),
```

Em `KPI_UNIDADE_TEMPO`, os dois são em horas:

```python
KPI_UNIDADE_TEMPO: dict[str, str] = {"KPI-07B": "horas", "KPI-10": "horas", "KPI-10B": "horas"}
```

Em `KPI_GRUPO_SCOPE`: **aplicar a decisão da Task 1 Step 2.** Se a decisão foi "sem escopo", não
adicionar entrada nenhuma (o `.get` no provider já trata ausência). Se foi reusar
`GRUPO_PROCEDIMENTAL`, adicionar as duas linhas importando a constante de `pija.unidades`.

`ALL_KPIS` deriva de `KPI_META` — nada a fazer.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: tudo PASS. Atenção a `tests/test_kpis_scope.py` — se a decisão foi adicionar escopo,
pode ser preciso estender aquele teste.

- [ ] **Step 7: Commit**

```bash
git add backend/src/pija/sql/kpis/kpi_10.sql backend/src/pija/sql/kpis/kpi_10b.sql backend/src/pija/providers/kpis_provider.py backend/tests/
git commit -m "feat(kpis): KPI-10 duracao da cirurgia e KPI-10B espera em sala" -m "Os dois saem de colunas que o ETL ja popula (DADOS-ESTADO 4.6): nenhuma mudanca de carga. So cirurgias realizadas (RZDA) -- cancelada ou agendada nao tem duracao. Entram nos endpoints batch de graca, com histograma junto."
```

---

### Task 3: Comportamento dos dois KPIs com dado de verdade

**Files:**
- Modify: `backend/tests/test_kpis.py`

A fixture compartilhada não tem cirurgias e não pode crescer (`test_eventos.py` fixa 17 eventos).
Fixture local com banco próprio, como no plano do KPI-05.

- [ ] **Step 1: Escrever os testes**

Em `backend/tests/test_kpis.py`, no nível do módulo:

```python
@pytest.fixture
async def session_cirurgias(async_engine):
    """Banco próprio com 4 cirurgias cobrindo os casos que decidem os dois KPIs."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from pija.models.fato import FatoEvento

    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    eventos = [
        # Realizada e completa: entra nos dois. Espera 1h, duração 2h.
        FatoEvento(evento_id="X-1", paciente_id="700", tipo_entidade="CIRURGIA", entidade_id="X1",
                   timestamp_agendamento="2024-06-01 08:00", timestamp_principal="2024-06-01 09:00",
                   timestamp_realizacao="2024-06-01 11:00",
                   unidade="CENTRO CIRURGICO", grupo="Procedimental", especialidade="ORTOPEDIA",
                   situacao="RZDA", tipo_evento="CIRURGIA/ELETIVA", dt_carga="2024-01-01"),
        # Realizada e completa: espera 3h, duração 4h.
        FatoEvento(evento_id="X-2", paciente_id="701", tipo_entidade="CIRURGIA", entidade_id="X2",
                   timestamp_agendamento="2024-06-02 08:00", timestamp_principal="2024-06-02 11:00",
                   timestamp_realizacao="2024-06-02 15:00",
                   unidade="CENTRO CIRURGICO", grupo="Procedimental", especialidade="ORTOPEDIA",
                   situacao="RZDA", tipo_evento="CIRURGIA/ELETIVA", dt_carga="2024-01-01"),
        # CANCELADA com timestamps preenchidos: NÃO pode entrar em nenhum dos dois.
        FatoEvento(evento_id="X-3", paciente_id="702", tipo_entidade="CIRURGIA", entidade_id="X3",
                   timestamp_agendamento="2024-06-03 08:00", timestamp_principal="2024-06-03 09:00",
                   timestamp_realizacao="2024-06-03 20:00",
                   unidade="CENTRO CIRURGICO", grupo="Procedimental", especialidade="ORTOPEDIA",
                   situacao="CANC", tipo_evento="CIRURGIA/ELETIVA", dt_carga="2024-01-01"),
        # Realizada mas SEM entrada na sala: entra no KPI-10, fica fora do KPI-10B.
        FatoEvento(evento_id="X-4", paciente_id="703", tipo_entidade="CIRURGIA", entidade_id="X4",
                   timestamp_agendamento=None, timestamp_principal="2024-06-04 09:00",
                   timestamp_realizacao="2024-06-04 12:00",
                   unidade="CENTRO CIRURGICO", grupo="Procedimental", especialidade="ORTOPEDIA",
                   situacao="RZDA", tipo_evento="CIRURGIA/ELETIVA", dt_carga="2024-01-01"),
    ]
    async with factory() as session:
        session.add_all(eventos)
        await session.commit()
    async with factory() as session:
        yield session
```

E, dentro de `TestKpisProvider`:

```python
    async def test_kpi_10_duracao_so_de_cirurgia_realizada(self, session_cirurgias):
        """Durações 2h, 4h e 3h (X-1, X-2, X-4). A cancelada fica fora."""
        k = (await _kpis(session_cirurgias))["KPI-10"]
        assert k.n_global == 3
        assert k.media_global == pytest.approx(3.0, abs=1e-6)  # mediana de 2, 3, 4

    async def test_kpi_10b_espera_ignora_sem_entrada_na_sala(self, session_cirurgias):
        """Só X-1 (1h) e X-2 (3h): X-3 é cancelada, X-4 não tem entrada na sala."""
        k = (await _kpis(session_cirurgias))["KPI-10B"]
        assert k.n_global == 2
        assert k.media_global == pytest.approx(2.0, abs=1e-6)  # mediana de 1 e 3

    async def test_kpis_de_cirurgia_sao_em_horas(self, session_cirurgias):
        kpis = await _kpis(session_cirurgias)
        assert kpis["KPI-10"].unidade_tempo == "horas"
        assert kpis["KPI-10B"].unidade_tempo == "horas"
```

> Se a decisão da Task 1 tiver sido usar `grupo_scope`, os eventos acima precisam ter o `grupo`
> correspondente — o `grupo="Procedimental"` já está preenchido para isso. Se a decisão foi outra
> constante, ajustar o valor.

- [ ] **Step 2: Rodar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis.py -q`
Expected: PASS. Se `test_kpi_10b` der `n_global == 3`, o `.sql` do 10B não está exigindo
`timestamp_agendamento IS NOT NULL` — corrija o SQL, não o teste.

- [ ] **Step 3: Suíte completa + commit**

```bash
git add backend/tests/test_kpis.py
git commit -m "test(kpis): comportamento dos KPIs de cirurgia com dado real" -m "Fixture local com banco proprio (a compartilhada tem 17 eventos fixados pelo test_eventos). Cobre os tres motivos de exclusao: cancelada, sem entrada na sala, e ordem invertida."
```

---

### Task 4: Frontend — tipos, metadados e a extração do par KPI/submétrica

**Files:**
- Modify: `frontend/src/types/api.types.ts`
- Modify: `frontend/src/schemas/api.schemas.ts`
- Modify: `frontend/src/lib/areas.ts`
- Modify: `frontend/src/lib/areas.test.ts`
- Modify: `frontend/src/components/kpis/KpiGrid.vue`
- Modify: `frontend/src/mocks/kpis.mock.ts`
- Modify: `frontend/src/mocks/distribuicoes.mock.ts`
- Modify: `frontend/src/views/MetodologiaView.vue`

- [ ] **Step 1: Escrever os testes que falham**

Em `frontend/src/lib/areas.test.ts`, o teste que hoje afirma `cirurgias.kpis === []` **muda de
asserção** — é remoção de comportamento obsoleto:

```ts
  it('cirurgias tem o KPI de duracao (a submetrica 10B mora dentro do card)', () => {
    const cirurgias = AREAS_JORNADA.find((a) => a.id === 'cirurgias')!
    expect(cirurgias.kpis).toEqual(['KPI-10'])
  })
```

E, no teste que afirma "cada KPI em exatamente uma área", garantir que ele continue passando com os
códigos novos — `KPI-10B` **não** deve aparecer em `kpis` de nenhuma área (é submétrica), igual ao
`KPI-07B`. Se o teste itera sobre uma lista de códigos, atualize a lista.

Em `frontend/src/components/kpis/KpiGrid.test.ts`, adicionar ao mock de `getKpis`/`getDistribuicoes`
entradas para `KPI-10` e `KPI-10B` e o teste:

```ts
  it('a submetrica do KPI-10 renderiza no card do KPI-10', async () => {
    const w = await montar()
    const cirurgias = w.findAll('[data-area]').find((s) => s.attributes('data-area') === 'cirurgias')!
    const bloco = cirurgias.find('[data-submetrica]')
    expect(bloco.exists()).toBe(true)
    expect(bloco.text()).toContain('sala')
  })
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Tipos e schema**

Em `frontend/src/types/api.types.ts`:

```ts
export type KpiCode = 'KPI-01' | 'KPI-03' | 'KPI-05' | 'KPI-06' | 'KPI-07' | 'KPI-07B' | 'KPI-10' | 'KPI-10B'
```

Em `frontend/src/schemas/api.schemas.ts` (é uma **segunda lista** que precisa andar junto):

```ts
const KpiCodeSchema = z.enum(['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B', 'KPI-10', 'KPI-10B'])
```

Em `KPI_META` (`api.types.ts`), adicionar as duas entradas:

```ts
  'KPI-10': {
    label: 'Duração da cirurgia', icon: 'cirurgia',
    ancora: 'Do início ao fim da cirurgia, para cirurgias realizadas.',
    unidadeTempo: 'horas',
    regras:
      'Eventos do tipo CIRURGIA com situação RZDA (realizada) e início e fim preenchidos. ' +
      'Cirurgias canceladas ou apenas agendadas não entram. Exclui fim anterior ao início e ' +
      'unidades inativas. Duração longa costuma ser característica do procedimento, não ' +
      'ineficiência — compare dentro da mesma especialidade.',
  },
  'KPI-10B': {
    label: 'Entrada na sala → início da cirurgia', icon: 'cirurgia',
    ancora: 'Do momento em que o paciente entra na sala até a cirurgia começar.',
    unidadeTempo: 'horas',
    regras:
      'Mesmo recorte do KPI-10, exigindo também a entrada na sala preenchida. É o tempo com a ' +
      'sala ocupada sem procedimento em curso — depende da organização, não do procedimento.',
  },
```

> O `icon: 'cirurgia'` precisa existir em `Icon.vue` — a área Cirurgias já usa esse nome em
> `areas.ts`, então existe. Confirmar.

- [ ] **Step 4: `areas.ts`**

```ts
  {
    id: 'cirurgias', label: 'Cirurgias', icon: 'cirurgia',
    descricao: 'Do preparo da sala à conclusão do procedimento',
    kpis: ['KPI-10'],
  },
```

**Não** definir `gargalosKpi` — a decisão de o KPI-10 entrar no ranking está deliberadamente em
aberto na spec §8. Deixar fora é a escolha conservadora: duração longa é característica do
procedimento, exatamente o caso que a frente de simplificação diz para não ranquear como problema.

- [ ] **Step 5: Extrair o par KPI/submétrica no `KpiGrid.vue`**

Hoje a relação KPI-07 → KPI-07B está hardcoded em **três pontos** (linhas 19, 88 e 90). Com um
segundo par, isso vira mapa. No `<script setup>`:

```ts
/**
 * Qual KPI é submétrica de qual. Renderiza dentro do card do "pai", não como
 * card próprio — por isso nenhum destes aparece em `AREAS_JORNADA[].kpis`.
 * Virou mapa quando o segundo par (cirurgia) chegou; com um só, três literais
 * espalhados ainda cabiam na cabeça.
 */
const SUBMETRICA_DE: Partial<Record<KpiCode, KpiCode>> = {
  'KPI-07': 'KPI-07B',
  'KPI-10': 'KPI-10B',
}

const submetricaDe = (codigo: KpiCode) => {
  const sub = SUBMETRICA_DE[codigo]
  return sub ? porCodigo.value.get(sub) : undefined
}
const subDistDe = (codigo: KpiCode) => {
  const sub = SUBMETRICA_DE[codigo]
  return sub ? distDe(sub) : undefined
}
```

Apagar `const submetric = computed(() => porCodigo.value.get('KPI-07B'))` (linha 19) e, no template,
trocar as duas linhas hardcoded:

```html
            :submetric="submetricaDe(kpi.codigo)"
            :dist="distDe(kpi.codigo)"
            :sub-dist="subDistDe(kpi.codigo)"
```

- [ ] **Step 6: Mocks**

Em `frontend/src/mocks/kpis.mock.ts` e `frontend/src/mocks/distribuicoes.mock.ts`, adicionar
entradas para `KPI-10` e `KPI-10B` com valores plausíveis em horas (duração de cirurgia na casa de
1–4h; espera em sala abaixo disso). **Manter as invariantes que
`distribuicoes.mock.test.ts` verifica** — `sum(n) === n_total`, `teto === buckets[último].de`,
exatamente uma cauda aberta e por último. O teste do mock vai acusar se quebrar.

- [ ] **Step 7: Metodologia lista os KPIs novos**

`frontend/src/views/MetodologiaView.vue` renderiza a partir de `KPI_META`, mas **itera sobre um
array `ordem` hardcoded** (linha ~8) — sem atualizá-lo, os dois KPIs novos não aparecem na página,
mesmo com os metadados prontos. É uma lista de códigos a mais que precisa andar junto com as outras
duas (`KpiCode` e `KpiCodeSchema`):

```ts
const ordem: KpiCode[] = ['KPI-01', 'KPI-03', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-07B', 'KPI-10', 'KPI-10B']
```

- [ ] **Step 8: Rodar**

Run: `cd frontend; npx vitest run` e `npm run type-check`
Expected: verde.

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "feat(front): area Cirurgias ganha os KPIs 10 e 10B" -m "A relacao KPI pai -> submetrica estava hardcoded em tres pontos do KpiGrid para o par 07/07B; com o segundo par virou mapa. A area Cirurgias deixa de mostrar estado vazio. Sem gargalosKpi de proposito: duracao longa costuma ser caracteristica do procedimento, nao gargalo."
```

---

### Task 5: Documentos canônicos

**Files:**
- Modify: `02-requisitos.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `02-requisitos.md`**

A tabela de KPIs cataloga 01 a 09. Adicionar duas linhas no mesmo formato das existentes
(código | nome | fórmula | entidade | status), com status ✅ implementado:

- `KPI-10` | Tempo de duração da cirurgia | `MEDIAN(dt_fim - dt_inicio)` | Cirurgias
- `KPI-10B` | Espera em sala (entrada → início) | `MEDIAN(dt_inicio - dt_entrada_sala)` | Cirurgias

Ajustar a notação à que a tabela já usa.

- [ ] **Step 2: `CLAUDE.md`**

A seção "KPIs do MVP" diz "5 KPIs de tempo médio" e lista cinco. Atualizar o número e acrescentar os
dois novos à enumeração.

- [ ] **Step 3: Commit**

```bash
git add 02-requisitos.md CLAUDE.md
git commit -m "docs(kpis): registra KPI-10 e KPI-10B nos documentos canonicos" -m "Sem isso o repo fica com indicador em producao que o contrato nao menciona."
```

---

### Task 6: Verificação no browser e deploy

**Files:** nenhum código. Registrar em "Registro de execução".

- [ ] **Step 1:** Subir backend e frontend (comandos na Task 6 do plano do KPI-05).

- [ ] **Step 2: Checklist, nos DOIS temas e a 390px**

- A área **Cirurgias deixa de mostrar o estado vazio** e passa a ter o card do KPI-10.
- O card traz histograma, e o bloco da submétrica traz o KPI-10B com histograma próprio.
- Os valores batem com o que a Task 1 mediu. **Se `n` divergir muito do previsto, a investigação
  estava errada — é ela que precisa ser corrigida, não o teste.**
- Conferir na API direto: `http://127.0.0.1:8000/api/v1/kpis/tempos-medios?group_by=unidade` traz
  os oito códigos.
- Card do KPI-07 continua íntegro (a extração do mapa não pode ter quebrado o par antigo).
- Sem rolagem horizontal a 390px.

- [ ] **Step 3:** Encerrar servidores, registrar e commitar o registro.

- [ ] **Step 4: Deploy**

```powershell
cd backend; railway up --no-gitignore
```

**Confirme que a Task 4 do plano de endurecimento já está em produção antes deste deploy** — é ela
que impede o frontend de apagar todos os histogramas ao ver códigos que ainda não conhece.

Depois: `https://pija-backend-production.up.railway.app/api/v1/kpis/distribuicoes` deve trazer oito
entradas, e `https://pija-alpha.vercel.app/dashboard` deve mostrar a área Cirurgias preenchida.

---

## Registro de execução

_(preencher durante a execução)_

## Self-review (do plano, já aplicado)

- Spec §1 (Fase A) → todas as tasks · §2 (dado existente) → contexto · §3 (investigação bloqueante)
  → Task 1 · §4 (definições) → Task 2 · §5 (backend) → Task 2 · §6 (frontend) → Task 4 · §6.1
  (documentos) → Task 5 · §7 (ordem) → contexto + Task 6 Step 4 · §8 (decisões em aberto) → Task 1
  Step 2 (escopo) e Task 4 Step 4 (gargalosKpi) · §9 (verificação) → Task 6.
- **A Task 1 pode invalidar o resto do plano** — está dito explicitamente lá, com instrução de parar
  e reportar em vez de improvisar KPI sobre dado sabidamente quebrado.
- **Três** listas de códigos precisam andar juntas: `KpiCode` (`api.types.ts`), `KpiCodeSchema`
  (`api.schemas.ts`) e o array `ordem` do `MetodologiaView.vue`. As duas primeiras estão no Step 3
  da Task 4; a terceira ganhou step próprio (Step 7) porque falha em silêncio — os metadados ficam
  prontos e a página simplesmente não lista o KPI, sem erro nenhum.
- Nomes conferidos contra o código real: `KPI_META`, `KPI_UNIDADE_TEMPO`, `KPI_GRUPO_SCOPE`,
  `ALL_KPIS`, `AREAS_JORNADA`, `porCodigo`, `distDe`, `submetric`, `data-submetrica`, `data-area`,
  `FatoEvento`, `async_engine`, `_kpis`.

## Fora de escopo

Fase B (KPI-02, 04, 08, 09) · taxa de cancelamento cirúrgico · agendamento → realização de cirurgia
(exige mapeamento de ETL novo) · mudanças nos `.sql` existentes · mudanças no `HistogramaTempos.vue`.
