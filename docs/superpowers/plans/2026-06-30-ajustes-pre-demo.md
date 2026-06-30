# Ajustes pré-demo (01/07/2026) — decisões e plano

> **Data:** 2026-06-30 · **Contexto:** Fase 4 já está no ar ponta-a-ponta (front Vercel + backend Railway + dados reais). Estas são as decisões levantadas pelo usuário para executar **antes da apresentação de 01/07/2026**. Cada item traz a decisão, minha recomendação técnica e notas de implementação.

---

## 1. Não inflar KPIs — média geométrica? → **recomendo MEDIANA (p50)**

**Ideia do usuário:** trocar a média aritmética por **média geométrica** para reduzir a inflação dos KPIs.

**Faz sentido?** Em parte. A geométrica de fato reduz o peso de outliers altos (é `exp(média(ln x))`), boa para distribuições de espera enviesadas à direita. **Mas:**
- Exige **todos os valores > 0** — eventos no mesmo dia (duração 0) quebram o `ln(0) = -∞`. Precisaria de epsilon/clamp.
- É **difícil de explicar** ao HC ("média geométrica de dias" não é intuitivo).
- **Não conserta o KPI-01.** A inflação do KPI-01 (635 dias) não é outlier, é **definição/janela** (prontuário 2015-2026 vs eventos só no recorte). Geométrica abaixaria o número mas **mascararia** o problema conceitual.

**Recomendação:** usar **mediana (p50)** em vez de geométrica para KPI-03/05/06/07:
- Robusta a outliers, sem exigência de positividade.
- Trivial de explicar: *"metade dos casos espera menos que X"*.
- Opcional: mostrar **p50 + p90** (típico + cauda) — conta uma história melhor que uma média só.
- Para o **KPI-01**, o fix correto é a **âncora** (ver item abaixo), não a agregação.

**Implementação:** hoje os SQLs fazem `SUM(delta)/COUNT`. Mediana no SQLite não tem função nativa — dá pra fazer com `ORDER BY` + `LIMIT/OFFSET` por bucket ou `PERCENTILE` via window/subquery. É mais SQL que o `SUM/COUNT` atual, e muda o cálculo do `media_global` e do `breakdown`. Esforço médio. Decidir se entra antes do demo ou fica como melhoria.

**Bônus — KPI-01 (âncora):** considerar restringir a **pacientes cujo prontuário foi aberto dentro da janela de dados** (ex.: `dt_prontuario >= 2024-01-01`), para medir tempo real até o 1º atendimento e não o "1º evento presente no recorte".

---

## 2. Tirar os INATIVOS da analítica → **concordo**

**Decisão:** excluir unidades com sufixo `- INATIVO` também dos **rankings/breakdowns** (hoje já estão fora do dropdown de filtro, mas ainda aparecem na analítica — ex.: `UTI RESPIRATORIA - INATIVO` lidera o KPI-07).

**Por quê:** unidade inativa não é um gargalo acionável; mostrar como #1 confunde. Deixa o filtro e a analítica consistentes.

**Implementação:** adicionar `AND unidade NOT LIKE '%INATIVO%'` (mesma regra do `dimensoes.sql`) aos SQLs de KPI (01/03/05/06/07/07b) e de gargalos. Idealmente centralizar a regra para não repetir. Esforço baixo. Requer redeploy do backend (`railway up --no-gitignore`).

---

## 3. Especialidades de enfermaria → prefixar `ENFERMARIA - xxxxx`

**Ideia do usuário:** as ~21 "especialidades" que são na verdade nome de andar (`11º NORTE`, `4º SUL`, com número e "direção" Norte/Sul) recebem um prefixo deixando claro que são enfermaria.

**Contexto:** o AGHU preencheu o campo `especialidade` com o nome da enfermaria em ~197k linhas (majoritariamente EXAME). É problema de origem; o prefixo é um band-aid de clareza no display.

**Implementação:** normalizar no **ETL** (preferível — consistente em filtro, KPI, gargalos e jornada) ou no display. Regra: se `especialidade` casa o padrão de enfermaria (`%NORTE%`/`%SUL%`/começa com dígito), reescrever para `ENFERMARIA - <valor>`. Esforço baixo-médio; se for no ETL, exige regerar o `pija.db`/`pija_demo.db` e redeploy. Decidir ETL vs display.

> ⚠️ Se for via ETL, regerar o banco: rodar o ETL → `scratchpad/db_slim.py` → `railway up --no-gitignore`.

---

## 4. Filtro em cascata: unidade executora → especialidade dependente → **concordo**

**Ideia do usuário:** ao escolher a **unidade executora**, o dropdown de **especialidade** passa a mostrar só as especialidades **daquela unidade** (subsequente/dependente).

**Por quê:** ótimo para usabilidade — corta a lista de **705 especialidades** para as poucas relevantes ao recorte. Boa UX.

**Implementação:**
- Backend: `GET /api/v1/dimensoes` aceita `?unidade=<x>` opcional e devolve `especialidades` escopadas (e talvez `grupos`). Quando sem `unidade`, comportamento atual (tudo).
- Front: `useDimensoesStore` re-busca especialidades quando `filter.unidade` muda (watcher). Limpar a especialidade selecionada se não existir no novo escopo.
- Custo: 1 query extra por troca de unidade (a query de distinct leva ~3-4s sem índice; com filtro de unidade é bem mais rápida). Esforço médio.

---

## 5. paciente_id de exemplo para testar a Jornada em produção → **prontos**

**Verificado em produção** (`/api/v1/eventos?paciente_id=…`): os pacientes abaixo têm **jornada completa (7 tipos: prontuário → consulta → exame → cirurgia → internação → procedimento → alta)** — ótimos para demonstrar a timeline:

| paciente_id | eventos | tipos |
|---|---|---|
| **21331343** | 9 | 7 (jornada completa) — **sugerido p/ demo** |
| 21529797 | 8 | 7 |
| 13961980 | 8 | 7 |
| 19961200 | 8 | 7 |
| 21937115 | 8 | 7 |

**Pendência:** validar a tela **Jornada** em produção com um desses IDs (busca por prontuário → timeline com intervalos). O backend já suporta o filtro `paciente_id`; falta o smoke visual da tela.

---

## Ordem sugerida para amanhã (rápido → impactante)

1. **Tirar INATIVOS da analítica** (item 2) — baixo esforço, SQL + redeploy.
2. **paciente_id de exemplo** (item 5) — só validar a tela; IDs já prontos acima.
3. **Filtro em cascata** (item 4) — UX grande, esforço médio.
4. **Mediana nos KPIs** (item 1) — decidir se entra; muda SQL de agregação.
5. **Prefixo ENFERMARIA** (item 3) — se for via ETL, regerar banco (mais demorado).

> Todo redeploy de backend = `railway up --no-gitignore` desta máquina. Se mexer no banco, regerar `pija_demo.db` antes (`scratchpad/db_slim.py`).
