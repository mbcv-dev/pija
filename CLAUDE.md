# CLAUDE.md — Contexto para a IA neste repositório

Este arquivo é carregado automaticamente pelo Claude Code. Contém convenções, restrições e ponteiros para a documentação ativa. **Não é o contrato do projeto** — esse é o [SPEC.md](SPEC.md).

---

## Sobre o projeto

**PIJA — Plataforma Integrada da Jornada Assistencial**. Fork do template do HC-UFPE, desenvolvido pelo Time 2 (Perspectiva Assistencial) na disciplina IESI 2026.1 do CIn-UFPE.

Plataforma analítica que consome views do AGHU (sistema hospitalar) para responder perguntas direcionadoras sobre a jornada do paciente. **Não substitui** o AGHU — é camada observacional.

---

## Documentos canônicos — ler antes de agir

| Documento | Quando consultar |
|---|---|
| [SPEC.md](SPEC.md) | Contrato SDD — guardrails, escopo MVP, task breakdown |
| [docs/PLANO.md](docs/PLANO.md) | Plano de implementação por fase + skills Claude Code recomendadas |
| [docs/DADOS-ESTADO.md](docs/DADOS-ESTADO.md) | Estado real dos CSVs, mapeamento CSV → `fato_eventos_jornada`, decisões da reunião com HC |
| [docs/plans/](docs/plans/) | Planos de implementação datados (`YYYY-MM-DD-<tema>.md`) |
| [01-visao.md](01-visao.md) → [07-glossario.md](07-glossario.md) | Documentação SDD detalhada |
| [docs/_archive-hc-template/](docs/_archive-hc-template/) | Templates HC originais — **nunca modificar** |

---

## Convenção principal: tudo em MD

> **Sempre que houver mudança de escopo, decisão arquitetural, novo plano ou correção de premissa, registrar em arquivo Markdown no repositório antes de prosseguir.**

- Decisão de escopo → `SPEC.md` ou `02-requisitos.md`
- Plano de implementação → `docs/plans/YYYY-MM-DD-<tema>.md`
- Achado de exploração de dados → `docs/DADOS-ESTADO.md` ou similar
- Resolução pós-reunião com HC → atualizar o documento afetado **antes** de codar
- Conversas que mudam direção sem mudar arquivo são tratadas como dívida — converter em MD antes do próximo commit

---

## Stack travada (não negociar sem pedir)

### Backend
- Python 3.11+
- FastAPI + Pydantic v2 + Pydantic Settings
- SQLAlchemy 2.0 **Async** + aiosqlite + Alembic
- pandas (apenas para ETL — leitura streaming chunked)
- PyJWT + bcrypt + python-ldap (Fase 5)
- psycopg / asyncpg (Fase 5 apenas — AGHU é **PostgreSQL**, confirmado com o HC 2026-07-24; ver docs/superpowers/plans/2026-07-24-aghu-integracao-referencia.md)
- pytest + pytest-asyncio + httpx

### Frontend (Fase 4 — ainda não iniciada)
- Vue 3 + TypeScript + Vite
- Pinia + Tailwind CSS
- Zod + Vee-Validate
- Axios — toda comunicação HTTP centralizada em `src/services/api.ts`

### Dados
- SQLite local (nunca PostgreSQL local)
- Adapter `Resource` plugável: `CsvResource` (MVP) ↔ `AghuResource` (Fase 5)
- Seleção por env `RESOURCE_MODE=csv|aghu`

---

## Guardrails inegociáveis (resumo do SPEC.md §3-4)

**DEVE:**
- Fluxo obrigatório: `.sql → Resources → Providers → Controllers → Routers`
- SQL nativo para queries analíticas (arquivos `.sql`)
- SQLAlchemy só em tabelas internas (`fato_eventos_jornada`, `etl_log`, `audit_log`, `users`)
- Pydantic v2 para validar entrada/saída de todos os endpoints
- `Depends()` para injeção de dependências
- ETL streaming-first (`pandas.read_csv(chunksize=...)`)
- Soft delete em tabelas internas (`deleted_at` IS NULL = ativo)
- Auditoria imutável de toda consulta de usuário
- Teste `test_*.py` para cada controller e provider

**NÃO DEVE:**
- Hard deletes (`DELETE` SQL físico) em tabelas internas
- Secrets no código — só via `.env`
- Carregar CSV inteiro em memória (sempre streaming chunked)
- Armazenar dados pessoais diretos (nome, CPF, idade, sexo, endereço) — apenas `paciente_id` (= número do prontuário)
- Chamadas HTTP em componentes Vue (sempre `src/services/api.ts`)
- Burlar Double Token / RBAC
- Escrever no AGHU (Fase 5: read-only)
- Modificar arquivos em `docs/_archive-hc-template/`

---

## Estado atual do desenvolvimento

**2026-05-29:** ainda não temos código. Specs consolidadas + plano F0+F1 escrito + dados explorados.

**Próximo:** executar [docs/plans/2026-05-29-fase-0-1-implementation.md](docs/plans/2026-05-29-fase-0-1-implementation.md) — 18 tasks TDD para entregar scaffold backend + ETL CSV → SQLite.

Frontend (Fase 4) só inicia após o usuário definir o desenho das telas.

---

## CSVs do HC

- 5 arquivos em `CSV-aghu/` (685 MB total) — **não versionados** (em `.gitignore`)
- Origem: WhatsApp do Daniel Turmina (HC-UFPE) em 2026-06-02
- Encoding UTF-8, separador `,`, datas BR (`DD/M/YYYY, HH:MM`), IDs com `.` como separador de milhar
- **Mapeamento entidade → CSV** está em [docs/DADOS-ESTADO.md §4](docs/DADOS-ESTADO.md)

7 entidades cobertas por 5 arquivos:
- PRONTUARIO ← `vw_pacientes`
- CONSULTA + PROCEDIMENTO (split por `tipo`) ← `vw_consultas`
- EXAME ← `vw_exames`
- INTERNACAO + ALTA (derivada) ← `vw_internacoes`
- CIRURGIA ← `vw_cirurgias`

---

## KPIs do MVP

**8 códigos** em produção — 5 KPIs validados com o HC na reunião 29-05-2026, mais 3 que vieram
depois. Todos reportam **mediana**, não média (cauda longa; o campo da API ainda se chama
`media_global` por compatibilidade).

1. **KPI-01** prontuário → 1º evento
2. **KPI-03** agendamento → realização (consulta)
3. **KPI-05** solicitação → **liberação** (exame) — mudou de "realização" para "liberação" em 2026-08-05, porque `data_hora_realizacao` é anterior à solicitação em 61% das linhas (ver [docs/DADOS-ESTADO.md §12](docs/DADOS-ESTADO.md))
4. **KPI-06** última consulta → internação subsequente (reformulado)
5. **KPI-07** tempo de permanência no leito (= `dthr_fim - dthr_inicio` — inclui gap pós-alta médica relevante na obstetrícia)
6. **KPI-07B** alta médica → saída do leito — **submétrica** do KPI-07, em horas
7. **KPI-10** duração da cirurgia (início → fim), em horas — só `situacao = 'RZDA'`
8. **KPI-10B** entrada na sala → início da cirurgia — **submétrica** do KPI-10, em horas

**Submétricas** (`07B`, `10B`) não têm card próprio: renderizam dentro do card do KPI pai, via o
mapa `SUBMETRICA_DE` em `KpiGrid.vue`. Por isso não aparecem em `AREAS_JORNADA[].kpis`.

> **Ao adicionar um KPI:** cinco listas de códigos precisam andar juntas — `KPI_META` (backend),
> `KpiCode` e `KPI_META` (`api.types.ts`), `KpiCodeSchema` (`api.schemas.ts`), o array `ordem` do
> `MetodologiaView.vue`, e os `allCodes` dos dois mocks. As três últimas **falham em silêncio**: os
> metadados ficam prontos e a página simplesmente não lista o KPI, sem erro nenhum.

---

## Skills Claude Code relevantes (do usuário)

Sempre invocar a skill antes de qualquer ação se houver chance de aplicar. Skills cross-cutting:

- `superpowers:brainstorming` — antes de qualquer feature/decisão de design
- `superpowers:writing-plans` — antes de codar (plano em `docs/plans/`)
- `superpowers:executing-plans` ou `superpowers:subagent-driven-development` — durante execução
- `superpowers:test-driven-development` — TDD para ETL, KPIs, auth
- `superpowers:verification-before-completion` — antes de marcar task como done
- `superpowers:systematic-debugging` — bugs não-óbvios
- `superpowers:requesting-code-review` — antes de PR
- `commit-commands:commit-push-pr` — final de cada bloco
- `frontend-design:frontend-design` + `baseline-ui` — Fase 4 (telas)

Lista completa por fase: [docs/PLANO.md §9](docs/PLANO.md).

---

## Estilo de commits

- 1 commit = 1 mudança lógica (atomic)
- Mensagem em inglês ou português, imperativa
- Body explica **why**, não só **what**
- Sem `Co-Authored-By` que mencione modelo específico (usar genérico se necessário)
- Pre-commit hook (quando configurado): nunca pular com `--no-verify`

---

## Ambiente

- Windows 11 + Git Bash
- Python 3.11+ via venv em `backend/venv/`
- Node 20+ para frontend (Fase 4)
- Banco local: SQLite em `backend/data/pija.db` (em `.gitignore`)