# Backlog — duplicação dos filtros nos controllers e da fixture `client` nos testes

> **Data:** 2026-08-03 · **Status:** registrado, não agendado
> **Origem:** review de qualidade da Task 2 do plano
> [2026-08-03-indicadores-graficos.md](2026-08-03-indicadores-graficos.md). Não bloqueia aquela
> entrega — os dois itens são padrões pré-existentes do repo que a Task 2 apenas estendeu.

## 1. Construção de `Filtros` duplicada em 5 controllers

`kpis_controller.get_kpis`, `kpis_controller.get_distribuicoes`, `ciclicidade_controller`,
`eventos_controller` e `gargalos_controller` repetem ~15 linhas idênticas: as declarações
`Query()` de `unidade`/`especialidade`/`grupo`/`data_inicio`/`data_fim` e a montagem do `Filtros`.

**Por que não corrigimos junto com a Task 2:** o FastAPI exige que cada endpoint declare seus
próprios `Query()` para o OpenAPI renderizar os parâmetros — uma função compartilhada ingênua não
resolve. A saída real é uma dependência injetada (`FiltrosQuery` com `Depends()`), que o FastAPI
ainda expõe no OpenAPI. Consertar só o `kpis_controller.py` deixaria os outros 3 inconsistentes,
o que é pior que a duplicação uniforme de hoje.

**Escopo quando for feito:** os 5 controllers de uma vez, com a suíte existente como rede.

## 2. Fixture `client` duplicada em 5 arquivos de teste

`test_kpis_distribuicoes.py`, `test_kpis_multiselect.py`, `test_gargalos_multiselect.py`,
`test_ciclicidade.py` e `test_integration_f2.py` carregam cópias quase idênticas da fixture do
client HTTP async (`app.state.session_factory = async_sessionmaker(...)` + `AsyncClient` sobre
`ASGITransport`). A única parte que é mesmo por-arquivo é receber `fixture_db_session` como
parâmetro para forçar a população do banco antes do uso; o corpo é copy-paste.

**Escopo quando for feito:** subir a fixture para `backend/tests/conftest.py` e remover as 5 cópias.

## 3. Requisições obsoletas não são canceladas (só descartadas)

Achado na review da Task 4. O `useKpiStore.fetchDistribuicoes` protege contra resposta atrasada com
um guarda de sequência: a resposta de um filtro antigo é descartada em vez de sobrescrever a mais
recente. Correto para a UI, mas **a requisição em si não é cancelada** — duas mudanças de filtro
seguidas custam duas varreduras completas no backend, e só uma é usada. O mesmo vale para os outros
stores da família.

**Escopo quando for feito:** `AbortController` nos fetches que reagem a filtro, na família de stores
inteira. Só vale a pena se a churn de filtros crescer ou se a varredura ficar cara com o dado real
do HC — hoje é custo aceitável.

## 4. Submétrica sem dados é reportada como "acima da meta"

Achado durante a verificação no browser da Task 7 (2026-08-05), mas **pré-existente** — vem do commit
`3c4a40e` (redesenho do card de KPI), bem antes desta branch.

Com um filtro que zera o KPI-07B, a submétrica renderiza "sem dados" e, ao lado, "meta: 4h · acima da
meta" em laranja: `subMeetsTarget` devolve `false` quando `media_global` é `null`, então **ausência de
dado vira meta perdida**. Ver `frontend/src/components/kpis/KpiCard.vue` (cálculo do
`subMeetsTarget` e o bloco que renderiza o rótulo da meta).

**Escopo quando for feito:** distinguir os três estados (dentro / acima / sem dado) em vez de dois, e
conferir se o card principal tem o mesmo problema. Não corrigido junto com os indicadores gráficos
por ser defeito de outra entrega — corrigir aqui misturaria as duas na mesma branch.
