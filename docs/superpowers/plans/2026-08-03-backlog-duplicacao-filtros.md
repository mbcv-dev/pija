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
