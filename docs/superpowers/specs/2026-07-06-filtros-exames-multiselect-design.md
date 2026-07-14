# Spec — Filtros: classificação de exames (cascata + agrupamento) + multiseleção

> **Data:** 2026-07-06 · **Origem:** feedback da apresentação (Demo Day 01/07) — ver
> [2026-07-06-feedback-apresentacao.md](../plans/2026-07-06-feedback-apresentacao.md) §6.
> **Escopo:** frontend + backend (endpoint e SQL). **Sem migração / sem ETL** (a coluna `grupo` já existe e está populada).

---

## 1. Contexto e objetivo

A classificação de exames por **Grupo → Executores** (docx do HC) **já está implementada** no backend
(`pija/unidades.py::get_grupo`, coluna `fato_eventos_jornada.grupo`, exposta em `/dimensoes`). O que falta é
**surfacar** essa classificação nos filtros, "bem separadinho", e permitir **selecionar vários** valores.

Objetivo: filtros que (a) encadeiam Grupo → Unidade → Especialidade, (b) mostram as unidades **agrupadas
por Grupo**, e (c) aceitam **multiseleção** em Grupo, Unidade e Especialidade.

## 2. Estado atual

- **Frontend:** `useFilterStore` guarda `grupo/unidade/especialidade` como **valor único** (`string | null`).
  `FilterBar` tem 3 `<select>` planos (`FilterSelect.vue`). Cascata só `unidade → especialidade` (via
  `getDimensoes(unidade)` → `/dimensoes?unidade=`).
- **Backend:** `/dimensoes` devolve `{ grupos: string[], unidades: string[], especialidades: string[] }`;
  `?unidade=X` escopa especialidades. Os SQL de KPI/gargalos/eventos filtram com `(:x IS NULL OR col = :x)`
  (igualdade de valor único). Cada KPI tem ainda um **escopo fixo de grupos** (`KPI_GRUPO_SCOPE`) injetado
  como `AND grupo IN (...)` — **independente** do filtro do usuário.
- Consumidores dos filtros globais (`useFilterStore.activeFilters`): **KPIs**, **Gargalos** e **Eventos**.

## 3. Requisitos

- **R1 — Cascata Grupo → Unidade → Especialidade.** Selecionar Grupo estreita Unidade **e** Especialidade;
  selecionar Unidade estreita mais a Especialidade. Limpar restaura as listas completas.
- **R2 — Agrupamento visual (optgroups) na Unidade.** A lista de Unidade aparece sob cabeçalhos por Grupo.
  (Só na Unidade; Grupo é o topo; Especialidade fica escopada porém plana — é muitos-para-muitos.)
- **R3 — Multiseleção** em Grupo, Unidade e Especialidade. Datas permanecem intervalo (não multiselect).
  Vários valores no mesmo filtro = **OR** (`IN`). Filtros diferentes continuam **AND** entre si.

## 4. Fora de escopo (YAGNI)

- Reordenar/curar o dropdown de Grupo por área da jornada (fica pro §4 do feedback, navegação por áreas).
- Optgroups na Especialidade.
- Completar o mapa explícito de Internação em `unidades.py` (a classificação por padrão já cobre; a lista
  completa com o HC é **pendência separada** e não bloqueia).
- Multiseleção de intervalo de datas.

## 5. Design

### 5.A — Modelo de filtros (frontend)

`useFilterStore`: `grupo`, `unidade`, `especialidade` passam de `string | null` para **`string[]`** (vazio =
"Todas"). Setters viram **toggle em lista** (add/remove). `activeFilters` envia arrays; `activeCount` conta
filtros não-vazios. `reset()` zera as listas.

### 5.B — Contrato de API

**`/dimensoes`:**
- `unidades` passa a ser **anotada com grupo**: `unidades: { valor: string, grupo: string | null }[]`
  (o front usa para montar os optgroups). `grupos` e `especialidades` seguem `string[]`.
- Novo parâmetro **`grupo`** (repetível): `?grupo=A&grupo=B` escopa unidades **e** especialidades à **união**
  dos grupos. `?unidade=U` (repetível) escopa especialidades (comportamento atual, agora aceitando vários).
- Sem parâmetros → tudo. Mantém exclusão de `INATIVO`.

**Endpoints filtrados (KPIs, Gargalos, Eventos):** os campos `grupo`, `unidade`, `especialidade` dos
schemas de request passam de escalar para **lista** (query param repetível — o `paramsSerializer` do
`api.ts` já serializa arrays como chave repetida, ex. `kpi_codes`). Ausente/vazio = sem filtro.

### 5.C — Backend (SQL + providers)

- **Predicados de filtro** deixam de ser `(:x IS NULL OR col = :x)` e passam a **`IN`** com **expansão
  dinâmica de parâmetros**: para uma lista `[a,b]`, gera `col IN (:x_0, :x_1)` e vincula `{x_0:a, x_1:b}`
  (parametrizado — sem interpolar valor do usuário). Lista vazia/ausente = predicado omitido (sem filtro).
  Como os predicados hoje estão **hardcoded** nos `.sql`, introduzir um placeholder `{filtros}` que o
  provider preenche com os fragmentos `IN` construídos em Python (mesma técnica já usada em
  `_scope_fragment`). Centralizar essa construção num helper único reutilizado por KPIs/gargalos/eventos.
- **Interação com `KPI_GRUPO_SCOPE`:** o escopo fixo do KPI (whitelist) e o filtro de grupo do usuário são
  **duas** cláusulas `AND` → o efeito é a **interseção**. Ex.: KPI-05 (fixo = Análises/Imagem/Patológica) com
  o usuário escolhendo `[Diagnóstico por Imagem, Internação]` resulta em só `Diagnóstico por Imagem`. Isso é
  o comportamento correto e deve ter teste.
- **`/dimensoes`:** `dimensoes.sql` acrescenta `grupo` na linha de unidade; a query de escopo filtra por
  `grupo IN (...)` / `unidade IN (...)`, mantendo `INATIVO` excluído.

### 5.D — Componentes frontend

- **`FilterSelect.vue` → multiseleção.** `modelValue: string[]`; dropdown com **checkboxes** (mantém aberto
  ao marcar) e um resumo no gatilho (ex.: "Grupo (2)"). Prop opcional **`groups`** para renderizar
  **optgroups** (usada na Unidade). Mantém acessibilidade (teclado, labels).
- **`useDimensoesStore`:** cacheia `unidadesFull` (com grupo) e `especialidadesFull`; expõe
  `unidadesAgrupadas` (agrupadas por grupo p/ optgroups) e `scopeByGrupo(grupos: string[])`; mantém
  `scopeEspecialidades(unidades: string[])`.
- **`FilterBar.vue`:** Unidade usa optgroups; watcher em `filter.grupo` (lista) → limpa unidade+especialidade
  e chama `scopeByGrupo`; watcher em `filter.unidade` (lista) → reescopa especialidade. Limpar restaura do cache.

### 5.E — Casos de borda

- `unidade → grupo` é 1:1 (`get_grupo`) → optgroups limpos.
- `especialidade ↔ grupo` é muitos-para-muitos → escopo de especialidade por **query** (correto).
- Grupo do usuário fora da whitelist de um KPI → interseção vazia → KPI "sem dados no recorte" (esperado).
- Seleção que fica órfã ao reescopar (ex.: unidade não pertence a nenhum grupo ainda selecionado): ao trocar
  Grupo, limpar Unidade/Especialidade (evita estado inconsistente). Documentar esse "limpa ao mudar o pai".
- Lista vazia = "Todas" (sem filtro). `INATIVO` sempre excluído.

## 6. Testes (TDD)

- **Backend:**
  - Helper de `IN`/expansão: 0, 1, N valores; vazio = sem cláusula; parametrização (sem injeção).
  - `/dimensoes`: `?grupo=` (1 e vários) escopa unidades+especialidades à união; unidades vêm anotadas com
    grupo; `INATIVO` excluído; combinação `grupo`+`unidade`.
  - KPIs/Gargalos: filtro multivalor (`IN`); **interseção** com `KPI_GRUPO_SCOPE`; ausência = sem filtro.
- **Frontend:**
  - `useFilterStore`: toggle em lista, `activeCount`, `reset`.
  - `unidadesAgrupadas` (agrupamento) e `scopeByGrupo`.
  - `FilterSelect`: render de checkbox/optgroup e emissão de `string[]`.

## 7. Ordem de implementação sugerida

1. **Fundação multiseleção (backend):** helper de expansão `IN` + placeholder `{filtros}` nos `.sql` +
   schemas de request como listas. Testes. (Não muda a UI ainda; endpoints passam a aceitar listas.)
2. **Fundação multiseleção (frontend):** `useFilterStore` → arrays; `FilterSelect` → checkboxes;
   `FilterBar` liga os arrays. Testes. (Comportamento visível: multiselect nos 3 filtros, ainda planos.)
3. **`/dimensoes` grupo + anotação:** parâmetro `grupo`, unidades anotadas, `scopeByGrupo`. Testes.
4. **Cascata + optgroups (frontend):** optgroups na Unidade, watcher de grupo, "limpa ao mudar o pai". Testes.

## 8. Riscos / decisões em aberto

- **Multiseleção é transversal** (toca KPIs, Gargalos, Eventos e o modelo de filtros). É a maior parte do
  esforço — não é um toggle de UI. Por isso vai como **fundação** (passos 1–2) antes do grupo/cascata.
- Widget de multiseleção: checkbox-dropdown custom (recomendado) vs `<select multiple>` nativo (UX pior).
  Decisão: **checkbox-dropdown** no `FilterSelect`.
- Lista completa de Internação com o HC — pendência separada, não bloqueia.
