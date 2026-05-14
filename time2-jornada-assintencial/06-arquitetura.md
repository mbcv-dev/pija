# 06 – Arquitetura da Solução

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Visão Macro

A PIJA é arquitetada em três camadas principais, separando claramente a **integração de dados**, o **processamento analítico** e a **visualização**:

```
┌─────────────────────────────────────────────────────┐
│                     CAMADA DE ORIGEM                 │
│   AGHU (PostgreSQL / Oracle) – Acesso read-only      │
│   vw_prontuarios_criados | vw_consultas | vw_exames  │
│   vw_internacoes | vw_cirurgias | vw_procedimentos   │
│   vw_altas                                           │
└────────────────────┬────────────────────────────────┘
                     │ Extração batch (ETL)
                     ▼
┌─────────────────────────────────────────────────────┐
│               CAMADA ANALÍTICA (PIJA)                │
│  ┌──────────────┐   ┌──────────────────────────┐    │
│  │ Pipeline ETL │   │ Repositório Analítico     │    │
│  │ (batch diário│──►│ fato_eventos_jornada      │    │
│  │  01h00–05h00)│   │ dim_unidade, dim_especi.  │    │
│  └──────────────┘   └──────────┬───────────────┘    │
│                                │                     │
│                    ┌───────────▼───────────┐         │
│                    │  Motor de KPIs e       │         │
│                    │  Reconstrução Jornada  │         │
│                    └───────────┬───────────┘         │
│                                │                     │
│                    ┌───────────▼───────────┐         │
│                    │    API Analítica       │         │
│                    │    (REST / JSON)       │         │
│                    └───────────┬───────────┘         │
└────────────────────────────────┼────────────────────┘
                                 │ HTTP / HTTPS (rede interna)
                                 ▼
┌─────────────────────────────────────────────────────┐
│               CAMADA DE VISUALIZAÇÃO                 │
│   Dashboard Web (Metabase / Superset / React)        │
│   Autenticação LDAP/AD | RBAC por perfil             │
└─────────────────────────────────────────────────────┘
```

---

## 2. Componentes Principais

### 2.1 Pipeline ETL (Extração, Transformação e Carga)

| Atributo | Decisão |
|---|---|
| **Frequência** | Batch diário (01h00–05h00) |
| **Modo** | Incremental: extrai apenas registros novos ou modificados desde a última carga |
| **Transformações** | Padronização de tipos, tratamento de nulos, validação de timestamps, geração de `evento_id`, enriquecimento com dimensões |
| **Tecnologia sugerida** | Apache Airflow (orquestração) + DBT (transformações SQL) ou Python + SQLAlchemy |
| **Log** | Registro de início, fim, volume por view, erros e alertas |
| **Fallback** | Em caso de falha parcial: mantém dados do dia anterior e notifica administrador |

### 2.2 Repositório Analítico

| Atributo | Decisão |
|---|---|
| **Tecnologia sugerida** | PostgreSQL (MVP) ou DuckDB (analytics-first, embedded) |
| **Modelo** | Star schema simplificado: `fato_eventos_jornada` + dimensões (`dim_unidade`, `dim_especialidade`) |
| **Acesso** | Apenas pela API analítica; sem acesso direto por usuários |
| **Retenção** | Dados históricos completos; sem exclusão física (soft delete via campo `situacao`) |

### 2.3 Motor de KPIs e Reconstrução de Jornada

| Atributo | Decisão |
|---|---|
| **Função** | Calcular KPIs sobre `fato_eventos_jornada` conforme regras definidas em `02-requisitos.md` |
| **Implementação** | Views materializadas ou queries SQL pré-calculadas (atualização pós-ETL) |
| **Rastreabilidade** | Cada KPI tem sua regra de cálculo documentada e versionada |

### 2.4 API Analítica

| Atributo | Decisão |
|---|---|
| **Padrão** | REST (JSON) |
| **Autenticação** | JWT (gerado pelo módulo de autenticação LDAP/AD) |
| **Autorização** | RBAC: endpoints filtram automaticamente pelo perfil e unidade do usuário autenticado |
| **Exposição** | Apenas na rede interna do HC-UFPE; sem exposição à internet |

### 2.5 Frontend / Dashboard

| Atributo | Decisão |
|---|---|
| **MVP** | Metabase ou Apache Superset (BI open source, deploy rápido) |
| **Evolução** | Aplicação React customizada com componentes de timeline e filtros dinâmicos |
| **Autenticação** | Integração com LDAP/AD do HC-UFPE |

---

## 3. Guardrails – O que a IA e o Desenvolvimento DEVEM e NÃO DEVEM fazer

### ✅ DEVE

- Seguir rigorosamente o modelo de dados definido em `04-modelo-dados.md`
- Extrair dados do AGHU exclusivamente pelas views definidas (nunca por tabelas brutas)
- Implementar soft delete: registros cancelados/inválidos recebem flag, nunca são excluídos
- Registrar trilha de auditoria imutável para todas as consultas de usuários
- Utilizar RBAC para controle de acesso por perfil
- Documentar e versionar todas as regras de cálculo de KPIs
- Validar schemas de entrada na pipeline ETL antes de carregar no repositório
- Usar `paciente_id` como único identificador de paciente; nunca armazenar dados pessoais diretos

### ❌ NÃO DEVE

- Criar conexões diretas com tabelas brutas do AGHU (somente via views)
- Implementar exclusão física de registros (soft delete obrigatório)
- Burlar o sistema de RBAC para acesso a dados de outras unidades
- Expor a API analítica fora da rede interna do HC-UFPE
- Criar dependências externas não documentadas neste arquivo
- Armazenar nome, CPF, data de nascimento ou qualquer dado pessoal direto do paciente
- Modificar dados no AGHU (acesso estritamente read-only)

---

## 4. Segurança e Conformidade LGPD

| Requisito | Implementação |
|---|---|
| Pseudoanonimização | Uso exclusivo de `paciente_id` (nº de prontuário) |
| Acesso mínimo | Usuário de serviço ETL com `GRANT SELECT` apenas nas views |
| Criptografia em trânsito | TLS/HTTPS em todas as comunicações |
| Auditoria | Log imutável: usuário, endpoint, parâmetros, timestamp |
| RBAC | Perfis: Assistencial, Gestor de Unidade, Gestor Hospitalar, Administrador |
| Retenção de dados | Definir política com o HC-UFPE (ex: dados analíticos retidos por 3 anos) |

---

## 5. Decisões Técnicas Pendentes (Validar com HC-UFPE)

| Decisão | Status | Impacto |
|---|---|---|
| Tipo de banco do AGHU (PostgreSQL ou Oracle) | A validar | Driver ETL, sintaxe SQL |
| Ambiente disponível para deploy do repositório analítico | A validar | Infraestrutura |
| Integração com LDAP/AD do HC | A validar | Autenticação |
| Janela de extração batch (horário e duração aceitável) | A validar | Operação do ETL |
| Política de retenção de dados analíticos | A validar | Armazenamento |
| Dados da LEC: views no AGHU ou sistema separado | A validar | Escopo das cirurgias |
