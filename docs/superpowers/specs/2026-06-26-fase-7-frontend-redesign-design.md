# Fase 7 — Repaginação completa do frontend (design)

> Spec de design da Fase 7 (repaginação do front PIJA). Brainstorming concluído em 2026-06-26.
> Convenção do projeto: decisão registrada em MD antes de codar (CLAUDE.md).
> Documentos relacionados: `docs/HANDOFF.md`, `docs/GUIA-FRONTEND.md`, `docs/plans/2026-06-26-roadmap-pos-reuniao-hc.md` (Fase 7).

---

## 1. Objetivo e escopo

Repaginar **toda a camada visual** do frontend do PIJA, com identidade consistente e acabamento de alto padrão, absorvendo os itens de UX decididos com o HC. É um trabalho **front-only sobre mocks** — a camada de dados (services, stores, schemas, mocks) é **mantida** e a conexão real com o backend é fase posterior (Fase 4).

**Dentro do escopo:**
- Design system (tokens + primitivos de UI).
- 3 telas redesenhadas: **Dashboard**, **Gargalos**, **Jornada** (timeline; substitui a tela de Eventos).
- Tema claro + escuro, desktop-first e responsivo até mobile.
- Itens de UX do HC: KPI rotulado por descrição (não pelo código), gargalos com filtro de métrica, filtros por grupo/unidade executora, timeline de jornada.

**Fora do escopo (fases futuras):**
- Conectar ao backend real / hospedagem / CORS / `VITE_USE_MOCK=false` (Fase 4).
- Materialização de KPIs e performance (Fase 3).
- Autenticação/login (Fase 3).
- Novos indicadores operacionais (Fase 5).

## 2. Restrições inegociáveis

- **Stack travada (recomendação HC, não negociar):** Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS + Zod + Axios. **Nenhuma dependência nova** no `package.json` para gráficos ou UI — visualizações em **Tailwind/CSS/SVG puro**.
- **Comunicação HTTP centralizada** em `src/services/api.ts` (sem `fetch` espalhado).
- **Sem dados pessoais:** a UI nunca exibe nome/CPF/idade/sexo/endereço — só `paciente_id` (número do prontuário).
- Camada de dados existente (`services/api.ts`, stores Pinia, schemas Zod, mocks) é **preservada**; muda só a camada visual/componentes.

## 3. Decisões de design (resultado do brainstorming)

| Tema | Decisão |
|---|---|
| Identidade | **Híbrida**: institucional de saúde sóbrio + acabamento moderno (espaço, micro-animações discretas, gráficos bem-feitos). Sem emoji, sem gradiente chamativo. |
| Telas | **3**: Dashboard, Gargalos, Jornada. A Jornada/timeline **substitui** a tela de Eventos. |
| Rótulo de KPI | Título = **descrição legível** (do backend `descricao`), **não** o código técnico ("KPI-05"). O **valor em dias/horas continua sendo exibido**. |
| Gráficos | **Tailwind/CSS/SVG puro**, zero dependência nova. |
| Tema/device | **Claro + escuro**, **desktop-first**, responsivo até mobile. |
| Abordagem | **Design system primeiro** (tokens + primitivos), depois reescrever as 3 telas sobre eles. |
| Avisos/notas | **O mais discretos possível** — só ícone `ⓘ` com tooltip no hover/foco; sem banner fixo nem rodapé sempre visível. |

> Nota sobre "KPIs sem número": no roadmap, "sem número" significava **esconder o código** ("KPI-05" → descrição), **não** esconder o valor. O valor (`media_global`) é exibido normalmente.

## 4. Identidade visual & tokens

Conceito: **"painel clínico-analítico confiável"** — o dado é o protagonista.

- **Cor primária — petróleo/teal** (`brand`, ~`#0F766E` claro / `#14B8A6` escuro): ação primária, links, marca.
- **Neutros (slate, levemente frios):** fundo claro `#F8FAFC`, cards brancos; fundo escuro `#0B1220`, cards `#111827`. Texto com hierarquia (forte/muted).
- **Escala de intensidade (termômetro de tempos):** verde → âmbar → laranja → vermelho, em passos suaves — usada em gargalos e na meta do KPI-07B.
- **Acento de apoio (índigo)** discreto, só para seleção/foco.
- **Tipografia:** **Inter** (fallback system-ui), pesos 400/500/600/700; números com `tabular-nums`.
- **Forma & profundidade:** raio 8–12px, sombras sutis (1–2 níveis), bordas de baixo contraste, **foco visível** (acessibilidade), espaçamento base 4px, transições 150–200ms.
- Tokens declarados no `tailwind.config` (cores, raio, sombra) + variáveis CSS para alternância claro/escuro (estratégia `class` do Tailwind, como já existe).

## 5. Primitivos do design system (`components/ui/`)

Cada primitivo: propósito único, props tipadas, testável isoladamente.

| Primitivo | Propósito |
|---|---|
| `Card` | Container base (superfície, raio, sombra, padding). |
| `Stat` | Número grande + label + N de apoio (`tabular-nums`). |
| `Badge` | Status/intensidade/tipo (variações por cor semântica). |
| `Button` | Ação primária/secundária/ghost. |
| `Select` / `Combobox` | Filtros (grupo, unidade executora, especialidade). |
| `SegmentedControl` | Toggle (ex.: unidade ↔ especialidade `group_by`; transições). |
| `BarRow` | Barra horizontal de breakdown (dimensão + barra proporcional + valor), SVG/div. |
| `RankBar` | Linha do ranking de gargalos (posição + barra colorida pela intensidade). |
| `TimelineItem` | Item da linha do tempo da Jornada. |
| `Skeleton` | Placeholder de carregamento. |
| `EmptyState` / `ErrorState` | Estados vazio/erro (com retry no erro). |
| `Tooltip` | Avisos/notas discretos (hover/foco) — acessível por teclado. |
| `ThemeToggle` | Alternância claro/escuro. |

## 6. App shell & navegação

- **Topbar** fina: marca **PIJA** (logotipo tipográfico + traço de "jornada"), subtítulo "Jornada Assistencial · HC-UFPE", `ThemeToggle` à direita.
- **Sidebar** (desktop), recolhível, 3 itens — **Dashboard · Gargalos · Jornada** — ícones SVG lineares; ativo com barra teal + fundo suave.
- **Bottom-nav** (mobile), mesmos 3 itens.
- **Barra de filtros globais** (vale para Dashboard e Gargalos): **Grupo** (Ambulatorial, Internação, Análises Clínicas, Diagnóstico por Imagem, Anatomia Patológica, Procedimental, Serviços de Apoio), **Unidade executora**, **Especialidade**, **Período** (início/fim) e `SegmentedControl` **unidade ↔ especialidade** (`group_by`). Chips de filtro ativo + "limpar". A Jornada **não** usa essa barra (tem busca própria).

> Os filtros de **grupo** e **unidade executora** são novos na UI (o backend já os aceita). O `useFilterStore` ganha `grupo` (já existem `unidade`, `especialidade`, datas, `group_by`).

## 7. Tela: Dashboard (`/dashboard`)

Fonte: `GET /api/v1/kpis/tempos-medios`.

- **Grid de 5 cards de KPI** (1 col mobile → 2 → 3 desktop). Cada card:
  - **Título = `descricao`** legível; ícone SVG temático discreto.
  - **Valor grande** `media_global` humanizado ("12,4 dias"; "2,4 horas" p/ o KPI-07B), `tabular-nums`; unidade de `unidade_tempo`.
  - **Linha de confiança:** "baseado em N casos" (`n_global`).
  - **Mini-breakdown:** top 3–5 `BarRow` (ordenação já vem do backend); "ver todos" expande.
  - **Avisos/notas discretos:** só ícone `ⓘ` + `Tooltip` (KPI-05 "exames jan–mai/2026"; KPI-07 "permanência no leito, não alta médica"). Sem banner/rodapé fixo.
  - **`media_global: null`** → "sem dados no recorte".
- **KPI-07B "Alta médica → saída do leito"** (horas, meta 4h) aparece **aninhado no card do KPI-07**: sub-linha com valor em horas + indicador de meta (verde ≤4h, âmbar/vermelho acima), usando a escala de intensidade.
- `Skeleton` no load; `ErrorState` com retry. `SegmentedControl` + filtros globais re-buscam.

## 8. Tela: Gargalos (`/gargalos`)

Fonte: `GET /api/v1/gargalos` (já ordenado pior → melhor).

- **Filtro por métrica (HC):** multi-select/`SegmentedControl` de **transição** (`kpi_codes`) — define quais etapas entram no ranking; deixa explícito *o que está sendo medido*.
- **Ranking horizontal:** cada item é um `RankBar` — posição, dimensão (unidade/especialidade), **badge da transição com a descrição legível** (não o código), barra proporcional colorida pela **escala de intensidade**, valor em dias e N.
- Toggle `group_by` unidade ↔ especialidade + filtros globais + `limit`.
- `EmptyState` quando o recorte zera.

## 9. Tela: Jornada (`/jornada`) — substitui Eventos

Fonte: `GET /api/v1/eventos` filtrado por paciente (**mock agora**; ver dependência §11).

- **Busca por prontuário** (`paciente_id`) no topo — campo grande, foco imediato; estado vazio convidativo ("digite um número de prontuário").
- **Timeline cronológica vertical:** cada evento é um `TimelineItem` — ícone/cor por `tipo_entidade` (CONSULTA, EXAME, INTERNACAO, CIRURGIA, PROCEDIMENTO, ALTA, PRONTUARIO), data/hora, unidade, especialidade, `tipo_evento`, `situacao` como `Badge`.
- **Intervalos entre etapas:** conector entre dois eventos mostra o **tempo decorrido** ("8 dias depois") — materializa "onde demora" no caso individual. É o diferencial da tela.
- **Filtro por `tipo_entidade`** dentro da timeline (chips) para focar tipos.
- **Sem dados pessoais** (só `paciente_id`).
- `Skeleton`/`EmptyState`/`ErrorState` próprios; ordenação cronológica garantida no front.
- A rota antiga `/eventos` redireciona para `/jornada`.

## 10. Tratamento de estados (todas as telas)

- **Loading:** `Skeleton` específico por tela (cards, ranking, timeline).
- **Vazio:** `EmptyState` com mensagem contextual.
- **Erro:** `ErrorState` com retry (a fiação de erro já existe nos stores).
- **`null`/listas vazias:** nunca quebrar a tela (regra do GUIA-FRONTEND §4/§6).

## 11. Dependências e notas para fases futuras

- **Backend `paciente_id`:** o contrato atual do `/eventos` **não** filtra por paciente. A Jornada é construída sobre mock nesta fase; conectar de verdade exige **adicionar filtro `paciente_id` ao `/eventos`** (ou um endpoint `/jornada/{paciente_id}`). Anotado para Fase 4/6. **Registrar também em `docs/GUIA-FRONTEND.md` e na lista de pendências do `docs/HANDOFF.md`.**
- **Conexão real** (Fase 4): trocar `VITE_USE_MOCK` e apontar `VITE_API_BASE_URL`; nenhuma mudança de layout esperada.
- **KPI_META** (`types/api.types.ts`): hoje usa emoji e rótulo antigo ("1º Atendimento"). Será migrado para ícones SVG + uso da descrição do backend como título. As constantes mock `UNIDADES`/`ESPECIALIDADES` permanecem para popular filtros enquanto em mock; ganham a lista de **grupos**.

## 12. Critérios de sucesso

- As 3 telas renderizam com identidade consistente, claro e escuro, do desktop ao mobile, sem dependência nova no `package.json`.
- KPIs rotulados por descrição; valor visível; KPI-07B aninhado com indicador de meta 4h; avisos só em tooltip discreto.
- Gargalos com filtro de métrica e ranking colorido por intensidade.
- Jornada: busca por prontuário → timeline cronológica com intervalos entre etapas (sobre mock).
- Filtros globais incluem **grupo** e **unidade executora**.
- Todos os estados (load/vazio/erro/null) tratados; `type-check` e `build` passam.
- Demo continua no ar na Vercel em modo mock após o deploy automático da `main`.
