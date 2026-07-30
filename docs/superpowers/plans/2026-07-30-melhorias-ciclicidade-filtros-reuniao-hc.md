# Plano — melhorias pós-reunião HC (grafo, filtros, metodologia)

> **Origem:** reunião com o HC após a ciclicidade ir pro ar. Grafo foi "diferencial grande"; pedidos são de
> **exibição** (setas, controle didático, sobreposição), **filtros** (especialidade como principal + cascata) e
> **entendimento dos números**. Decisões travadas com o usuário em 2026-07-30.

## 0. Achados de dados que embasam o plano (ponto 3 do HC)

Investigação na base real (`pija_demo.db`, 2.264.504 eventos):
- **1 linha = 1 evento.** Por `tipo_entidade`: EXAME 979.847 · PROCEDIMENTO 407.805 · PRONTUARIO 354.790 ·
  CONSULTA 167.578 · INTERNACAO 163.484 · ALTA 163.255 · CIRURGIA 27.745.
- **EXAME: 1 linha = 1 *item* de exame** (o ETL usa `exame_id` = código do exame, não único por linha). Um painel
  laboratorial vira várias linhas com o mesmo horário de solicitação.
- **O número na aresta do grafo = nº de TRANSIÇÕES** (par evento→próximo-evento por paciente), não total de eventos.
- **EXAME→EXAME = 926k (~1h)** é em boa parte **artefato**: itens do mesmo pedido, minutos entre si.
- **`especialidade` tem 705 valores; 466 no formato `BASE - SUBTIPO`** (ex.: `REUMATOLOGIA - INFUSAO`, `- LUPUS`,
  `- INFILTRAÇÃO`). A "cascata" que o HC pediu já está no campo, como sufixo.

## 1. Decisões (travadas)

| Tema | Decisão |
|---|---|
| Artefato EXAME→EXAME | **Manter e explicar** (nota na tela/metodologia; sem mexer no ETL agora) |
| Controle do grafo | **Uma barra = quantas ver** (top-N) **+ um seletor = ordenar por** ("mais casos" / "mais rápido→mais lento") |
| Sobreposição | Manter layout circular; **eliminar linha cobrindo outra por inteiro** (colineares/bidirecionais) + rótulos nunca sobrepostos |
| Setas de direção | Claras nos **dois** grafos (agregado e individual) |
| Números do individual | Mais **discretos** |
| Filtros | **Especialidade = filtro principal** (topo) com cascata **base → subtipo**; Grupo e Unidade **abaixo** |

## 2. Workstreams

### A. Grafo — setas de direção claras (pontos 1.1 e 4)
- **Arquivo:** `frontend/src/components/ciclicidade/TransitionGraph.vue`.
- Hoje a seta é um `marker-end` pequeno. Deixar a direção **inequívoca**: seta maior e/ou uma seta no meio da
  aresta (mid-arrow) apontando origem→destino. Aplica aos dois escopos (agregado e `paciente`).
- Verificar no browser (agregado + individual).

### B. Grafo — controle didático "Quais transições você quer ver?" (ponto 1.2)
- **Arquivo:** `TransitionGraph.vue`.
- Trocar o rótulo do slider atual por **"Quais transições você quer ver?"**.
- **Barra 1 — quantas ver:** o top-N atual (já existe), renomeado pra algo como "Quantidade de transições".
- **Seletor 2 — ordenar por:** `SegmentedControl` com "Mais casos" (volume desc, default) e "Mais rápido → mais
  lento" (tempo asc). O top-N passa a cortar segundo o critério escolhido (hoje é sempre por volume).
- Ajuste em `ordenadas`/`transicoesVisiveis` pra ordenar pelo critério ativo antes do `slice(topN)`.

### C. Grafo — não deixar linha cobrir outra (ponto 1.3)
- **Arquivo:** `TransitionGraph.vue`.
- Causa provável: arestas **colineares** (mesmo par em direções opostas, ou duas arestas quase na mesma reta)
  desenhadas por cima uma da outra.
- **Correções:**
  1. Curvatura **distinta por aresta** (não só por "avanço/retorno"): deslocar o ponto de controle por um fator
     que dependa do par (ex.: índice do par na lista), garantindo que A→B e B→A e vizinhas não colidam.
  2. **Não passar por cima dos nós:** afastar a curva de nós não-extremos (aumentar o arco quando a reta
     origem→destino cruzaria um terceiro nó).
  3. Rótulos: já têm pílula; garantir que não se sobreponham (com menos arestas por padrão, resolve na prática).
- Critério de aceite: nenhuma aresta cobre outra por inteiro; verificar no browser com o top-N default.

### D. Grafo individual — números mais discretos (ponto 4)
- **Arquivo:** `TransitionGraph.vue` (escopo `paciente`).
- Selo do passo menor e menos berrante (raio menor, cor mais sóbria / contorno em vez de preenchido forte),
  mantendo legível. Setas de direção idem ao item A.

### E. Filtros — Especialidade principal + cascata base→subtipo (ponto 2)
- **Arquivos:** `frontend/src/components/ui/FilterBar.vue`, `frontend/src/stores/useDimensoesStore.ts`
  (e `FilterSelect.vue` se precisar de um 2º nível). **Sem mudança de backend** (derivação no front).
- **Reordenar:** Especialidade (base) no topo, depois **subtipo**, depois Grupo e Unidade executora.
- **Derivar base→subtipo** no `useDimensoesStore`: para cada `especialidade`, base = trecho antes do primeiro
  `" - "` ou `" ("`; subtipo = restante. Agrupar as 705 em ~N bases (REUMATOLOGIA, NEFROLOGIA, …).
- **Filtro:** ao escolher a base, **expandir** para todos os valores brutos daquela base e mandar no filtro
  `especialidade` (IN) já existente — **zero mudança no backend/SQL**. Ao escolher subtipo(s), restringe a esses.
- Manter a cascata atual (Grupo→Unidade→Especialidade) coerente com a nova ordem.
- Verificar no browser: escolher "REUMATOLOGIA" → subtipos (INFUSAO, LUPUS, INFILTRAÇÃO…) aparecem; aplica coorte.

### G. Grafo — escolher explicitamente **quais** transições aparecem (pedido pós-entrega, 2026-07-30)

- **Arquivo:** `TransitionGraph.vue`.
- **Motivo:** o controle da frente B só responde "quantas" (top-N) e "em que ordem". O pedido é poder **escolher
  quais** transições aparecem, de forma bem didática.
- **Decisão:** o controle "Quais transições você quer ver?" passa a ter **dois modos**:
  1. **"As principais"** (default) — o comportamento da frente B (quantidade + ordenar por), inalterado.
  2. **"Escolher"** — seleção explícita, com quatro elementos didáticos:
     - **Atalhos que ensinam o vocabulário do grafo:** `Todas`, `Só avanços`, `Só retornos`, `Só repetições`.
       Cada atalho **preenche a seleção** (não é um segundo filtro paralelo — evita dois estados concorrentes
       e mantém uma única fonte de verdade).
     - **Seletor `Transições`** reusando o `FilterSelect` da barra de filtros, agrupado por tipo de movimento e
       com cada item rotulado `Consulta → Procedimento · 60,9k · 33d` — volume e tempo à vista para a escolha
       ser informada.
     - **Chips do que está escolhido**, com ✕ para remover uma a uma: a escolha fica visível sem abrir o seletor.
     - **Contador** "mostrando X de Y transições".
  - Ao entrar no modo "Escolher", a seleção é **semeada com o que já estava visível** — você vê o mesmo grafo e
    ajusta a partir dele, em vez de começar do zero.
  - Seleção vazia mostra o aviso "Nenhuma transição escolhida" em vez de um grafo vazio silencioso.
- **Três tipos de movimento** (predicados): **avanço** (destino depois na ordem canônica), **retorno** (destino
  antes) e **repetição** (origem = destino). As cores seguem a legenda atual — repetição pinta como
  "retorno / ciclo".
- Disponível só no escopo **agregado** (no individual a ordem cronológica é o que importa). O limite para exibir o
  controle caiu de "> 12 transições" para "> 3": com poucas transições o top-N é inútil, mas **escolher** não é.
- Trocar a coorte (filtros) pode invalidar a escolha inteira; nesse caso o grafo **volta a semear** com as
  principais da coorte nova em vez de ficar vazio parecendo bug.

### F. Metodologia — explicar os números (ponto 3)
- **Arquivos:** `frontend/src/views/MetodologiaView.vue` (+ um tooltip/nota curta na `CiclicidadeView`).
- Texto curto e honesto: "cada linha é um evento; para exames, cada **item** conta como um evento (um pedido
  pode gerar vários) — por isso Exame→Exame aparece alto. O número na seta é a **quantidade de transições**
  (idas de uma etapa à seguinte), não o total de eventos."
- Registrar o achado também em `docs/DADOS-ESTADO.md` (convenção MD).

## 3. Sequência sugerida (de-riscada, do mais rápido/seguro ao maior)
1. **F** (metodologia/nota) — rápido, e é o que o HC pediu pra "entender/apresentar".
2. **A** (setas) + **D** (números discretos) — ganhos visuais rápidos nos dois grafos.
3. **B** (controle didático top-N + ordenar por).
4. **C** (sobreposição) — verificar bastante no browser.
5. **E** (filtro especialidade principal + cascata) — maior; frontend only.

## 4. Fora de escopo (por ora)
- Colapsar itens de exame do mesmo pedido (decidido: manter + explicar).
- Mudança de layout do grafo (Sankey/arcos) — mantido circular.
- Mudança de backend nos filtros (derivação base→subtipo é no front).

## 5. Verificação
- Frontend: `npx vitest run` + `npm run type-check` a cada frente.
- Browser (dev com backend real): agregado (`/ciclicidade`) e individual (`/jornada`), nos dois temas.
- Testes de componente novos para B (ordenar por) e E (agrupamento base→subtipo).

---

## 6. Como implementar numa nova sessão (handoff)

**Prompt de abertura** (colar na sessão nova):
> Execute o plano em `docs/superpowers/plans/2026-07-30-melhorias-ciclicidade-filtros-reuniao-hc.md`, na ordem da
> seção 3. As frentes de grafo (A–D) são visuais — implemente e **verifique no browser** (Playwright) com o backend
> real, iterando. A frente E (filtros) pode ir por subagente + testes. As 3 decisões da §1 já estão travadas, não
> re-perguntar. Rode dev/testes com os comandos da §6. Não commitar o banco (público + dado de paciente).

**Skills a usar:** `superpowers:executing-plans` ou `superpowers:subagent-driven-development` (frente E); para as
frentes de grafo, trabalho hands-on com verificação no browser (a viz é iterativa). Verificação antes de concluir.

**Arquivos-alvo principais:**
- Grafo (A–D): `frontend/src/components/ciclicidade/TransitionGraph.vue`
- Filtros (E): `frontend/src/components/ui/FilterBar.vue`, `frontend/src/stores/useDimensoesStore.ts`, `FilterSelect.vue`
- Metodologia (F): `frontend/src/views/MetodologiaView.vue`, `CiclicidadeView.vue`, `docs/DADOS-ESTADO.md`

**Rodar em dev (PowerShell), backend real + frontend:**
```powershell
# Backend (porta 8000) — usa o banco demo com dados reais
cd backend; $env:SQLITE_PATH="./data/pija_demo.db"; $env:JWT_SECRET="dev-secret-not-for-production-min-32-chars"; $env:CORS_ORIGINS="http://localhost:5173,http://localhost:5174"; .\venv\Scripts\python.exe -m uvicorn pija.main:app --app-dir src --host 127.0.0.1 --port 8000
# Frontend (porta 5173) — aponta pro backend real
cd frontend; $env:VITE_USE_MOCK="false"; $env:VITE_API_BASE_URL="http://127.0.0.1:8000"; npm run dev
```
> Paciente de exemplo pra Jornada individual: `21331343`. O agregado sem filtro varre ~2,26M eventos e leva ~5s
> na 1ª carga (normal). Ao terminar, encerrar os servidores (portas 8000/5173).

**Testes:**
```powershell
cd backend; $env:JWT_SECRET="test-secret-not-for-production-min-32-chars"; .\venv\Scripts\python.exe -m pytest -q
cd frontend; npx vitest run; npm run type-check
```

**Deploy pra produção (quando aprovado)** — ordem **backend → frontend** (o front novo pode exigir o backend novo):
1. Backend (Railway): `cd backend; railway up --no-gitignore` (embute `data/pija_demo.db`); confirmar pollando o
   endpoint (`railway up` às vezes "erra" por timeout de log mas sobe). Prod: `https://pija-backend-production.up.railway.app`.
2. Frontend (Vercel): `git push origin <branch>:main` (FF) → auto-deploy. Prod: `https://pija-alpha.vercel.app`.
   *Nesta rodada é só frontend → pode ir direto pra main.*

**Contexto de dados já apurado** (não re-investigar): ver §0. `especialidade` = `BASE - SUBTIPO` (dividir no `" - "`
ou `" ("`); a seta do grafo conta **transições**, não eventos; EXAME→EXAME infla por item de exame.

---

## 7. Registro de execução (2026-07-30)

**Status: todas as frentes (F, A, D, B, C, E) implementadas e verificadas** — vitest 78/78, vue-tsc limpo,
pytest 160/160, browser (agregado + individual, temas claro e escuro, backend real).

### Decisões de implementação tomadas durante a execução

**Grafo (A/C/D) — `TransitionGraph.vue`:**
- A causa das setas "invisíveis": as arestas terminavam no **centro** do nó e a ponta ficava embaixo do círculo.
  Correção: aparar a curva na borda do nó (origem e destino).
- `context-stroke` no `<marker>` não herda a cor da aresta de forma confiável no Chromium → **dois markers**
  (um por cor, avanço/retorno) com classes de fill explícitas.
- Seta adicional no **meio** de cada aresta (t≈0,28 da Bézier), escalada pela espessura.
- Sobreposição: curvatura sempre **à esquerda do sentido de percurso** (A→B e B→A caem em lados opostos da
  corda), variação determinística por par (hash), desvio iterativo de nós intermediários, curvatura extra por
  **repetição** do mesmo par (grafo individual) e laços maiores por repetição de auto-laço.
- Rótulos: passe de de-overlap (tenta posições ao longo da curva) + clamp no viewBox (resolveu o rótulo do
  auto-laço do Proced. cortado na borda).

**Filtros (E) — decisões travadas em código (`frontend/src/lib/dimensoes.ts`):**
1. Subtipo com `" ("`: **sem** parênteses (`CARDIOLOGIA (ECO)` → base `CARDIOLOGIA`, subtipo `ECO`).
2. Só o **primeiro** separador divide (`NEFROLOGIA - PRE - TRANSPLANTE` → subtipo `PRE - TRANSPLANTE`);
   hífen sem espaços (`PRE-NATAL`) não separa.
3. Subtipos selecionados restringem **apenas a própria base**; base selecionada sem subtipos marcados expande
   para todos os seus valores brutos. O filtro enviado à API continua sendo a lista de valores BRUTOS
   (contrato backend intacto, zero mudança de SQL).
4. **Base é trimada** no split: a base real do HC tem `ALERGIA  - LACTENTE SIBILANTE` (dois espaços), que sem
   trim virava uma segunda base "ALERGIA" duplicada no select (achado do teste em browser).
5. O select de Subtipo usa o **valor bruto** como value (label = subtipo) pra evitar ambiguidade entre bases
   com subtipos homônimos.

**Ressalva registrada:** `toggleEspecialidade` (ação legada do `useFilterStore`) altera só os valores brutos sem
sincronizar base/subtipo — nenhum consumidor da UI nova a usa hoje.
