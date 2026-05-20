# 06 – Arquitetura da Solução

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Visão Macro

A PIJA adota o **Framework Full-Stack para dados hospitalares** definido pela disciplina IESI, baseado na filosofia do **Monólito Moderno**: um servidor único (FastAPI) que expõe a API e serve os arquivos estáticos do frontend simultaneamente, simplificando o deployment.

```
┌─────────────────────────────────────────────────────────────┐
│                      BANCOS EXTERNOS                         │
│   AGHU (PostgreSQL / Oracle) – Acesso read-only             │
│   Consultas via arquivos .sql nativos (sql_helper.py)        │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL nativo (asyncpg / python-oracledb)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND – FastAPI (Python 3.10+)                │
│                                                              │
│  [1] .sql Templates → [2] Resources → [3] Providers         │
│                                             ↓                │
│                       [4] Controllers (regras/KPIs)          │
│                                             ↓                │
│                       [5] Routers (contrato HTTP/Pydantic)   │
│                                                              │
│  SQLite (local) · SQLAlchemy 2.0 · Alembic                  │
│  Auth: Double Token (JWT + HttpOnly Cookie) via AD/LDAP      │
└────────────────────────────────┬────────────────────────────┘
                                 │ HTTP (rede interna HC)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND – Vue 3 + TypeScript                   │
│   Vite · Pinia · Tailwind CSS · Zod + Vee-Validate          │
│   Axios centralizado em src/services/api.ts                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológica

### 2.1 Backend

| Camada | Tecnologia | Função |
|---|---|---|
| Framework Web | **FastAPI** (Python 3.10+) | API REST + serve arquivos estáticos do frontend |
| Validação / Tipagem | **Pydantic v2** | Contratos de entrada/saída (tipagem ponta-a-ponta) |
| Segurança / Auth | **PyJWT + python-ldap** | Double Token + autenticação via Active Directory |
| Persistência local | **SQLAlchemy 2.0 Async + Alembic** | Tabelas internas: tokens, configs, logs de auditoria |
| Banco local | **SQLite** | Repositório local — **nunca PostgreSQL local** |
| Banco externo (AGHU) | **asyncpg** (PostgreSQL) ou **python-oracledb** (Oracle) | Conexão read-only com o AGHU — a confirmar com HC |
| Acesso ao AGHU | **SQL nativo** via arquivos `.sql` externos | Consultas às views — sem ORM sobre o AGHU |

> ⚠️ O ORM (SQLAlchemy) é usado **apenas** para tabelas internas do framework (tokens, configs). As consultas ao AGHU são feitas exclusivamente via SQL nativo em arquivos `.sql`.

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

### 2.3 Autenticação — já implementada no framework

O sistema de autenticação adota o **Padrão Double Token**, já pronto:

| Passo | Descrição |
|---|---|
| 1. Login | Autenticação corporativa via **Active Directory (LDAP)** |
| 2. Access Token | **JWT de vida curta**, enviado no Header para acesso às rotas |
| 3. Interceptor | Quando o Access Token expira (401), o frontend intercepta silenciosamente e renova usando o Cookie |
| 4. Refresh Token | **Vida longa**, blindado em **HttpOnly Cookie** (proteção contra XSS) |

---

## 3. Fluxo Obrigatório de Dados (AGHU → Frontend)

Todas as funcionalidades que consomem dados do AGHU devem seguir este fluxo sem exceção:

```
[1] .sql Templates
    Código SQL nativo puro. Sem lógica Python. Substitui placeholders por parâmetros.
        ↓
[2] Resources
    Gerenciamento de pools de conexão com o AGHU. Já implementado no framework.
        ↓
[3] Providers
    Execução do SQL e retorno de dicionários brutos (dados sem tratamento).
        ↓
[4] Controllers
    Cérebro do negócio: formatação, cálculo de KPIs, aplicação de regras assistenciais.
        ↓
[5] Routers
    Contrato HTTP exposto ao frontend. Validação de entrada e saída via Pydantic v2.
```

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
│   ├── routers/          # Endpoints FastAPI (contrato HTTP + validação Pydantic)
│   ├── controllers/      # Regras de negócio e cálculo de KPIs da jornada
│   ├── providers/        # Execução SQL e retorno de dicionários brutos
│   ├── resources/        # Pool de conexão com o AGHU (já implementado)
│   ├── sql/              # Arquivos .sql nativos por entidade
│   │   ├── consultas.sql
│   │   ├── exames.sql
│   │   ├── internacoes.sql
│   │   ├── cirurgias.sql
│   │   ├── procedimentos.sql
│   │   ├── altas.sql
│   │   └── prontuarios.sql
│   ├── models/           # SQLAlchemy – tabelas internas (tokens, configs, audit log)
│   ├── auth/             # Double Token, LDAP, PyJWT (já implementado)
│   └── main.py           # Entrypoint FastAPI
├── frontend/
│   ├── src/
│   │   ├── views/        # Páginas Vue (dashboard, timeline, KPIs, gargalos)
│   │   ├── components/   # Componentes reutilizáveis
│   │   ├── stores/       # Pinia – estado global (filtros, usuário, KPIs)
│   │   ├── services/
│   │   │   └── api.ts    # TODA comunicação HTTP centralizada aqui
│   │   └── schemas/      # Zod schemas para validação frontend
│   ├── tailwind.config.js
│   └── vite.config.ts
└── README.md
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
- Usar **SQL nativo** (arquivos `.sql`) para todas as consultas ao AGHU
- Usar **SQLAlchemy** apenas para tabelas internas (tokens, configs, audit log)
- Usar **SQLite** como banco local — nunca PostgreSQL local
- Isolar toda comunicação HTTP do frontend em `src/services/api.ts`
- Validar entrada e saída de todos os endpoints via **Pydantic v2**
- Usar `Depends()` do FastAPI para injeção de dependências
- Implementar soft delete em tabelas internas: nunca exclusão física
- Registrar trilha de auditoria imutável para consultas de usuários

### ❌ NÃO DEVE

- Usar ORM para consultar o AGHU (apenas SQL nativo)
- Conectar diretamente em tabelas brutas do AGHU (apenas pelas views)
- Usar PostgreSQL como banco local (SQLite obrigatório)
- Fazer chamadas HTTP dentro de componentes Vue
- Burlar o Double Token ou o RBAC já implementado
- Expor dados pessoais diretos (nome, CPF) — apenas `paciente_id`
- Escrever dados no AGHU (acesso estritamente read-only)

---

## 8. Decisões Pendentes (Validar com HC-UFPE)

| Decisão | Status | Impacto |
|---|---|---|
| Tipo de banco do AGHU (Oracle ?) | A validar | Driver: asyncpg vs python-oracledb |
| Ambiente de deploy no HC | A validar | Configuração do servidor único (FastAPI) |
| Janela de consulta ao AGHU permitida | A validar | Agendamento e frequência de atualização |
| Campos opcionais disponíveis nas views | A validar | KPIs dependentes de timestamps |
