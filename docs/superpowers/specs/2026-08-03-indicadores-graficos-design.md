# Spec — Indicadores gráficos (histograma de distribuição de tempos)

> **Data:** 2026-08-03 · **Status:** aprovada pelo usuário (brainstorm nesta data)
> **Origem:** feedback do Demo Day ([2026-07-06-feedback-apresentacao.md](../plans/2026-07-06-feedback-apresentacao.md) §3)
> e handoff pós-reunião HC ([2026-07-24-handoff-pos-reuniao-hc.md](../plans/2026-07-24-handoff-pos-reuniao-hc.md) §4.3):
> exibir indicadores de forma mais gráfica **conforme o tipo** — para tempos, a distribuição/histograma
> "mostra a cauda que a mediana esconde".

---

## 1. Decisões (travadas no brainstorm de 2026-08-03)

| Tema | Decisão |
|---|---|
| Escopo | **Barras + histograma.** Barras por dimensão **já existem** (top-5 no `KpiBreakdownBar` do card, lista completa com busca/ordenação no `KpiDetailModal`, ranking nos Gargalos) — não reconstruir; apenas passada de qualidade dataviz no modal. O entregável novo é o **histograma da distribuição de tempos por KPI**, com endpoint novo no backend. |
| Renderização | **SVG à mão** (como o grafo de ciclicidade), guiado pela skill `dataviz`. **Sem biblioteca de gráficos** — stack travada do CLAUDE.md mantida. |
| Onde mora | **No card, sempre visível**, abaixo do valor principal. A página cresce — as seções + chips sticky da frente anterior foram desenhados para isso. |
| KPI-07B | Ganha histograma também, no bloco da submétrica dentro do card do KPI-07. É o **caso-âncora** (mediana ~0 escondendo 4º NORTE a ~6,3h). |
| Tendência temporal | **Fora de escopo** (docs: "quando fizer sentido"; sem pedido concreto — YAGNI). |
| `AreaSection.vue` | **Não extrair.** A recomendação da review anterior valia "quando os gráficos crescerem a seção"; o gráfico mora no card, a seção não cresce, o gatilho não dispara. |

## 2. Backend — `GET /api/v1/kpis/distribuicoes`

- **Reusa os `.sql` existentes** de `backend/src/pija/sql/kpis/` (já são produtores de linhas
  `(dimensao, valor)`; quem agrega é o provider). **Nenhum `.sql` existente muda**; o novo provider
  envelopa os mesmos arquivos com a agregação de bucketização.
- Mesmos filtros de sempre (`grupo`, `unidade`, `especialidade` multivalor, `data_inicio/fim`) via
  `pija.sql_filtros.build_filtros`, espelhando o `tempos-medios`. Cadeia obrigatória:
  `.sql → Provider → Controller → Router → Schema` + teste (SPEC.md §3-4).
- **Bucketização:** baldes **lineares de 0 a p95** + **um balde final de cauda `≥ p95`**. Racional:
  a cauda é o objeto de interesse, e sem o cap um outlier esmagaria os demais baldes. Número de
  baldes: constante do provider (~16; ajuste fino é decisão de plano/implementação).
- **Uma requisição para todos os códigos** (KPI-01, 03, 05, 06, 07, 07B), como o `tempos-medios`.
- Resposta por KPI:

```jsonc
{
  "distribuicoes": [
    {
      "codigo": "KPI-07B",
      "unidade_tempo": "horas",
      "p50": 0.0, "p95": 6.3, "n_total": 125000,
      "buckets": [ { "de": 0.0, "ate": 0.39, "n": 98000 }, /* …, último = cauda ≥ p95 */ ]
    }
  ]
}
```

- KPI sem dados no recorte → entra com `n_total: 0` e `buckets: []` (o front esconde o gráfico).

## 3. Frontend

### 3.1 `HistogramaTempos.vue` (novo, `components/kpis/`)

- SVG à mão, compacto (altura ~64–80px), barras verticais; **linha vertical marcando a mediana**
  (didático — conecta com a página de metodologia: "metade dos casos até aqui"); último balde (cauda)
  com estilo distinto e rótulo `≥ p95`. Tooltip nativo (`<title>`) por balde com faixa + contagem.
- Tema claro/escuro pelos tokens existentes; skill `dataviz` obrigatória na implementação
  (paleta/acessibilidade/formas).
- Props: a distribuição do KPI + `unidade_tempo`. Sem fetch próprio — componente burro.

### 3.2 Dados — `useKpiStore`

- Segunda chamada `getDistribuicoes(filtros)` **paralela** ao `fetchKpis` atual, no mesmo watcher de
  filtros. Estado separado (`distribuicoes`, `loadingDist`): **a falha ou lentidão da distribuição
  não derruba nem atrasa os cards** — o histograma é enhancement: skeleton no espaço enquanto carrega,
  some silenciosamente (sem ErrorState) se falhar.

### 3.3 Integração no card

- `KpiCard` renderiza o histograma entre o valor principal e o breakdown; no bloco da submétrica
  (KPI-07B), versão menor no mesmo lugar lógico.
- `KpiDetailModal`: passada de qualidade nas barras existentes — **escala comum** entre as barras
  (relativa ao máximo da lista filtrada) e rótulo de valor alinhado. Sem mudança funcional.

## 4. Testes

| Alvo | Casos |
|---|---|
| Provider (pytest) | bucketização correta (contagens somam n_total; limites 0→p95; cauda agrega o resto); respeita filtros; KPI sem dados → `n_total: 0`; p50/p95 batem com o cálculo direto |
| `HistogramaTempos` (vitest) | N barras renderizadas; linha da mediana presente e posicionada; balde de cauda com estilo distinto; `buckets: []` → não renderiza |
| `useKpiStore` | distribuições não bloqueiam os KPIs; falha da distribuição não seta `error` global |
| `KpiCard` | com distribuição → histograma; sem → card íntegro como hoje |
| Browser (backend real) | 2 temas; card completo; KPI-07B com histograma na submétrica; filtro atualiza os gráficos |

## 5. Fora de escopo (registrado)

- Biblioteca de gráficos; tendência temporal; gráficos na Ciclicidade/Gargalos; mudanças nos `.sql`
  existentes; extração de `AreaSection.vue`; colapsar/expandir o histograma.

## 6. Riscos

- **Custo da query** (KPI-05 varre ~980k linhas): a agregação roda no SQLite e devolve ~16 números —
  mesma ordem de custo do `tempos-medios`. Se lento, o desacoplamento do §3.2 já protege a UX;
  otimização (índice/materialização) fica para a discussão de performance existente no backlog.
- **SQLite sem `PERCENTILE_CONT`:** p50/p95 via janela (`ROW_NUMBER`/`COUNT` — padrão já usado no
  `kpis_provider` para a mediana). Detalhe de plano.
