# 05 – Interfaces e Integrações

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Interface com os Dados de Origem

A camada de dados de origem usa o adapter **`Resource`** (selecionado por env `RESOURCE_MODE`):

| Modo | Quando | Implementação |
|:---|:---|:---|
| `csv` (default MVP) | **MVP — Fases 0 a 4** | `CsvResource` — lê CSVs exportados das 7 views (pandas chunked, streaming) |
| `aghu` | **Cutover — Fase 5** | `AghuResource` — pool `psycopg`/`asyncpg` contra o **PostgreSQL** do AGHU (schema `agh.*`), numa VM dentro da rede do HC-UFPE |

### 1.1 Modo `csv` (MVP)

| Atributo | Descrição |
|:---|:---|
| **Fonte** | CSVs exportados pelo HC-UFPE das 7 views (entrega manual) |
| **Localização** | Diretório configurável por env `CSV_DIR` (fora do repositório, em `.gitignore`) |
| **Leitura** | `pandas.read_csv(chunksize=50_000)` — streaming; nunca carrega arquivo inteiro em memória |
| **Modo dev** | Flag `--sample N` no `etl_runner` para subset rápido |
| **Validação** | Pydantic v2 por linha; linhas inválidas → soft-fail registrado em `etl_log.rows_rejected` |

### 1.2 Modo `aghu` (Pós-MVP — Fase 5)

| Atributo | Descrição |
|:---|:---|
| **Tipo** | **PostgreSQL** (read-only; tabelas/views no schema `agh.*`) — confirmado com o HC 2026-07-24 |
| **Driver** | `psycopg` (v3) ou `asyncpg` — ver [docs/superpowers/plans/2026-07-24-aghu-integracao-referencia.md](docs/superpowers/plans/2026-07-24-aghu-integracao-referencia.md) |
| **Modo de acesso** | Somente leitura (`SELECT` nas views `vw_*`) |
| **Gerenciamento** | Pool de conexão dentro do `AghuResource` |
| **Autenticação** | Usuário de serviço com `GRANT SELECT` restrito às views |
| **Segurança** | Conexão na rede interna do HC-UFPE via VPN; sem exposição externa |
| **Fallback** | Falha na extração: banco local mantém dados anteriores; log registra erro |

**Views consumidas (mesmas em ambos os modos):**
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

| Método | Endpoint | Descrição | MVP? |
|:---|:---|:---|:---|
| `POST` | `/api/v1/auth/login` | Autenticação (MVP: `users.yml`; Fase 5: AD via LDAP) | ✅ |
| `POST` | `/api/v1/auth/refresh` | Renovação silenciosa do Access Token | ✅ |
| `GET` | `/api/v1/eventos` | Lista de eventos com filtros (RF001 / UC001) | ✅ |
| `GET` | `/api/v1/kpis/tempos-medios` | 5 KPIs de tempo médio entre eventos (RF002 subset) | ✅ |
| `GET` | `/api/v1/gargalos` | Ranking de etapas por tempo médio de espera (RF003) | ✅ |
| `GET` | `/api/v1/jornada/{paciente_id}` | Linha do tempo cronológica de um paciente | ⏸ Pós-MVP |
| `GET` | `/api/v1/fluxos` | Sequências de eventos mais frequentes | ⏸ Pós-MVP |
| `GET` | `/api/v1/prontuarios/inertes` | Prontuários sem eventos assistenciais subsequentes | ⏸ Pós-MVP |

### Parâmetros comuns

| Parâmetro | Tipo | Aplicável em |
|:---|:---|:---|
| `unidade` | string | `/eventos`, `/kpis/tempos-medios`, `/gargalos` |
| `especialidade` | string | `/eventos`, `/kpis/tempos-medios`, `/gargalos` |
| `tipo_entidade` | string (enum) | `/eventos` |
| `data_inicio` | string (YYYY-MM-DD) | Todos os endpoints analíticos |
| `data_fim` | string (YYYY-MM-DD) | Todos os endpoints analíticos |
| `kpi_codes[]` | lista de strings | `/kpis/tempos-medios` |

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

## 4. Telas Principais

| Tela | Componente Vue | Descrição | MVP? |
|:---|:---|:---|:---|
| Login | `views/LoginView.vue` | Formulário Double Token (Vee-Validate + Zod) | ✅ |
| Dashboard | `views/DashboardView.vue` | Filtros globais + 5 cards de KPI de tempo médio | ✅ |
| Gargalos | `views/GargaloView.vue` | Ranking simples por tempo médio de espera | ✅ |
| Painel de KPIs estendido | `views/KpiView.vue` | Cards com gráfico de tendência | ⏸ Pós-MVP |
| Fluxos | `views/FluxoView.vue` | Visualização dos fluxos predominantes | ⏸ Pós-MVP |
| Prontuários Inertes | `views/InertesView.vue` | Volume, percentual e distribuição por unidade | ⏸ Pós-MVP |
| Linha do Tempo | `views/JornadaView.vue` | Timeline cronológica por `paciente_id` | ⏸ Pós-MVP |

---

## 5. Conformidade LGPD

- API nunca retorna nome, CPF, data de nascimento ou dados pessoais diretos
- `paciente_id` (nº de prontuário) é o único identificador exposto
- Todos os endpoints exigem autenticação — sem rotas públicas
- Log de auditoria: usuário, endpoint, parâmetros, timestamp — armazenado em tabela interna do SQLite
- Secrets de conexão (strings de banco, chaves JWT) exclusivamente via `.env` — nunca no código
