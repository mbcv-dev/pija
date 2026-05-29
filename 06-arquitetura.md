# 06 – Arquitetura da Solução

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Visão Macro

A PIJA adota o **Framework Full-Stack para dados hospitalares** definido pela disciplina IESI, baseado na filosofia do **Monólito Moderno**: um servidor único (FastAPI) que expõe a API e serve os arquivos estáticos do frontend simultaneamente, simplificando o deployment.

A camada de origem é abstraída pelo adapter **`Resource`**, com duas implementações trocadas por env `RESOURCE_MODE`:

- **MVP — `CsvResource`**: CSVs exportados pelo HC-UFPE das 7 views
- **Pós-MVP / Fase 5 — `AghuResource`**: Oracle do AGHU via VPN HC-UFPE (`python-oracledb`)

```
┌──────────────────────────────────────────────────────────────┐
│                    FONTES DE DADOS                            │
│                                                               │
│  MVP:    CSVs exportados das 7 views  ->  CsvResource        │
│  Fase 5: AGHU Oracle (read-only views) -> AghuResource       │
│                                                               │
│  Adapter selecionado por env: RESOURCE_MODE=csv|aghu         │
└──────────────────────┬───────────────────────────────────────┘
                       │ Resource.iter_rows(view) — streaming
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              BACKEND – FastAPI (Python 3.10+)                 │
│                                                               │
│  [1] .sql Templates → [2] Resources → [3] Providers          │
│                                              ↓                │
│                        [4] Controllers (regras/KPIs)          │
│                                              ↓                │
│                        [5] Routers (contrato HTTP/Pydantic)   │
│                                                               │
│  SQLite (local) · SQLAlchemy 2.0 Async · Alembic             │
│  Auth: Double Token (JWT + HttpOnly Cookie)                  │
│        MVP:   users.yml + PyJWT (interim)                    │
│        F5:    python-ldap contra AD HC                       │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP (rede interna HC)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│              FRONTEND – Vue 3 + TypeScript                    │
│   Vite · Pinia · Tailwind CSS · Zod + Vee-Validate           │
│   Axios centralizado em src/services/api.ts                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológica

### 2.1 Backend

| Camada | Tecnologia | Função |
|---|---|---|
| Framework Web | **FastAPI** (Python 3.10+) | API REST + serve arquivos estáticos do frontend |
| Validação / Tipagem | **Pydantic v2** | Contratos de entrada/saída (tipagem ponta-a-ponta) |
| Segurança / Auth | **PyJWT + python-ldap** | Double Token + autenticação via Active Directory |
| Persistência local | **SQLAlchemy 2.0 Async + Alembic** | Tabelas internas: `fato_eventos_jornada`, `etl_log`, `audit_log`, `users` |
| Banco local | **SQLite** | Repositório local — **nunca PostgreSQL local** |
| Fonte (MVP) | **`CsvResource`** (pandas + SQLite staging) | Lê CSVs grandes em streaming chunked |
| Fonte (Fase 5) | **`AghuResource`** (`python-oracledb`) | Pool de conexão read-only com Oracle do AGHU via VPN HC |
| Acesso analítico | **SQL nativo** via arquivos `.sql` externos | Mesmas queries rodam em ambos os modos do `Resource` |
| ETL | **pandas** (`read_csv(chunksize=...)`) + SQLite | Streaming-first; upsert batched; modo `--sample N` |

> ⚠️ O ORM (SQLAlchemy) é usado **apenas** para tabelas internas. As consultas analíticas (eventos, KPIs, gargalos) usam SQL nativo em arquivos `.sql`, independentemente do modo do `Resource`.

### 2.2 Frontend

| Tecnologia | Função |
|---|---|
| **Vue 3** | Framework principal de interface |
| **TypeScript** | Tipagem ponta-a-ponta no frontend |
| **Vite** | Build tool e hot reload em desenvolvimento |
| **Pinia** | Gerenciamento de estado reativo e modular |
| **Tailwind CSS** | Estilização utility-first (sem bibliotecas pesadas de componentes) |
| **Zod + Vee-Validate** | Schemas e validação de formulários |
| **Axios** (`src/services/api.ts`) | Toda comunicação com o backend, isolada em serviços |

### 2.3 Autenticação — Double Token (MVP usa interim)

O sistema adota o **Padrão Double Token**. Estratégia de duas etapas:

| Passo | Descrição |
|---|---|
| 1. Login | **MVP:** `users.yml` (3 perfis: `gestor`, `assistencial`, `etl`) com bcrypt. **Fase 5:** Active Directory via `python-ldap`. |
| 2. Access Token | **PyJWT** de vida curta, enviado no Header `Authorization: Bearer ...` |
| 3. Interceptor | Quando o Access Token expira (401), o frontend intercepta silenciosamente e renova usando o Cookie |
| 4. Refresh Token | **Vida longa**, blindado em **HttpOnly Cookie** (proteção contra XSS) |

**Contrato estável**: `get_current_user()` e `require_role(role)` (via `Depends()`) **não mudam entre MVP e Fase 5** — apenas a implementação do `auth.login()` é substituída. Routers, controllers e RBAC permanecem idênticos.

---

## 3. Fluxo Obrigatório de Dados (Origem → Frontend)

Todas as funcionalidades que consomem dados de origem devem seguir este fluxo sem exceção:

```
[1] .sql Templates
    Código SQL nativo puro. Sem lógica Python. Substitui placeholders por parâmetros.
        ↓
[2] Resources (Adapter: CsvResource | AghuResource)
    MVP: leitura de CSVs grandes em streaming via CsvResource.
    F5:  pool de conexão com Oracle do AGHU via AghuResource.
        ↓
[3] Providers
    Execução do SQL (contra SQLite local) e retorno de dicionários brutos.
        ↓
[4] Controllers
    Cérebro do negócio: cálculo de KPIs de tempo médio, gargalos, formatação.
        ↓
[5] Routers
    Contrato HTTP exposto ao frontend. Validação de entrada e saída via Pydantic v2.
```

> O **ETL** carrega os dados de origem para o SQLite local antes das consultas analíticas. Providers e Controllers sempre leem do SQLite, **nunca diretamente** do `Resource`.

---

## 4. Os 4 Pilares de Design Crítico

| Pilar | Descrição |
|---|---|
| **Monorepo** | Frontend e backend no mesmo repositório — facilita deployment em servidores com restrição de recursos |
| **Service-Base Frontend** | Toda comunicação HTTP do frontend isolada em `src/services/api.ts` — componentes Vue não chamam a API diretamente |
| **Dependency Injection** | `Depends()` no FastAPI desacopla autenticação do acesso a dados, permitindo testes isolados |
| **Estética Sem Peso** | Tailwind CSS garante consistência visual sem sobrecarga de bibliotecas de componentes |

---

## 5. Estrutura de Repositório (Monorepo)

```
pija/
├── backend/
│   ├── routers/                  # Endpoints FastAPI (contrato HTTP + Pydantic)
│   │   ├── eventos.py            # GET /api/v1/eventos
│   │   ├── kpis.py               # GET /api/v1/kpis/tempos-medios
│   │   ├── gargalos.py           # GET /api/v1/gargalos
│   │   └── auth.py               # POST /api/v1/auth/{login,refresh}
│   ├── controllers/              # Cálculo de KPIs e regras de negócio
│   │   ├── kpi_controller.py
│   │   └── gargalo_controller.py
│   ├── providers/                # Execução de SQL contra SQLite
│   │   ├── eventos_provider.py
│   │   ├── kpi_provider.py
│   │   └── gargalo_provider.py
│   ├── resources/                # Adapter de origem (MVP=CSV, F5=AGHU)
│   │   ├── base_resource.py      # Protocol iter_rows(view) -> Iterator
│   │   ├── csv_resource.py       # MVP — pandas chunked
│   │   ├── aghu_resource.py      # Fase 5 — python-oracledb (stub no MVP)
│   │   └── resource_factory.py   # DI por RESOURCE_MODE
│   ├── sql/                      # SQL nativo
│   │   ├── extract/              # 1 .sql por entidade (extração para SQLite)
│   │   ├── eventos_filtrados.sql
│   │   ├── kpis/                 # 1 .sql por KPI MVP
│   │   └── gargalos.sql
│   ├── models/                   # SQLAlchemy 2.0 Async — tabelas internas
│   ├── auth/                     # Double Token (MVP: local; F5: LDAP)
│   │   ├── local_auth.py         # MVP — users.yml + bcrypt
│   │   ├── ldap_auth.py          # Fase 5 — python-ldap (stub no MVP)
│   │   ├── jwt_service.py
│   │   └── dependencies.py       # get_current_user, require_role
│   ├── etl/
│   │   └── etl_runner.py         # ETL CSV → SQLite (streaming, idempotente)
│   ├── alembic/                  # Migrations
│   ├── tests/                    # pytest
│   └── main.py                   # Entrypoint FastAPI
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── LoginView.vue
│   │   │   ├── DashboardView.vue
│   │   │   └── GargaloView.vue
│   │   ├── components/
│   │   ├── stores/               # Pinia: useFilterStore, useUserStore, useKpiStore
│   │   ├── services/
│   │   │   └── api.ts            # TODA comunicação HTTP centralizada aqui
│   │   └── schemas/              # Zod schemas
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/
│   ├── PLANO.md                  # Plano de implementação + skills por fase
│   └── _archive-hc-template/     # Templates HC originais (não modificar)
├── .env.example
├── README.md
├── SPEC.md
└── 01..07-*.md                   # Documentação SDD ativa
```

---

## 6. Como Começar (Sequência de Ignição)

```
[1] Pré-requisitos: Python 3.10+ e Node.js 20+

[2] Backend:
    cd backend
    python -m venv venv
    venv\Scripts\activate        (Windows)
    pip install -r requirements.txt
    uvicorn main:app --reload

[3] Frontend:
    cd frontend
    npm install
    npm run dev

[4] Exploração da API:
    http://localhost:8000/docs   →  Swagger UI interativo
```

---

## 7. Guardrails

### ✅ DEVE

- Seguir o fluxo: `.sql → Resources → Providers → Controllers → Routers` sem pular etapas
- Usar **SQL nativo** (arquivos `.sql`) para todas as consultas analíticas
- Usar **SQLAlchemy 2.0 Async** apenas para tabelas internas (`fato_eventos_jornada`, `etl_log`, `audit_log`, `users`)
- Usar **SQLite** como banco local — nunca PostgreSQL local
- Selecionar `Resource` via env `RESOURCE_MODE=csv|aghu`
- **ETL streaming-first** (pandas chunked); proibido carregar CSVs inteiros em memória
- Isolar toda comunicação HTTP do frontend em `src/services/api.ts`
- Validar entrada e saída de todos os endpoints via **Pydantic v2**
- Usar `Depends()` do FastAPI para injeção de dependências (auth, conexão, `Resource`)
- Manter contrato estável `get_current_user()` e `require_role(...)` independente de MVP/Fase 5
- Implementar soft delete em tabelas internas: nunca exclusão física
- Registrar trilha de auditoria imutável para consultas de usuários

### ❌ NÃO DEVE

- Usar ORM (SQLAlchemy) para ler dados de eventos analíticos (apenas via SQL nativo)
- Conectar diretamente em tabelas brutas do AGHU (apenas pelas views, na Fase 5)
- Usar PostgreSQL local (SQLite obrigatório)
- Fazer chamadas HTTP dentro de componentes Vue
- Burlar o Double Token ou o RBAC
- Expor dados pessoais diretos (nome, CPF) — apenas `paciente_id`
- Escrever dados no AGHU (acesso estritamente read-only na Fase 5)
- Carregar CSVs do HC inteiros em memória (proibido `pd.read_csv()` sem `chunksize`)
- Comitar mudanças nos templates HC arquivados em `docs/_archive-hc-template/`

---

## 8. Decisões Pendentes (Validar com HC-UFPE)

| Decisão | Status | Impacto |
|---|---|---|
| Recebimento dos CSVs exportados das 7 views | A confirmar (HC entregará) | Bloqueia testes do ETL com dados reais |
| Tipo de banco do AGHU (assumido Oracle) | A confirmar | Driver `python-oracledb` na Fase 5 |
| Liberação de VPN + acesso read-only ao AGHU | A liberar | Gate da Fase 5 (cutover) |
| Ambiente de deploy no HC | A definir | Configuração do servidor único (FastAPI) |
| Janela de consulta ao AGHU permitida | A definir | Agendamento e frequência do ETL na Fase 5 |
| Campos opcionais disponíveis nas views | A confirmar | KPIs dependentes de timestamps |
| Política LGPD aplicável | A confirmar | Retenção, anonimização, gestão de consentimento |
