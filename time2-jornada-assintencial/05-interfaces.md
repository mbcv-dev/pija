# 05 – Interfaces e Integrações

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Interface com o AGHU (Sistema Legado)

| Atributo | Descrição |
|:---|:---|
| **Tipo** | Banco de dados relacional — acesso read-only via views SQL |
| **Driver** | `python-oracledb` (Oracle) — a confirmar com HC |
| **Modo de acesso** | Somente leitura (`SELECT` nas views `vw_*`) |
| **Gerenciamento** | Pool de conexão já implementado no framework (`resources/aghu_resource.py`) |
| **Autenticação** | Usuário de serviço com `GRANT SELECT` restrito às views |
| **Segurança** | Conexão na rede interna do HC-UFPE; sem exposição externa |
| **Fallback** | Falha na extração: banco local mantém dados do dia anterior; log registra erro |

**Views consumidas:**
```
vw_prontuarios_criados · vw_consultas · vw_exames
vw_internacoes · vw_cirurgias · vw_procedimentos · vw_altas
```

---

## 2. API Backend — FastAPI

Todos os endpoints seguem o fluxo obrigatório: `Router → Controller → Provider → SQL`.  
Autenticação via Double Token (JWT no Header). RBAC aplicado em cada rota via `Depends()`.

Toda comunicação do frontend com a API é centralizada em `src/services/api.ts`.  
Nenhum componente Vue faz chamadas HTTP diretamente.

### Endpoints (visão geral)

| Método | Endpoint | Descrição |
|:---|:---|:---|
| `GET` | `/api/v1/jornada/{paciente_id}` | Linha do tempo cronológica de um paciente |
| `GET` | `/api/v1/eventos` | Lista de eventos com filtros multidimensionais |
| `GET` | `/api/v1/kpis` | KPIs calculados para o recorte selecionado |
| `GET` | `/api/v1/gargalos` | Ranking de etapas por tempo médio de espera |
| `GET` | `/api/v1/fluxos` | Sequências de eventos mais frequentes |
| `GET` | `/api/v1/prontuarios/inertes` | Prontuários sem eventos assistenciais subsequentes |
| `POST` | `/api/v1/auth/login` | Autenticação via Active Directory |
| `POST` | `/api/v1/auth/refresh` | Renovação silenciosa do Access Token |

### Parâmetros comuns

| Parâmetro | Tipo | Aplicável em |
|:---|:---|:---|
| `unidade` | string | `/eventos`, `/kpis`, `/gargalos`, `/prontuarios/inertes` |
| `especialidade` | string | `/eventos`, `/kpis`, `/gargalos`, `/fluxos` |
| `data_inicio` | string (YYYY-MM-DD) | Todos os endpoints analíticos |
| `data_fim` | string (YYYY-MM-DD) | Todos os endpoints analíticos |
| `kpi_codes[]` | lista de strings | `/kpis` |

### Códigos de resposta padrão

| Status | Situação |
|:---|:---|
| 200 | Sucesso |
| 400 | Parâmetros inválidos |
| 401 | Token inválido ou expirado |
| 403 | Usuário sem permissão para o recurso solicitado |
| 404 | Recurso não encontrado |

> A especificação detalhada dos contratos de cada endpoint (schemas Pydantic, exemplos de request/response) será definida durante o desenvolvimento, conforme o fluxo obrigatório do framework.

---

## 3. Interfaces TypeScript — `src/services/api.ts`

As interfaces abaixo definem os contratos de dados entre o backend e o frontend Vue 3.

```typescript
interface EventoJornada {
  evento_id: string;
  paciente_id: string;
  tipo_entidade: 'PRONTUARIO' | 'CONSULTA' | 'EXAME' | 'INTERNACAO' | 'CIRURGIA' | 'PROCEDIMENTO' | 'ALTA';
  entidade_id: string;
  timestamp_principal: string;
  timestamp_solicitacao?: string | null;
  timestamp_agendamento?: string | null;
  timestamp_realizacao?: string | null;
  unidade?: string | null;
  especialidade?: string | null;
  tipo_evento?: string | null;
  situacao?: string | null;
}

interface JornadaResponse {
  paciente_id: string;
  total_eventos: number;
  eventos: EventoJornada[];
  meta: { dt_carga: string };
}

interface KpiValor {
  valor: number | null;
  unidade: string;
  periodo: { inicio: string; fim: string };
}

interface KpiResponse {
  [codigo: string]: KpiValor;
}

interface GargaloItem {
  etapa: string;
  tipo_evento: string;
  unidade: string;
  especialidade: string;
  tempo_medio_horas: number;
  volume: number;
}

interface FluxoItem {
  sequencia: string;
  volume: number;
  percentual: number;
}

interface ProntuariosInertesResponse {
  volume: number;
  percentual: number;
  distribuicao_por_unidade: Array<{ unidade: string; volume: number }>;
}
```

---

## 4. Telas Principais (MVP)

| Tela | Componente Vue | Descrição |
|:---|:---|:---|
| Dashboard Inicial | `views/DashboardView.vue` | KPIs do período, alertas de gargalos, filtros globais |
| Linha do Tempo | `views/TimelineView.vue` | Busca por `paciente_id`, cards de eventos por área |
| Painel de KPIs | `views/KpiView.vue` | Cards de indicadores com filtros e gráfico de tendência |
| Gargalos | `views/GargaloView.vue` | Ranking com drill-down por etapa |
| Fluxos | `views/FluxoView.vue` | Visualização dos fluxos predominantes |
| Prontuários Inertes | `views/InertesView.vue` | Volume, percentual e distribuição por unidade |

---

## 5. Conformidade LGPD

- API nunca retorna nome, CPF, data de nascimento ou dados pessoais diretos
- `paciente_id` (nº de prontuário) é o único identificador exposto
- Todos os endpoints exigem autenticação — sem rotas públicas
- Log de auditoria: usuário, endpoint, parâmetros, timestamp — armazenado em tabela interna do SQLite
- Secrets de conexão (strings de banco, chaves JWT) exclusivamente via `.env` — nunca no código
