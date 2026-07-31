# Spec — Dashboard por áreas da jornada (navegação por áreas)

> **Data:** 2026-07-30 · **Status:** aprovada pelo usuário (brainstorm nesta data)
> **Origem:** feedback do Demo Day ([2026-07-06-feedback-apresentacao.md](../plans/2026-07-06-feedback-apresentacao.md) §4)
> e handoff pós-reunião HC ([2026-07-24-handoff-pos-reuniao-hc.md](../plans/2026-07-24-handoff-pos-reuniao-hc.md) §4.2):
> organizar a ferramenta pela ótica do usuário assistencial — as **áreas da jornada do paciente** — em vez de KPIs soltos.

---

## 1. Decisões (travadas no brainstorm de 2026-07-30)

| Tema | Decisão |
|---|---|
| Modelo estrutural | **Áreas dentro do Dashboard.** A sidebar continua por ferramenta (Dashboard · Gargalos · Jornada · Ciclicidade · Metodologia). Nenhuma rota nova. |
| Layout | **Seções na página + chips de atalho** com scroll-spy. Uma página rolável, uma seção por área. Mantém o panorama (valor do dashboard) e cada seção comporta crescer quando a frente "indicadores gráficos" chegar. |
| Cirurgias (sem KPI no MVP) | **Estado vazio honesto**, frontend-only. Os KPIs da área (cirurgias/partos, cancelamentos — KPI-02/04/08/09 do [02-requisitos.md](../../../02-requisitos.md) + "Fase 5 — indicadores operacionais" do [HANDOFF.md](../../HANDOFF.md)) são **outra implementação**, fora desta frente. |
| Escopo | **Dashboard + cross-links**: seções linkam para `/gargalos?kpi=…` pré-selecionado. Sidebar/BottomNav intactas. Zero backend. |
| Ordem das áreas | **Entrada · Consultas · Exames · Internação · Cirurgias** — segue a ordem canônica da jornada (`ORDEM` do grafo: consulta antes de exame), não a ordem de citação do doc de feedback. Coerência entre telas > ordem de citação. |
| KPI-06 | Mora em **Internação** (a âncora do indicador é a internação, não a consulta). |

## 2. O que NÃO muda

- Sidebar, BottomNav, rotas, títulos de página.
- `FilterBar` no Dashboard — filtros continuam **globais**, valendo para todas as áreas de uma vez.
- Endpoint `/api/v1/kpis` e `useKpiStore` — uma busca só; o agrupamento é apresentação.
- `KpiCard` (inclusive a submétrica KPI-07B dentro do card do KPI-07).
- Nenhum arquivo de backend.

## 3. Componentes e dados

### 3.1 `frontend/src/lib/areas.ts` (novo) — fonte única das áreas

```ts
export interface AreaJornada {
  id: string            // 'entrada' | 'consultas' | 'exames' | 'internacao' | 'cirurgias'
  label: string         // 'Entrada', 'Consultas', …
  icon: string          // nome no Icon.vue (prontuario, consulta, exame, internacao, cirurgia)
  descricao: string     // 1 linha, ótica assistencial
  kpis: KpiCode[]       // KPIs exibidos na seção, em ordem
  gargalosKpi?: KpiCode // KPI usado no cross-link p/ /gargalos (ausente = sem link)
}
export const AREAS_JORNADA: AreaJornada[] = [
  { id: 'entrada',    label: 'Entrada',    icon: 'prontuario', kpis: ['KPI-01'],
    descricao: 'Do prontuário ao primeiro contato assistencial' },
  { id: 'consultas',  label: 'Consultas',  icon: 'consulta',   kpis: ['KPI-03'], gargalosKpi: 'KPI-03',
    descricao: 'Agendamento e realização de consultas' },
  { id: 'exames',     label: 'Exames',     icon: 'exame',      kpis: ['KPI-05'], gargalosKpi: 'KPI-05',
    descricao: 'Solicitação e realização de exames' },
  { id: 'internacao', label: 'Internação', icon: 'internacao', kpis: ['KPI-06', 'KPI-07'], gargalosKpi: 'KPI-07',
    descricao: 'Da chegada ao leito até a saída' },
  { id: 'cirurgias',  label: 'Cirurgias',  icon: 'cirurgia',   kpis: [],
    descricao: 'Procedimentos cirúrgicos — indicadores em desenvolvimento' },
]
```

(Descrições acima são o copy final; ajustes de redação na implementação não precisam de replan.)

Invariantes (testadas): todo `KpiCode` exibível no dashboard (exceto `KPI-07B`, que é submétrica)
aparece em **exatamente uma** área; `cirurgias` tem `kpis: []`; todo `gargalosKpi` pertence às
`METRIC_OPTIONS` do GargaloList.

### 3.2 `KpiGrid.vue` — de grid único para seções

- Continua dono de skeleton/erro/vazio **globais** (uma busca).
- No sucesso, renderiza `AREAS_JORNADA` na ordem: cabeçalho de seção (ícone em tile + label +
  descrição + cross-link à direita quando houver `gargalosKpi`) e grid dos `KpiCard`s da área
  (mesmo estilo de grid atual).
- Cada seção tem `id="area-<id>"` (âncora do scroll) e `data-area="<id>"` (testes/scroll-spy).
- Área com `kpis: []` (Cirurgias) renderiza card de estado vazio: título "Sem indicadores nesta
  área ainda", descrição apontando o roadmap (indicadores operacionais). Reusa `EmptyState`/`BaseCard`.
- KPI presente no `AREAS_JORNADA` mas ausente na resposta da API: a seção mostra os que vieram
  (comportamento atual de lista é preservado por card).

### 3.3 Chips de atalho + scroll-spy (no `DashboardView` ou componente `AreaNav.vue`)

- Linha horizontal de chips (uma por área, ícone + label) entre o `FilterBar` e as seções;
  em mobile, rolagem horizontal (`overflow-x-auto`).
- Clique → `document.getElementById('area-<id>').scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- Scroll-spy: `IntersectionObserver` sobre as seções marca o chip ativo (estilo análogo ao
  `active-class` da sidebar: `bg-primary/10 text-primary`). Guard para ambiente sem
  `IntersectionObserver` (jsdom): feature-detect e degrada sem spy.
- A linha de chips é **sticky** (`sticky top-0 z-20` com fundo `surface`/`surface-dark`) — a página
  fica longa e os atalhos precisam estar sempre à mão.

### 3.4 Cross-link Gargalos (`?kpi=`)

- Link das seções: `RouterLink :to="{ path: '/gargalos', query: { kpi: area.gargalosKpi } }"`,
  rotulado "Ver gargalos →".
- `useGargaloStore`: nova ação `setMetricas(codes: KpiCode[])` (validação: não aceita lista vazia).
- `GargaloList.vue`: no `onMounted`, lê `useRoute().query.kpi`; se for um dos `METRIC_OPTIONS`,
  chama `setMetricas([kpi])` **antes** do `fetchGargalos()`. Valor inválido/ausente → ignora
  (comportamento atual). O usuário segue livre para alternar métricas depois.

## 4. Testes

| Alvo | Casos |
|---|---|
| `areas.ts` (unit) | cada KPI em exatamente uma área; ordem canônica; `cirurgias` vazio; `gargalosKpi ∈ METRIC_OPTIONS` |
| `KpiGrid` (component) | renderiza 5 seções na ordem; cards certos por seção; Cirurgias mostra estado vazio; cross-link presente só onde há `gargalosKpi` |
| `GargaloList` (component) | `?kpi=KPI-05` pré-seleciona só KPI-05; `?kpi=INVALIDO` mantém default; sem query mantém default |
| Browser (backend real, 2 temas) | chips rolam até a seção e destacam no scroll; filtros globais atualizam todas as seções; "Ver gargalos" abre a tela com a métrica certa |

`IntersectionObserver` não existe no jsdom → scroll-spy é verificação de browser, não de unit
(o guard de feature-detect é testável).

## 5. Riscos e mitigação

- **Página mais longa** (5 seções para 6 cards): mitigado pelos chips + sticky; as seções são o
  chassi onde a frente "indicadores gráficos" (§3 do feedback) vai crescer — é intencional.
- **Confusão de vocabulário**: "Grupo" (filtro por executor: Análises Clínicas, UDI…) ≠ "área da
  jornada" (etapa do paciente). A UI não usa a palavra "grupo" nos cabeçalhos de seção.
- **Deep-link × estado do store de gargalos**: `setMetricas` substitui a seleção — comportamento
  esperado de um deep-link; sem persistência extra.

## 6. Fora de escopo (registrado)

- KPIs novos (cirurgia, cancelamentos, operacionais) — implementação própria futura.
- Gráficos por indicador (frente §3 do feedback) — vai morar dentro destas seções.
- Reordenar/re-rotular sidebar; links de Ciclicidade por área (não recortável por área hoje).
- Contagem de eventos na área Cirurgias (exigiria endpoint novo).
