# Handoff — 2026-06-12 (após F0+F1 completas)

> **Para nova sessão Claude Code:** este é o resumo curado do estado do projeto após a entrega das Fases 0 e 1 do MVP. Leia este arquivo primeiro, depois siga os ponteiros para `CLAUDE.md`, `SPEC.md` e `docs/DADOS-ESTADO.md`.

---

## TL;DR

**F0 (Scaffold) + F1 (ETL CSV → SQLite) entregues.** Backend Python bootável; 2.261.659 eventos carregados em `backend/data/pija.db` a partir dos 685 MB de CSVs reais do HC; 45 testes verdes; rerun idempotente.

**Próximo passo:** F2 — 3 endpoints analíticos (`/eventos`, `/kpis/tempos-medios`, `/gargalos`).

---

## Estado do repositório

- **Branch:** `main`
- **HEAD:** `86abf0d` ("Document Task 18 final volumes and F2 KPI implications")
- **Origin:** synced (https://github.com/mbcv-dev/pija.git)
- **31 commits adicionados** desde `a120cc8` (CLAUDE.md inicial). Histórico em `git log --oneline a120cc8..HEAD`.

---

## Para começar a próxima sessão

### 1. Skills obrigatórias antes de agir

A próxima sessão começa com:

```
1. superpowers:using-superpowers      (skill loader — automático no init)
2. superpowers:brainstorming          (se for desenhar a F2 antes de codar)
3. superpowers:writing-plans          (para gerar docs/plans/2026-XX-XX-fase-2-*.md)
4. superpowers:subagent-driven-development  (execução)
```

### 2. Ler nesta ordem antes de qualquer ação

| # | Arquivo | Por quê |
|---|---|---|
| 1 | [CLAUDE.md](../CLAUDE.md) | Convenções do projeto + stack travada + "tudo em MD" |
| 2 | Este arquivo | Estado atual e contratos estabelecidos |
| 3 | [SPEC.md](../SPEC.md) §3-4 | Guardrails inegociáveis (fluxo `.sql→Resources→Providers→Controllers→Routers`, no PII, no hard deletes) |
| 4 | [docs/DADOS-ESTADO.md](DADOS-ESTADO.md) §4 + §9 | Mapeamento real CSV → fato_eventos_jornada + volumes pós-carga + achados que afetam F2 |
| 5 | [docs/PLANO.md](PLANO.md) §5 (F2) | Lista de tasks T2-1..T2-5 (RF001, RF002 subset, RF003) |

### 3. Atualizar `CLAUDE.md` antes de iniciar F2

A seção "Estado atual do desenvolvimento" em `CLAUDE.md` ainda diz "ainda não temos código". Atualize com:
- F0+F1 entregues (31 commits, último HEAD `86abf0d`)
- 45 testes verdes em `backend/`
- ETL completo carrega 2.26M eventos em ~10 min
- Próximo: F2 (endpoints)

---

## Comandos úteis (Windows + Git Bash)

```bash
# Ativar venv (de qualquer task subsequente)
source backend/venv/Scripts/activate

# JWT_SECRET é OBRIGATÓRIO em qualquer comando que instancie Settings()
export JWT_SECRET="any-string-with-at-least-32-characters-yes"

# Rodar testes (full suite hoje: 45 testes)
cd backend && pytest -v

# Aplicar migrations (rode do REPO ROOT, não de backend/)
alembic -c backend/alembic.ini upgrade head

# ETL completo (10 min, 685 MB → 2.26M eventos)
python -m pija.etl.runner

# ETL com sample para dev
python -m pija.etl.runner --sample 1000 --view vw_pacientes --verbose

# Subir FastAPI dev server
uvicorn pija.main:app --reload --app-dir backend/src
```

⚠️ **CWD importante:** todos os comandos rodam do **repo root**, não de `backend/`. Os defaults de `Settings.sqlite_path = "./backend/data/pija.db"` e `csv_dir = "./CSV-aghu"` assumem isso.

---

## Contratos estabelecidos que F2+ DEVE honrar

### Modelo de dados

- Tabela analítica: `fato_eventos_jornada` (ver `backend/src/pija/models/fato.py`)
- Tabela telemetria: `etl_log`
- Soft delete via `deleted_at` — partial index `ix_fato_active` filtra `WHERE deleted_at IS NULL`
- Composite index `ix_fato_filtros(tipo_entidade, unidade, especialidade, timestamp_principal)` — desenhado para os filtros do `/eventos`

### Convenção de `evento_id` (prefixos)

| Prefixo | Entidade | Origem |
|---|---|---|
| `P-{prontuario}` | PRONTUARIO | vw_pacientes |
| `C-{num_consulta}` | CONSULTA | vw_consultas com tipo=CONSULTA |
| `PA-{num_consulta}` | PROCEDIMENTO | vw_consultas com tipo=PROCEDIMENTO |
| `E-{exame_id}-{atendimento_id}-{row_idx}` | EXAME | vw_exames |
| `I-{id_internacao}` | INTERNACAO | vw_internacoes |
| `A-{id_internacao}` | ALTA | vw_internacoes (derivada se dthr_fim) |
| `X-{cirurgia_id}` | CIRURGIA | vw_cirurgias |

### Adapter Resource (já implementado)

- `BaseResource` Protocol: `iter_rows(view, *, sample=None)` + `count(view)`
- `CsvResource` (MVP): pandas chunked streaming, file-map padrão
- `AghuResource` (stub Fase 5): levanta `NotImplementedError`
- `get_resource(settings)` em `pija.resources.factory` — usar via `Depends(get_resource)` em F2 endpoints (já tem teste de injeção)

### Auth (F3, ainda não implementada)

- Plano: `users.yml` + PyJWT (interim) com contrato `Depends(get_current_user)` e `Depends(require_role(...))`
- F5 troca a impl por `python-ldap` mantendo o mesmo contrato

---

## Volumes carregados (Task 18 — referência)

```
EXAME         979.847   (range 2026-01 a 2026-05 — só 5 meses!)
PROCEDIMENTO  407.805
PRONTUARIO    354.790
CONSULTA      167.578
INTERNACAO    162.078
ALTA          161.816
CIRURGIA       27.745
─────────────────────
TOTAL       2.261.659  (389.736 pacientes distintos)
```

Range temporal geral: **2015 → 2027** (futuros são consultas agendadas).

---

## Achados que afetam F2 (resumo do DADOS-ESTADO.md §9)

1. **Dedup pesado em consultas (~25%) e cirurgias (~32%)** via upsert
   - vw_consultas: 766k linhas no CSV → 575k distintos no fato
   - vw_cirurgias: 41k linhas → 28k distintos
   - **Decidir antes de KPIs:** mantém upsert (linha mais recente vence) ou agregar?

2. **EXAME cobre só ~5 meses** (jan-mai 2026) apesar de 980k linhas
   - **Bloqueia KPI-05** (solicitação → realização exame) se for limitação real
   - Possibilidades: (a) HC exportou só 2026 de exames, (b) mapper lê coluna errada
   - **Ação:** confirmar com HC antes de calcular KPI-05

3. **23.673 consultas com timestamp futuro** (≥ 2026-07-01)
   - Agendamentos não realizados ainda
   - **KPI-03 (agendamento → realização) DEVE filtrar** `timestamp_realizacao IS NOT NULL`

4. **Alta médica sem timestamp separado**
   - Só temos `dthr_fim` (saída física)
   - KPI-07 mede "tempo de permanência no leito", não "tempo até alta médica"
   - Documentar na UI dos cards
   - Pedir ao HC: incluir `timestamp_alta_medica` em export futuro

5. **Índices para F2 KPIs**
   - `paciente_id` já tem index isolado
   - Composto `ix_fato_filtros(tipo_entidade, unidade, especialidade, timestamp_principal)` cobre `/eventos`
   - Para KPI-01 e KPI-06 (cross-patient temporal): considerar `(paciente_id, timestamp_principal)` se as queries forem lentas. **Medir antes de adicionar.**

---

## Bugs reais detectados na F1 (resolvidos, mas valem precauções em F2)

1. **Closure counter persistente** (`_make_exame_mapper`): cuidado com state em factories que serão re-invocadas. Corrigido em `runner.py:_build_views()` chamado por `run_etl()`.

2. **Heterogeneous-dict upsert** em SQLAlchemy: `sqlite_insert(...).values(batch)` exige chaves uniformes. `_upsert_batch` normaliza para todas as colunas de `FatoEvento`. Se F2 fizer batched inserts em outras tabelas, replicar o padrão.

3. **`Settings()` falha sem JWT_SECRET**: qualquer comando que toque Settings (alembic, etl, uvicorn, pytest) precisa de `JWT_SECRET` no ambiente. Pytest tem default em `conftest.py`. F2 endpoints vão herdar isso.

---

## Pendências para reunião HC futura

(Registradas em [DADOS-ESTADO.md §7](DADOS-ESTADO.md))

1. Timestamp de alta médica separado de `dthr_fim` (afeta análise obstetrícia)
2. Confirmar range temporal real do export de exames (afeta KPI-05)
3. Confirmar semântica do dedup em consultas/cirurgias (mesmo evento atualizado vs duplicatas)
4. Validar consistência total do `prontuario` cross-views em escala (sample passou; full data confirmation)

---

## Sugestão de fluxo para iniciar F2

Quando o usuário pedir "vamos começar F2" ou similar:

1. **Invocar `superpowers:using-superpowers`** (init padrão)
2. **Confirmar com o usuário** se quer:
   - (a) Brainstorming dos 3 endpoints (formato JSON, filtros, paginação) antes de codar
   - (b) Pular brainstorming e ir direto para `superpowers:writing-plans` baseado no que já está em `SPEC.md §5 Fase 2` e em `PLANO.md §5`
3. **Investigar a anomalia EXAME 2026** ANTES de implementar KPI-05 — não vale codar contra dado incompleto
4. **Gerar plano** em `docs/plans/YYYY-MM-DD-fase-2-endpoints.md`
5. **Executar** via `superpowers:subagent-driven-development` (mesmo padrão da F1)

Tasks da F2 (alto nível, do PLANO.md):
- T2-1: `GET /api/v1/eventos` com filtros (RF001/UC001)
- T2-2: `GET /api/v1/kpis/tempos-medios` (5 KPIs: 01, 03, 05, 06-reformulado, 07)
- T2-3: `GET /api/v1/gargalos` ranking (RF003/UC003)
- T2-4: Fixture SQLite com valores conhecidos para validação determinística
- T2-5: Testes contra fixture com tolerância 0%

---

## Resumo dos 5 KPIs do MVP (lembrete)

| KPI | Fórmula | Risco F2 |
|---|---|---|
| KPI-01 | prontuário → 1º evento (cross-entidade) | OK |
| KPI-03 | agendamento → realização (consulta) | filtrar futuros |
| KPI-05 | solicitação → realização (exame) | ⚠️ só 2026 de exames |
| KPI-06 | última consulta → internação subsequente | cross-table cara — testar perf |
| KPI-07 | dthr_fim - dthr_inicio (internação) | OK; documentar limitação obstetrícia |

---

## Arquivos canônicos (não esquecer)

- [CLAUDE.md](../CLAUDE.md) — convenções
- [SPEC.md](../SPEC.md) — contrato SDD
- [docs/PLANO.md](PLANO.md) — fases + skills
- [docs/DADOS-ESTADO.md](DADOS-ESTADO.md) — verdade sobre os dados
- [docs/plans/2026-05-29-fase-0-1-implementation.md](plans/2026-05-29-fase-0-1-implementation.md) — plano executado (referência histórica)
- [01-visao.md](../01-visao.md) → [07-glossario.md](../07-glossario.md) — docs SDD detalhados
- [docs/_archive-hc-template/](_archive-hc-template/) — **NÃO MODIFICAR** (templates HC originais)

---

*Handoff gerado em 2026-06-12 após execução completa de F0+F1 via subagent-driven-development (~3h, 18 tasks, 31 commits).*