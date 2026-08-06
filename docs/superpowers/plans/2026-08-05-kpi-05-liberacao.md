# KPI-05 solicitação → liberação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O KPI-05 deixa de medir solicitação → realização (61,2% das linhas invertidas, mediana zero, card exibindo "< 1 min") e passa a medir solicitação → liberação do resultado (zero linhas descartadas, mediana 9,23 h).

**Architecture:** Troca de coluna dentro de um único `.sql` produtor de linhas — a arquitetura não muda. O trabalho real está em (a) atualizar a fixture de teste, que hoje não tem `timestamp_liberacao` em exame nenhum, sem quebrar os testes que dependem do tamanho dela, e (b) registrar a ressalva de viés de sobrevivência nos textos que o usuário lê.

**Tech Stack:** SQLite + SQLAlchemy async + FastAPI (backend); Vue 3 + TS (frontend); pytest / vitest.

**Spec:** [docs/superpowers/specs/2026-08-05-kpi-05-liberacao-design.md](../specs/2026-08-05-kpi-05-liberacao-design.md) — decisões travadas, NÃO re-perguntar.

---

## Contexto essencial do repo (leia antes da Task 1)

- **Branch:** trabalhar em `feat/endurecimento-e-cirurgia` (já criada, contém as specs). Não voltar para `main`.
- **Testes backend:** `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q` → **186 hoje**. Não regredir.
- **Testes frontend:** `cd frontend; npx vitest run` → **189 hoje** · `npm run type-check` limpo.
- **Comentários/JSDoc em português explicando o porquê.** Commits: imperativa, corpo explica o porquê, sem `Co-Authored-By`, **sem acentos na mensagem**.
- **Não commitar `backend/data/`** (dado de paciente, repo público).
- **Ao final da frente:** deploy manual do backend — `railway up --no-gitignore` a partir de `backend/`. O auto-deploy do GitHub NÃO alcança o backend (a imagem embute o banco, que não está no Git). Sem isso, o frontend novo fica falando com o backend velho.

### O fato que torna esta frente delicada

`backend/tests/conftest.py` tem exatamente **17 eventos**, e `tests/test_eventos.py` fixa esse número:

```python
assert result.total == 17
assert len(p1.items) == 8
assert len(p2.items) == 8  # 17 itens → 8 + 8 + 1
```

**Portanto: NÃO adicione nem remova eventos da fixture compartilhada.** A Task 1 apenas *preenche
um campo a mais* em dois eventos existentes. O caso "exame sem liberação não entra" é testado com
uma fixture local isolada (Task 3), não mexendo na compartilhada.

Os dois exames da fixture:

```python
FatoEvento(evento_id="E-001", paciente_id="008", tipo_entidade="EXAME", entidade_id="E001",
           timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01", timestamp_realizacao="2024-03-05",
           unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
FatoEvento(evento_id="E-002", paciente_id="009", tipo_entidade="EXAME", entidade_id="E002",
           timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01", timestamp_realizacao="2024-03-08",
           unidade="UDI: ULTRASSONOGRAFIA", grupo="Diagnóstico por Imagem", especialidade="ORTOPEDIA", dt_carga="2024-01-01"),
```

E-001 = 4 dias, E-002 = 7 dias. Testes que dependem desses números **em três arquivos**:

| Arquivo | Asserção |
|---|---|
| `tests/test_kpis.py:60-63` | `media_global == 5.5` (mediana de 4 e 7), `n_global == 2` |
| `tests/test_gargalos.py:35,38` | `("KPI-05", "UDI: ULTRASSONOGRAFIA", 7.0)` e `("KPI-05", "UAC: BIOQUÍMICA", 4.0)` |
| `tests/test_kpis_distribuicoes.py:126-131, 310-316` | `n_total == 2`; recorte por `UAC: BIOQUÍMICA` → 1 |

**A estratégia que mantém os três passando sem editá-los:** dar a cada exame um
`timestamp_liberacao` **igual ao seu `timestamp_realizacao` atual**. Os deltas continuam 4 e 7 dias,
então todas as asserções acima seguem verdadeiras.

> **Correção (2026-08-05, apontada na review da Task 2):** essa estratégia faz desses testes uma
> **rede de regressão** — provam que nada mais quebrou —, e **não** uma verificação da troca em si.
> Com `liberacao == realizacao` na fixture, eles passariam com qualquer uma das duas colunas. Numa
> fixture de 2 exames, ambos liberados, nenhuma asserção de comportamento consegue distinguir as
> colunas; por isso a Task 2 se apoia numa asserção sobre o texto do SQL e **a prova de
> comportamento é a Task 3**, com fixture isolada. Se a Task 3 for cortada, a escolha da coluna
> fica com cobertura só textual.

---

### Task 1: Fixture ganha `timestamp_liberacao` (sem mudar contagens)

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Adicionar o campo aos dois exames**

Em `backend/tests/conftest.py`, no bloco `# EXAMES — grupos executores (KPI-05)`, substituir os dois
eventos por estes (a única diferença é `timestamp_liberacao`, com o mesmo valor de
`timestamp_realizacao`, e o comentário explicando o porquê):

```python
        # EXAMES — grupos executores (KPI-05); pacientes 008/009 SEM prontuário (não afetam KPI-01)
        # `timestamp_liberacao` repete o valor de `timestamp_realizacao` de propósito: o KPI-05
        # passou a medir solicitação → LIBERAÇÃO (ver spec 2026-08-05-kpi-05-liberacao-design),
        # e manter os mesmos deltas (4 e 7 dias) deixa os testes de KPI/gargalos/distribuição que
        # já existiam servirem de rede para a troca de coluna.
        FatoEvento(evento_id="E-001", paciente_id="008", tipo_entidade="EXAME", entidade_id="E001",
                   timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01",
                   timestamp_realizacao="2024-03-05", timestamp_liberacao="2024-03-05",
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA", dt_carga="2024-01-01"),
        FatoEvento(evento_id="E-002", paciente_id="009", tipo_entidade="EXAME", entidade_id="E002",
                   timestamp_principal="2024-03-01", timestamp_solicitacao="2024-03-01",
                   timestamp_realizacao="2024-03-08", timestamp_liberacao="2024-03-08",
                   unidade="UDI: ULTRASSONOGRAFIA", grupo="Diagnóstico por Imagem", especialidade="ORTOPEDIA", dt_carga="2024-01-01"),
```

- [ ] **Step 2: Rodar a suíte — ainda tudo verde**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: **186 passed**. O campo novo ainda não é lido por nenhum `.sql`; este passo só confirma
que preencher a coluna não quebrou nada.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test(fixture): preenche timestamp_liberacao nos exames" -m "Prepara a troca do KPI-05 para solicitacao -> liberacao. Os valores repetem os de realizacao para os deltas (4 e 7 dias) nao mudarem -- assim os testes de KPI, gargalos e distribuicao que ja existem viram a rede de seguranca da troca de coluna, em vez de precisarem ser reescritos."
```

---

### Task 2: O `.sql` do KPI-05 passa a usar liberação

**Files:**
- Modify: `backend/src/pija/sql/kpis/kpi_05.sql`
- Modify: `backend/src/pija/providers/kpis_provider.py`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `backend/tests/test_kpis.py`, dentro da classe `TestKpisProvider`:

```python
    async def test_kpi_05_usa_liberacao_e_nao_realizacao(self, fixture_db_session):
        """O KPI-05 mede solicitação → LIBERAÇÃO.

        Em `vw_exames`, `data_hora_realizacao` é anterior à solicitação em 61,2% das linhas
        (ver DADOS-ESTADO §12) — a medida antiga descartava 600 mil eventos em silêncio e
        devolvia mediana zero. Este teste fixa a coluna certa lendo o SQL: garante que a
        troca não seja desfeita por engano numa refatoração futura.
        """
        from pija.db import load_sql

        sql = load_sql("kpis/kpi_05.sql")
        assert "timestamp_liberacao" in sql
        assert "timestamp_realizacao" not in sql
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis.py::TestKpisProvider::test_kpi_05_usa_liberacao_e_nao_realizacao -q`
Expected: FAIL — `assert 'timestamp_liberacao' in sql`.

- [ ] **Step 3: Trocar a coluna no `.sql`**

Substituir o conteúdo de `backend/src/pija/sql/kpis/kpi_05.sql` por:

```sql
-- KPI-05: solicitação → liberação do resultado do exame.
-- Mede LIBERAÇÃO, não realização: em vw_exames, `data_hora_realizacao` é anterior à
-- solicitação em 61,2% das linhas (DADOS-ESTADO §12), o que fazia a guarda de ordem
-- descartar ~600 mil eventos em silêncio e a mediana do resto dar zero.
-- `timestamp_liberacao` é preenchido em correspondência 1:1 com situacao='LIBERADO',
-- então a guarda de nulo abaixo já restringe aos exames com resultado liberado —
-- não é preciso (nem desejável) filtrar por `situacao` também.
SELECT {group_col} AS dimensao,
       JULIANDAY(timestamp_liberacao) - JULIANDAY(timestamp_solicitacao) AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'EXAME'
  AND timestamp_liberacao IS NOT NULL
  AND timestamp_solicitacao IS NOT NULL
  AND JULIANDAY(timestamp_liberacao) >= JULIANDAY(timestamp_solicitacao)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
```

- [ ] **Step 4: Atualizar a descrição no provider**

Em `backend/src/pija/providers/kpis_provider.py`, no dicionário `KPI_META`, trocar a linha do KPI-05:

```python
    "KPI-05": ("kpis/kpi_05.sql", "Solicitação → liberação (exame)"),
```

- [ ] **Step 5: Rodar a suíte inteira**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: **187 passed** (186 + o teste novo). Nenhuma falha — os testes de `test_kpis.py`,
`test_gargalos.py` e `test_kpis_distribuicoes.py` continuam verdes porque a Task 1 preservou os
deltas. **Se algum deles falhar, pare e investigue**: significa que a fixture não foi preenchida
como a Task 1 especifica.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pija/sql/kpis/kpi_05.sql backend/src/pija/providers/kpis_provider.py backend/tests/test_kpis.py
git commit -m "feat(kpis): KPI-05 mede solicitacao ate liberacao do exame" -m "O HC perguntou se nao faria mais sentido medir ate a liberacao. Medido no banco: data_hora_realizacao e anterior a solicitacao em 61,2% das linhas, entao a guarda de ordem descartava 599.647 eventos em silencio e a mediana do que sobrava era zero -- o dashboard exibia '< 1 min' para tempo de exame. Liberacao nao descarta nenhuma linha, tem n maior (440.855) e mediana de 9,23h, e o campo corresponde 1:1 com situacao=LIBERADO."
```

---

### Task 3: Exame sem liberação não entra no KPI

**Files:**
- Modify: `backend/tests/test_kpis.py`

Este é o caso que a fixture compartilhada não pode cobrir (ela tem 17 eventos fixados por
`test_eventos.py`). Usa uma fixture local com banco próprio.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `backend/tests/test_kpis.py`, **fora** da classe `TestKpisProvider` (no nível
do módulo, junto dos outros helpers):

```python
@pytest.fixture
async def session_exames_liberacao(async_engine):
    """Banco próprio com 3 exames: liberado, não liberado e liberado antes da solicitação.

    Não usa `fixture_db_session` de propósito: aquela fixture tem 17 eventos e
    `test_eventos.py` fixa esse número (total == 17, paginação 8+8+1), então adicionar
    casos lá quebraria testes de outra área.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from pija.models.fato import FatoEvento

    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    eventos = [
        # Liberado: 2 dias. É o único que deve entrar.
        FatoEvento(evento_id="X-1", paciente_id="900", tipo_entidade="EXAME", entidade_id="X1",
                   timestamp_principal="2024-05-01", timestamp_solicitacao="2024-05-01",
                   timestamp_realizacao="2024-05-01", timestamp_liberacao="2024-05-03",
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA",
                   situacao="LIBERADO", dt_carga="2024-01-01"),
        # Ainda a coletar: tem realização preenchida, mas NÃO tem liberação → fora.
        FatoEvento(evento_id="X-2", paciente_id="901", tipo_entidade="EXAME", entidade_id="X2",
                   timestamp_principal="2024-05-01", timestamp_solicitacao="2024-05-01",
                   timestamp_realizacao="2024-05-09", timestamp_liberacao=None,
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA",
                   situacao="A COLETAR", dt_carga="2024-01-01"),
        # Liberação ANTES da solicitação (inconsistência) → fora, pela guarda de ordem.
        FatoEvento(evento_id="X-3", paciente_id="902", tipo_entidade="EXAME", entidade_id="X3",
                   timestamp_principal="2024-05-10", timestamp_solicitacao="2024-05-10",
                   timestamp_realizacao="2024-05-10", timestamp_liberacao="2024-05-01",
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA",
                   situacao="LIBERADO", dt_carga="2024-01-01"),
    ]
    async with factory() as session:
        session.add_all(eventos)
        await session.commit()
    async with factory() as session:
        yield session
```

E, dentro da classe `TestKpisProvider`, o teste:

```python
    async def test_kpi_05_so_conta_exame_com_resultado_liberado(self, session_exames_liberacao):
        """Só entra exame liberado — os outros dois são excluídos por motivos diferentes.

        Cobre a ressalva registrada na spec §3: 45% dos exames do HC nunca foram liberados
        e ficam de fora. É o denominador correto (só se mede duração do que terminou), mas
        significa que o KPI é cego para a fila parada.
        """
        k = (await _kpis(session_exames_liberacao))["KPI-05"]
        assert k.n_global == 1
        assert k.media_global == pytest.approx(2.0, abs=1e-9)
```

- [ ] **Step 2: Rodar e ver passar**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest tests/test_kpis.py -q`
Expected: PASS. (Este teste passa de primeira porque a Task 2 já implementou o comportamento — é
teste de caracterização de um caso que a fixture compartilhada não alcança, não TDD de código novo.
Para provar que ele tem força, reverta temporariamente `timestamp_liberacao` → `timestamp_realizacao`
no `.sql` e confirme que ele falha; depois desfaça a reversão.)

- [ ] **Step 3: Suíte completa + commit**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: **188 passed**.

```bash
git add backend/tests/test_kpis.py
git commit -m "test(kpis): exame sem liberacao fica fora do KPI-05" -m "Fixture local com banco proprio: a compartilhada tem 17 eventos e o test_eventos fixa esse numero, entao casos novos nao cabem la. Cobre os dois motivos de exclusao: sem liberacao (situacao != LIBERADO) e liberacao anterior a solicitacao."
```

---

### Task 4: Textos do frontend — rótulo e a ressalva do viés

**Files:**
- Modify: `frontend/src/types/api.types.ts`
- Modify: `frontend/src/mocks/kpis.mock.ts`

- [ ] **Step 1: Atualizar `KPI_META['KPI-05']`**

Em `frontend/src/types/api.types.ts`, substituir a entrada do KPI-05 (hoje nas linhas ~177-183) por:

```ts
  'KPI-05': {
    label: 'Solicitação → liberação do exame', icon: 'flask',
    aviso: 'Dados de exames limitados a jan–mai/2026',
    ancora: 'Da solicitação do exame até a liberação do resultado.',
    unidadeTempo: 'dias',
    regras:
      'Eventos do tipo EXAME com solicitação e liberação preenchidas — ou seja, apenas exames ' +
      'cujo resultado já foi liberado. Exclui liberação anterior à solicitação e unidades inativas. ' +
      'Atenção: exames ainda não liberados (a coletar, a executar, cancelados) NÃO entram na conta. ' +
      'O indicador responde "dos exames liberados, quanto tempo levou" e não enxerga a fila parada: ' +
      'um exame aguardando coleta há dois anos contribui com zero para este número.',
  },
```

> A frase sobre a fila parada é a ressalva do §3 da spec. Não encurtar — é o que impede o indicador
> de ser lido como "o exame do HC fica pronto em 9 horas".

- [ ] **Step 2: Atualizar o rótulo no mock**

Em `frontend/src/mocks/kpis.mock.ts`, localizar a `descricao` do KPI-05 (o texto que hoje fala em
"realização") e trocar por `'Solicitação → liberação (exame)'` — o mesmo texto que o backend agora
devolve em `KPI_META`. Se o mock derivar a descrição de outra fonte, ajustar lá.

- [ ] **Step 3: Verificar**

Run: `cd frontend; npm run type-check`
Expected: limpo, sem saída.

Run: `cd frontend; npx vitest run`
Expected: **189 passed**. Se algum teste fixar o texto antigo do rótulo, atualizá-lo — é mudança de
comportamento intencional.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/api.types.ts frontend/src/mocks/kpis.mock.ts
git commit -m "feat(front): rotulo e regras do KPI-05 falam de liberacao" -m "As regras do card passam a registrar a ressalva de vies de sobrevivencia: 45% dos exames nunca foram liberados e ficam fora da conta, entao o indicador nao enxerga a fila parada."
```

---

### Task 5: Documentos canônicos

**Files:**
- Modify: `backend/src/pija/routers/kpis_router.py`
- Modify: `02-requisitos.md`
- Modify: `CLAUDE.md`
- Modify: `SPEC.md`

- [ ] **Step 0: O texto do OpenAPI (achado na review da Task 2)**

`backend/src/pija/routers/kpis_router.py:19` descreve o KPI-05 na documentação servida em `/docs`:

```
"| KPI-05 | Dias entre solicitação e realização do exame *(pendente confirmação HC)* |\n"
```

Trocar para liberação **e remover o "(pendente confirmação HC)"** — foi exatamente esta entrega que
resolveu a pendência. É backend: sem isso o Swagger em produção descreve a semântica antiga.

> **A Metodologia não precisa de mudança.** `frontend/src/views/MetodologiaView.vue` renderiza a
> partir de `KPI_META` (`kpi.ancora` e `kpi.regras`), então a Task 4 já atualizou a página inteira —
> incluindo a ressalva do viés de sobrevivência. Verificado no código ao escrever este plano; não
> perca tempo procurando texto do KPI-05 lá dentro. (Confirme visualmente na Task 6.)

- [ ] **Step 1: `02-requisitos.md`**

Na tabela de KPIs, a linha do KPI-05 hoje descreve a fórmula com realização. Trocar a fórmula para
`AVG(dt_liberacao - dt_solicitacao)` (ou a forma usada nas linhas vizinhas — seguir o padrão da
tabela) e o nome para "Tempo médio solicitação → liberação (exame)".

- [ ] **Step 2: `CLAUDE.md` e `SPEC.md`**

Na seção "KPIs do MVP" do `CLAUDE.md`, a linha do KPI-05 diz "solicitação → realização (exame)".
Trocar para "solicitação → liberação (exame)".

`SPEC.md:112` tem a mesma frase (`- \`KPI-05\`: solicitação → realização (exame)`) — trocar também.

- [ ] **Step 3: Rodar a suíte**

Run: `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q`
Expected: sem regressão. O `kpis_router.py` do Step 0 é código — se algum teste fixar o texto da
descrição da rota, atualize-o (é mudança intencional).

- [ ] **Step 4: Commit**

```bash
git add backend/src/pija/routers/kpis_router.py 02-requisitos.md CLAUDE.md SPEC.md
git commit -m "docs(kpis): documentos e OpenAPI acompanham o KPI-05" -m "Requisitos, CLAUDE, SPEC e a descricao da rota falavam de realizacao -- o Swagger em producao descreveria a semantica antiga, com um 'pendente confirmacao HC' que esta entrega resolveu. A Metodologia nao entra: renderiza a partir do KPI_META, ja atualizado."
```

---

### Task 6: Verificação no browser com o backend real

**Files:** nenhum código. Ao final, registrar achados na seção "Registro de execução" deste arquivo.

- [ ] **Step 1: Subir backend e frontend**

```powershell
cd backend; $env:SQLITE_PATH="./data/pija_demo.db"; $env:JWT_SECRET="dev-secret-not-for-production-min-32-chars"; $env:CORS_ORIGINS="http://localhost:5173,http://localhost:5174"; .\venv\Scripts\python.exe -m uvicorn pija.main:app --app-dir src --host 127.0.0.1 --port 8000
cd frontend; $env:VITE_USE_MOCK="false"; $env:VITE_API_BASE_URL="http://127.0.0.1:8000"; npm run dev
```

A primeira carga leva segundos (2,26M eventos) — normal.

- [ ] **Step 2: Checklist em `http://localhost:5173/dashboard`**

- O card de Exames **deixa de exibir "< 1 min"**. O valor esperado é ~9,2 horas.
- `n` do card ≈ **440 mil** (era ~380 mil).
- Conferir direto na API: `http://127.0.0.1:8000/api/v1/kpis/distribuicoes` → a entrada do KPI-05
  deve trazer `p50 ≈ 0,385 dias` (9,23 h) e `teto` ≈ 62 dias.
- **O ponto de atenção desta frente:** mediana 9,2 h com p95 de 1.505 h é assimetria de três ordens
  de grandeza — a linha da mediana vai ficar praticamente colada na origem do eixo. Olhar o
  histograma nos dois temas e julgar honestamente se ele comunica alguma coisa. **Se ficar
  ilegível, NÃO conserte improvisando:** registre na seção "Registro de execução" com números
  medidos e reporte. Mudar a escala do gráfico é decisão de spec, não de implementação.
- O texto de regras (abrir o modal de detalhe do card) traz a ressalva da fila parada.

- [ ] **Step 3: Encerrar os servidores (portas 8000 e 5173) e registrar**

Escrever o resultado do checklist na seção "Registro de execução" abaixo e commitar.

- [ ] **Step 4: Deploy do backend**

```powershell
cd backend; railway up --no-gitignore
```

Depois, confirmar em produção: `https://pija-backend-production.up.railway.app/api/v1/kpis/tempos-medios?group_by=unidade`
deve devolver o KPI-05 com a descrição nova e mediana ~0,385 dias.

---

## Registro de execução

### Task 6 — verificação no browser (2026-08-05)

Backend em `127.0.0.1:8000` sobre `data/pija_demo.db`, frontend em `localhost:5173` com
`VITE_USE_MOCK=false`. Suítes na entrada da task: backend 188, frontend 189, `vue-tsc` limpo.

**Números medidos (`GET /api/v1/kpis/distribuicoes`, entrada do KPI-05):**

| campo | medido | previsto no plano |
|---|---|---|
| `n_total` | **422.080** | ~440.855 |
| `p50` | **0,4006944 dias = 9,62 h** | 0,385 dias (9,23 h) |
| `p95` | **62,8833 dias = 1.509,2 h** | ~62 dias |
| `teto` | **62,8833 dias** (= `p95`) | ~62 dias |

A diferença para o previsto é de recorte, não de cálculo: os números do plano vieram de uma
medição sem escopo, e o dashboard aplica o `grupo_scope` do KPI. A conclusão que motivou a
frente não muda — o card saiu de `< 1 min` para `9,6 horas` e o `n` subiu.

**Checklist:**

1. ✅ O card de Exames exibe **`9,6 horas`**. Não exibe mais `< 1 min`.
2. ✅ `baseado em 422 mil casos` (exato: 422.080 no `aria-label` e na tabela textual).
3. ✅ Subtítulo da área Exames: `Da solicitação do exame à liberação do resultado`.
   ⚠️ O **título do card** vem do backend (`KPI_META` do provider) e lê
   `Solicitação → liberação (exame)`; o `label` do `KPI_META` do frontend
   (`Solicitação → liberação do exame`) é o que aparece na Metodologia. São dois textos
   diferentes para o mesmo indicador — ambos dizem "liberação", então nada está errado, mas a
   divergência existe e não é do escopo desta frente resolver.
4. ✅ A ressalva dos **55%** está no `regras` e renderiza na **Metodologia**, com a frase da fila
   parada íntegra.
   ⚠️ **Correção de premissa:** `regras` **não** aparece em modal de detalhe nenhum. Clicar no
   card abre o ranking de dimensões (`Maior tempo / Menor tempo`, 21 dimensões paginadas), que
   não mostra `regras`. `grep regras frontend/src` só encontra `MetodologiaView.vue:42`. A
   Metodologia é a única superfície onde o usuário lê a ressalva — o que o Step 0 da Task 5 já
   dizia, mas o checklist da verificação supunha um modal que não existe.
5. ✅ Conferido direto na API (tabela acima).
6. ✅ Swagger: a linha do KPI-05 lê `Dias entre solicitação e liberação do resultado do exame`.
   O `(pendente confirmação HC)` sumiu.
7. ⚠️ **Ver a seção abaixo — é o ponto de atenção da frente e a resposta é "só em parte".**
8. ✅ Sem scroll horizontal a 390px: `documentElement.scrollWidth = 385` contra
   `innerWidth = 391`. Os elementos que estouram a viewport estão todos dentro de contêineres
   com overflow próprio (a barra de áreas, que rola de propósito, e a `<table>` do `sr-only`,
   recortada pelo wrapper de 1px descrito no componente).

Capturas (fora do repo, no scratchpad da sessão): card claro, card escuro, histograma ampliado
nos dois temas, mobile 390.

### O histograma do KPI-05 sob assimetria de três ordens de grandeza — veredito

**Não é ilegível, mas não comunica a mediana.** Medido no DOM renderizado (viewBox `0 0 280 81`,
desenhado a 328 CSS px de largura no card):

- O eixo linear vai de 0 a `teto` e termina em `x = 259,76` (unidades de viewBox).
- A linha da mediana cai em **`x = 1,655`** — **0,64% do eixo**, ou **1,9 CSS px** da origem no
  tamanho real do card (1,8 px no mobile de 390). Ela fica visualmente indistinguível do eixo Y.
- O primeiro balde (`0 – 3,9 dias`) tem **281.732 de 422.080 casos = 66,75% da massa** numa
  barra só. A mediana está *dentro* dela, a 11% da sua largura.

**O que o gráfico entrega, e não é pouco:**

- A cauda funciona: barra laranja destacada pelo respiro, rotulada `21 mil casos`, sobre um eixo
  que termina em `62,9 dias`. A mensagem "21 mil exames levaram dois meses ou mais" chega.
- O decaimento entre 3,9 e 62,9 dias é legível. A escala de raiz quadrada mantém as barras 2 a 16
  entre 16,53 e 5,10 unidades (espalhamento de 3,2×) — nenhuma desabou no piso de 3px. Em escala
  linear elas ficariam todas entre 3,0 e 3,4 unidades, isto é, mudas. **A escala sqrt é o que
  salva este gráfico**; sem ela o KPI-05 seria uma barra e dezesseis tocos idênticos.
- O serrilhado é sinal, não ruído: balde 4 (`11,8–15,7 d`, 18.582) é mais alto que o 3
  (`7,9–11,8 d`, 12.426), e o 6 é mais alto que o 5. Há periodicidade real no dado.

**O que ele não entrega:**

- **A manchete.** `9,6 horas` não tem nenhuma sustentação geométrica: dois terços dos casos estão
  numa barra que cobre de zero a 3,9 dias, e o gráfico não diz nada mais fino que "a maioria fica
  abaixo de 3,9 dias". Quem olha o desenho não consegue chegar em 9,6 h — só lendo o texto, que
  já repete o número grande do card.
- **A linha da mediana lê como borda do gráfico.** A 1,9 px da origem, o leitor a interpreta como
  eixo, não como anotação.

**Artefato de renderização (novo achado, não previsto no plano):**

A linha da mediana leva um halo de `stroke-width 3.5` na cor da superfície, pintado por cima das
barras para continuar legível ao cruzá-las. Com a mediana em `x = 1,655`, o halo cobre
`x ∈ [-0,1 ; 3,4]` — e a primeira barra ocupa `x ∈ [0 ; 14,735]`. **Resultado: 23% da largura da
barra mais alta do gráfico é repintada com a cor de fundo.** Nos dois temas a barra que concentra
66,75% dos casos aparece visivelmente mais estreita e com um entalhe à esquerda em relação às
vizinhas — geometria que o leitor lê como dado, e não é.

O artefato **não é novo**, mas o KPI-05 é o pior caso: no KPI-01 (`p50` a 0,02% do eixo) e no
KPI-07B (`p50 = 0`) metade do halo cai fora do viewBox e o estrago fica em ~12%. No KPI-05 a
mediana está longe o bastante de zero para o halo inteiro aterrissar dentro da barra.

**O que um leitor concluiria:** "a maioria dos exames sai rápido e existe uma cauda de 21 mil que
passa de dois meses" — verdadeiro e útil. Não concluiria nada sobre 9,6 horas, e poderia achar
que o primeiro balde é diferente em espécie dos outros por causa do entalhe.

**Nada foi consertado aqui, por decisão do plano** (mudar escala de gráfico é decisão de spec).
Duas coisas ficam na mesa para quem for decidir:

1. **Escala do eixo X.** Com `p95/p50 = 157×`, um eixo linear não consegue servir aos dois. Eixo
   log, ou um segundo desenho ampliando o primeiro balde, é o que tornaria a mediana visível.
   Vale para KPI-01 e KPI-07B pelo mesmo motivo — é uma decisão sobre o componente, não sobre o
   KPI-05.
2. **O halo da mediana.** Recortar o halo contra a barra, ou suprimi-lo quando a mediana cai
   dentro do primeiro balde, resolveria o entalhe sem tocar em escala nenhuma. É bug de desenho,
   não decisão de spec — cabe numa frente própria.

## Self-review (do plano, já aplicado)

- Spec §2 (decisão) → Tasks 1-3 · §3 (ressalva) → Task 4 Step 1 e Task 6 · §4 (implementação) →
  Tasks 2, 4, 5 · §5 (levar ao HC) → já registrado em `DADOS-ESTADO.md` §12, commitado com a spec ·
  §6 (verificação) → Task 6.
- A armadilha real desta frente — a fixture de 17 eventos fixada por `test_eventos.py` — está
  documentada no contexto e resolvida por construção na Task 1 (preencher campo, não adicionar
  evento) e na Task 3 (fixture local isolada).
- Nomes conferidos contra o código real: `KPI_META` (provider e frontend), `load_sql`, `_kpis`,
  `async_engine`, `fixture_db_session`, `FatoEvento`, `timestamp_liberacao`.

## Fora de escopo

Taxa de exames não liberados e idade da fila (Fase B) · investigar/corrigir `data_hora_realizacao`
no ETL · mudanças em outros KPIs · mudanças no `HistogramaTempos.vue`.
