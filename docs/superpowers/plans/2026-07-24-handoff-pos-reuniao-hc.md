# Handoff — pós-reunião com o HC (continuar em nova sessão)

> **Data:** 2026-07-24. Reunião com o HC-UFPE concluída hoje. Esta sessão está com pouco contexto —
> este doc dá à próxima sessão tudo pra retomar **specs → planejamento → implementação** sem o histórico.
> **Apresentação final:** ~07/08/2026.

---

## 0. TL;DR

- **Filtros (multiseleção + classificação de exames) estão PRONTOS e NO AR** (`pija-alpha.vercel.app`).
- A reunião destravou o AGHU e mudou premissas importantes (**banco é PostgreSQL, não Oracle**; deploy será
  numa **VM dentro do HC**).
- **Estratégia de apresentação:** apresentar com os **dados atuais (CSV→SQLite)**; a banca **precisa acessar o
  sistema e usar os filtros ao vivo**. Conexão real com o AGHU vem **depois** — não é pré-requisito do dia.
- **Frentes a correr até a apresentação:** ciclicidade da jornada · navegação por áreas · indicadores gráficos
  · metodologia dos KPIs.

---

## 1. Estado atual (o que já está feito e no ar)

- **Classificação de exames + multiseleção nos filtros** — entregue e deployado.
  - Multiseleção (Grupo/Unidade/Especialidade) em KPIs, Gargalos, Eventos; cascata Grupo→Unidade→Especialidade;
    unidades agrupadas por grupo (optgroups).
  - Backend **147 testes** verdes; frontend **35 testes** + type-check limpo. Já mesclado na `main` e deployado
    (Railway backend + Vercel frontend). Verificado em produção.
  - Specs/planos: [2026-07-06-filtros-exames-multiselect-design.md](../specs/2026-07-06-filtros-exames-multiselect-design.md),
    [2026-07-06-filtros-exames-multiselect.md](2026-07-06-filtros-exames-multiselect.md).
- Feedback da apresentação registrado em [2026-07-06-feedback-apresentacao.md](2026-07-06-feedback-apresentacao.md)
  (§6 marcado como concluído).

---

## 2. Resultados da reunião — infra & deploy

**Como vai ser o deploy (decisão do HC):**
1. **Compartilhar nosso GitHub com o HC.** Eles farão o deploy da versão que tivermos.
2. Eles vão **commitar arquivos de containerização/configuração de deploy** (ex.: Dockerfile, configs) —
   **não vão mexer no nosso código**.
3. Eles **provisionam uma VM pra gente**. Quem tem acesso à VPN consegue usar o AGHU.
4. Padrão desses projetos CIn×HC: **cada projeto tem um SQLite pequeno dentro da própria VM**. Ou seja, a
   arquitetura atual (SQLite local alimentado a partir da fonte) **se mantém** — a VM fica **dentro da rede do
   HC**, então ela **alcança o AGHU** (isso resolve o problema de "acesso em produção" que discutimos —
   **não precisamos de site-to-site**; a VM já está na rede interna).

**⚠️ Banco no deploy (pendência prática):**
- Nosso SQLite é **gitignored**. Se o banco **não estiver no GitHub**, precisamos **enviar o banco pra eles**
  (ou garantir que eles consigam gerá-lo via ETL a partir dos CSVs / do AGHU).
- Decidir com a próxima sessão: mandar o `.db` pronto, ou entregar CSVs + rodar o ETL na VM.

---

## 3. Resultados da reunião — banco de dados (CORREÇÃO DE PREMISSA)

- **O AGHU roda em PostgreSQL, NÃO Oracle.** E, segundo o HC, "já tem tudo pronto (providers, scripts, etc.)"
  do lado deles pra acessar.
- **Impacto no nosso código:** o adapter `AghuResource` (Fase 5) deve usar **`psycopg`/`asyncpg`**, **não
  `python-oracledb`**. O DSN é de Postgres.
- **Docs a corrigir** (assumem Oracle): [05-interfaces.md](../../../05-interfaces.md) §Tipo/Driver,
  [06-arquitetura.md](../../../06-arquitetura.md), e o `CLAUDE.md` (stack menciona `python-oracledb`).
- Adapter `Resource` plugável já existe (`RESOURCE_MODE=csv|aghu`) — a troca é localizada, mas precisa ser
  feita e testada contra o Postgres real (via VPN/VM).

---

## 4. Frentes a implementar (prioridade até a apresentação)

> Fluxo por frente: **brainstorming → spec (`docs/superpowers/specs/`) → plano (`docs/superpowers/plans/`) →
> subagent-driven-development**. Foi assim que os filtros foram feitos.

### 4.1. Ciclicidade da jornada — **prioridade máxima / maior diferencial**
- **Insight-chave da reunião:** NÃO é só a jornada de **um paciente**. Precisa ter também a visão do
  **todo — o fluxo agregado da jornada de toda a população** (as idas e vindas no geral). São **dois escopos**:
  - **(a) Individual:** a jornada de um `paciente_id` com seus retornos/reinternações (evolui a tela Jornada atual).
  - **(b) Agregado:** o fluxo geral entre etapas somando todos os pacientes — candidato natural: **diagrama de
    Sankey / grafo de transições** (contagem de transições etapa→etapa: consulta→exame, exame→consulta,
    consulta→internação, alta→retorno ambulatorial, etc.).
- **"Pensar como fazer isso"** (pedido explícito): o agregado precisa de um **novo agregado no backend**
  (contar transições entre `tipo_entidade`/etapas por paciente, ordenadas no tempo) + uma **visualização** no
  front. Relaciona com o ranking de Gargalos (que já é transições dimensão×métrica).
- Usar a skill `dataviz` ao construir a visualização.

### 4.2. Navegação por áreas da jornada
- Reestruturar a interface separando por **Entrada · Exames · Consultas · Internação · Cirurgias**.

### 4.3. Indicadores mais gráficos
- Exibir alguns indicadores de forma gráfica conforme o tipo (ex.: histograma de tempos — mostra a cauda que a
  mediana esconde). Skill `dataviz`.

### 4.4. Aprofundar a Metodologia dos KPIs
- Deixar a página `/metodologia` mais didática: fórmula, exemplo numérico, por que mediana, exclusões.

### 4.5. AGHU (PostgreSQL) — destravado, mas pós-apresentação
- Agora é viável (VM dentro da rede + Postgres pronto). Mas **a apresentação roda com CSV**; conectar no AGHU
  é passo seguinte. Trabalho: `AghuResource` com psycopg + validar schema das views reais ×
  `fato_eventos_jornada` ([DADOS-ESTADO.md](../../DADOS-ESTADO.md)).

---

## 5. Estratégia de apresentação (importante)

- **Pode apresentar com os CSVs atuais** (camada CSV→SQLite já no ar). Conectar "de verdade" no AGHU vem depois.
- **A banca PRECISA conseguir acessar o sistema, aplicar filtros e navegar ao vivo.** Logo: manter
  `pija-alpha.vercel.app` (front) + backend no ar, acessível e funcional, é requisito do dia.
- Não bloquear a apresentação em nada que dependa do AGHU.

---

## 6. Pendências / itens em aberto

- **Enviar o banco pro HC** (ou CSVs + ETL) — o `.db` é gitignored (ver §2).
- **Corrigir premissa Oracle → PostgreSQL** nos docs e no `AghuResource` (ver §3).
- **Confirmar lista completa de Internação** com o HC (o docx só trouxe "8º SUL"; classificação já funciona por
  padrão de nome).
- **Refinar KPI-01** (âncora: só prontuários abertos na janela).
- Follow-ups técnicos: **race guard** em `scopeEspecialidades`/`scopeByGrupo` (toggle rápido → resposta fora de
  ordem; deferido de propósito, precisa de teste próprio); **índices secundários** no banco (a cascata teve
  ~2-3s de lag no demo DB sem índices).

---

## 7. Como rodar / testar / deployar (ponteiros)

- **Backend testes:** `cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest` (147 verdes).
- **Frontend testes/type-check:** `cd frontend; npx vitest run` (35) · `npm run type-check` (limpo).
- **Rodar local com backend real:** backend `uvicorn pija.main:app` com `SQLITE_PATH=./data/pija_demo.db`,
  `JWT_SECRET=...`, `CORS_ORIGINS=http://localhost:5173,http://localhost:5174`; frontend
  `VITE_USE_MOCK=false VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev`.
- **Deploy backend:** `railway up --no-gitignore` na pasta `backend` (embute `data/pija_demo.db`). O `railway up`
  às vezes sai com "erro" por timeout de log **mas o deploy sobe** — confirmar pollando o endpoint.
  ⚠️ Isso muda quando o HC assumir o deploy na VM (ver §2).
- **Deploy frontend:** `git push` no `main` → Vercel auto-deploya. **Ordem de deploy:** backend antes do
  frontend (o front novo manda params repetidos que exigem o backend novo).
- **Arquitetura backend (seguir):** `.sql → Provider → Controller → Router → Schema` + teste. Filtros
  multivalor via `pija.sql_filtros.build_filtros` (helper `IN` parametrizado). Gargalos reusa `KpisProvider.compute`.
- **paciente_id exemplo p/ Jornada:** `21331343` (e 21529797, 13961980).

---

## 8. Primeiro passo sugerido pra próxima sessão

1. **Brainstorm da ciclicidade** (§4.1) — é a de maior valor e a que mais precisa de design, por causa do
   escopo duplo (individual + agregado). Definir a visualização do fluxo agregado antes de codar.
2. Em paralelo, resolver a logística do **banco pro HC** (§2) e a **correção Oracle→Postgres** (§3), que são
   rápidas e destravam o caminho do AGHU.
3. Depois: navegação por áreas → gráficos → metodologia.
