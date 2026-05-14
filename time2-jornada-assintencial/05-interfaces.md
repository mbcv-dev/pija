# 05 – Interfaces e Integrações

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Interface com o AGHU (Sistema Legado)

| Atributo | Descrição |
|:---|:---|
| **Tipo** | Banco de dados relacional — acesso read-only via views SQL |
| **Driver** | `asyncpg` (PostgreSQL) ou `python-oracledb` (Oracle) — a confirmar com HC |
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

### [SCHEMA] Contratos TypeScript — `src/services/api.ts`

Toda comunicação do frontend com a API é centralizada em `src/services/api.ts`.  
Nenhum componente Vue faz chamadas HTTP diretamente.

```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

// Interceptor: injeta Access Token em todas as requisições
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: renova token silenciosamente ao receber 401
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await api.post('/auth/refresh'); // usa HttpOnly Cookie automaticamente
      return api(err.config);
    }
    return Promise.reject(err);
  }
);

export default api;
```

```typescript
// Interfaces de contrato (tipagem ponta-a-ponta)

interface EventoJornada {
  evento_id: string;
  paciente_id: string;
  tipo_entidade: 'PRONTUARIO' | 'CONSULTA' | 'EXAME' | 'INTERNACAO' | 'CIRURGIA' | 'PROCEDIMENTO' | 'ALTA';
  entidade_id: string;
  timestamp_principal: string;       // ISO 8601
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

interface PronutariosInertesResponse {
  volume: number;
  percentual: number;
  distribuicao_por_unidade: Array<{ unidade: string; volume: number }>;
}
```

---

### Endpoints FastAPI

#### `GET /api/v1/jornada/{paciente_id}`
Retorna linha do tempo cronológica de um paciente.

```python
# routers/jornada_router.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1")

class EventoOut(BaseModel):
    evento_id: str
    paciente_id: str
    tipo_entidade: str
    entidade_id: str
    timestamp_principal: str
    timestamp_solicitacao: Optional[str] = None
    timestamp_realizacao: Optional[str] = None
    unidade: Optional[str] = None
    especialidade: Optional[str] = None
    tipo_evento: Optional[str] = None
    situacao: Optional[str] = None

class JornadaResponse(BaseModel):
    paciente_id: str
    total_eventos: int
    eventos: list[EventoOut]

@router.get("/jornada/{paciente_id}", response_model=JornadaResponse)
async def get_jornada(
    paciente_id: str,
    current_user=Depends(get_current_user)
):
    ...
```

**Respostas:**
| Status | Situação |
|:---|:---|
| 200 | Jornada retornada com sucesso |
| 404 | `paciente_id` não encontrado |
| 403 | Usuário sem permissão para a unidade do paciente |
| 401 | Token inválido ou expirado |

---

#### `GET /api/v1/eventos`
Lista eventos com filtros multidimensionais.

```python
class EventosFiltroParams(BaseModel):
    unidade: Optional[str] = None
    especialidade: Optional[str] = None
    tipo_evento: Optional[str] = None
    data_inicio: Optional[str] = None   # formato: YYYY-MM-DD
    data_fim: Optional[str] = None
    situacao: Optional[str] = None
```

**Respostas:** `200` (lista de eventos) · `400` (parâmetros inválidos) · `401` · `403`

---

#### `GET /api/v1/kpis`
Calcula e retorna KPIs para o recorte selecionado.

**Query params:** `unidade`, `especialidade`, `data_inicio`, `data_fim`, `kpi_codes` (lista)

**Exemplo de response:**
```json
{
  "KPI-01": { "valor": 4.2, "unidade": "dias", "periodo": { "inicio": "2025-01-01", "fim": "2025-03-31" } },
  "KPI-04": { "valor": 0.12, "unidade": "proporção", "periodo": { "inicio": "2025-01-01", "fim": "2025-03-31" } }
}
```

**Respostas:** `200` · `400` (kpi_code inválido) · `401` · `403`

---

#### `GET /api/v1/gargalos`
Ranking de etapas por tempo médio de espera.

**Query params:** `unidade`, `especialidade`, `data_inicio`, `data_fim`

**Exemplo de response:**
```json
[
  { "etapa": "solicitacao_realizacao", "tipo_evento": "EXAME", "unidade": "Laboratório", "especialidade": "Clínica Médica", "tempo_medio_horas": 72.4, "volume": 340 },
  { "etapa": "insercao_lec_mapa", "tipo_evento": "CIRURGIA", "unidade": "CC", "especialidade": "Ortopedia", "tempo_medio_horas": 480.0, "volume": 87 }
]
```

---

#### `GET /api/v1/fluxos`
Sequências de eventos mais frequentes.

**Query params:** `especialidade`, `data_inicio`, `data_fim`

**Exemplo de response:**
```json
[
  { "sequencia": "PRONTUARIO→CONSULTA→EXAME→ALTA", "volume": 1240, "percentual": 34.2 },
  { "sequencia": "PRONTUARIO→CONSULTA→INTERNACAO→ALTA", "volume": 870, "percentual": 24.0 }
]
```

---

#### `GET /api/v1/prontuarios/inertes`
Prontuários sem eventos assistenciais subsequentes.

**Query params:** `unidade`, `data_inicio`, `data_fim`

**Respostas:** `200` (objeto com volume, percentual e distribuição) · `401` · `403`

---

#### `POST /api/v1/auth/login`
Autenticação via Active Directory.

```python
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # refresh_token enviado automaticamente via HttpOnly Cookie
```

#### `POST /api/v1/auth/refresh`
Renovação silenciosa do Access Token usando o HttpOnly Cookie.

---

## 3. Telas Principais (MVP)

| Tela | Componente Vue | Descrição |
|:---|:---|:---|
| Dashboard Inicial | `views/DashboardView.vue` | KPIs do período, alertas de gargalos, seleção de filtros globais |
| Linha do Tempo | `views/TimelineView.vue` | Busca por `paciente_id`, cards de eventos agrupados por área |
| Painel de KPIs | `views/KpiView.vue` | Cards de indicadores com filtros e gráfico de tendência |
| Gargalos | `views/GargaloView.vue` | Ranking com drill-down por etapa |
| Fluxos | `views/FluxoView.vue` | Visualização sankey/lista dos fluxos predominantes |
| Prontuários Inertes | `views/InertesView.vue` | Volume, percentual e distribuição por unidade |

---

## 4. Conformidade LGPD

- API nunca retorna nome, CPF, data de nascimento ou dados pessoais diretos
- `paciente_id` (nº de prontuário) é o único identificador exposto
- Todos os endpoints exigem autenticação — sem rotas públicas
- Log de auditoria: usuário, endpoint, parâmetros, timestamp — armazenado em tabela interna do SQLite
- Secrets de conexão (strings de banco, chaves JWT) exclusivamente via `.env` — nunca no código
