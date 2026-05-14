# 05 – Interfaces

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Interfaces com Sistemas Externos

### 1.1 Interface com o AGHU (Sistema Legado)

| Atributo | Descrição |
|---|---|
| **Tipo de integração** | Banco de dados relacional – acesso read-only via views SQL |
| **Protocolo** | Conexão JDBC/ODBC ou driver nativo (PostgreSQL / Oracle – validar com HC) |
| **Modo de acesso** | Leitura apenas (SELECT nas views `vw_*`) |
| **Frequência** | Batch diário (extração noturna, janela: 01h00–05h00) |
| **Autenticação** | Usuário de serviço dedicado com permissão restrita às views (`GRANT SELECT`) |
| **Segurança** | Conexão em rede interna do HC-UFPE; sem exposição externa |
| **Fallback** | Em caso de falha na extração, o repositório analítico mantém os dados do dia anterior; o log registra o erro e o administrador é notificado |

**Views consumidas:**
```
vw_prontuarios_criados
vw_consultas
vw_exames
vw_internacoes
vw_cirurgias
vw_procedimentos
vw_altas
```

### 1.2 Interface com a LEC (Sistema Satélite)

> ⚠️ **A validar com o HC:** disponibilidade dos dados da LEC no próprio AGHU ou em sistema satélite separado.

| Atributo | Descrição |
|---|---|
| **Tipo** | A definir: pode ser view adicional no AGHU ou integração separada |
| **Campos esperados** | Timestamps de inserção na LEC, movimentação e entrada no mapa cirúrgico |
| **Dependência** | Campos `data_hora_insercao_lec_*` em `vw_cirurgias` |

---

## 2. Interface de Usuário (UI)

### 2.1 Perfis de Acesso

| Perfil | Acesso | Restrições |
|---|---|---|
| **Profissional Assistencial** | Timeline de pacientes de sua unidade; filtros por evento/período | Não acessa KPIs gerenciais de outras unidades |
| **Gestor de Unidade** | Todos os painéis e KPIs de sua unidade | Não acessa dados de outras unidades |
| **Gestor Hospitalar / Diretoria** | Visão consolidada de todas as unidades e especialidades | — |
| **Administrador do Sistema** | Configurações, logs de auditoria, gestão de usuários | — |

### 2.2 Telas Principais (MVP)

#### Tela 1 – Dashboard Inicial
- Seleção de unidade, especialidade e período
- Resumo de KPIs do período (volume de eventos, tempos médios, taxa de realização)
- Alertas de gargalos identificados

#### Tela 2 – Linha do Tempo do Paciente
- Campo de busca por `paciente_id`
- Timeline cronológica com cards por evento (tipo, data/hora, unidade, status)
- Filtro por tipo de evento
- Agrupamento visual por área (ambulatório / diagnóstico / internação / cirurgia)

#### Tela 3 – Painel de KPIs
- Filtros: unidade, especialidade, período
- Cards com KPIs numéricos e tendência (vs. período anterior)
- Gráfico de evolução temporal dos KPIs selecionados

#### Tela 4 – Análise de Gargalos
- Ranking de etapas por tempo médio de espera
- Segmentação por tipo de evento, unidade e especialidade
- Drill-down para detalhe dos eventos que compõem o gargalo

#### Tela 5 – Fluxos Predominantes
- Visualização sankey/fluxo das sequências de eventos mais frequentes
- Filtro por período e especialidade

#### Tela 6 – Prontuários Inertes
- Volume e percentual de prontuários sem evento subsequente
- Distribuição por período e unidade criadora

---

## 3. Especificações de Comunicação (API Analítica)

A API analítica interna é consumida apenas pelo frontend da PIJA. Não há exposição pública de API.

### Padrão de endpoints (REST)

```
GET /api/v1/jornada/{paciente_id}
  → Retorna: lista de eventos cronológicos do paciente

GET /api/v1/eventos
  → Parâmetros: unidade, especialidade, tipo_evento, data_inicio, data_fim
  → Retorna: lista de eventos com campos de timestamp e situação

GET /api/v1/kpis
  → Parâmetros: unidade, especialidade, data_inicio, data_fim, kpi_codes[]
  → Retorna: objeto com valores dos KPIs solicitados

GET /api/v1/gargalos
  → Parâmetros: unidade, especialidade, data_inicio, data_fim
  → Retorna: ranking de etapas por tempo médio de espera

GET /api/v1/fluxos
  → Parâmetros: especialidade, data_inicio, data_fim
  → Retorna: sequências de eventos com volume e proporção

GET /api/v1/prontuarios/inertes
  → Parâmetros: unidade, data_inicio, data_fim
  → Retorna: volume e lista de prontuários sem evento subsequente
```

### Formato de resposta padrão

```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "total": 123,
    "periodo": { "inicio": "2025-01-01", "fim": "2025-03-31" },
    "dt_carga": "2025-04-01T02:00:00"
  }
}
```

---

## 4. Conformidade com LGPD

- A API nunca retorna nome, CPF, endereço ou dados pessoais diretos do paciente
- O `paciente_id` (nº de prontuário) é o único identificador exposto
- Todos os endpoints exigem autenticação (token JWT ou integração LDAP/AD)
- O log de auditoria registra: usuário, endpoint acessado, parâmetros utilizados e timestamp
