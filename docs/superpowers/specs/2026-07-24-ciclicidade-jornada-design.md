# Design — Ciclicidade da jornada (fluxo agregado + individual)

> **Data:** 2026-07-24 · **Status:** aprovado (brainstorming) · **Apresentação-alvo:** ~07/08/2026
> **Origem:** handoff pós-reunião HC ([2026-07-24-handoff-pos-reuniao-hc.md](../plans/2026-07-24-handoff-pos-reuniao-hc.md) §4.1) —
> "prioridade máxima / maior diferencial".

---

## 1. Objetivo

Mostrar a **ciclicidade** da jornada assistencial em dois escopos, sobre a `fato_eventos_jornada` existente:

- **(a) Agregado (estrela):** o fluxo da população toda entre etapas — por onde os pacientes andam, incluindo
  **retornos e ciclos** (reinternação, retorno ambulatorial, nova consulta/exame).
- **(b) Individual:** a jornada de um paciente com os retornos dele destacados, evoluindo a tela Jornada atual.

**Insight central a comunicar:** o fluxo geral serve de base e os **retornos/ciclos** são realçados por cima
(não é uma jornada linear — o paciente volta).

---

## 2. Decisões do brainstorming (contrato)

| Tema | Decisão |
|---|---|
| Escopos | Os dois; **agregado lidera** a demo, individual complementa |
| Insight | Fluxo geral (base) **+** retornos/ciclos realçados |
| Nós (etapas) | Os **7 `tipo_entidade`**: PRONTUARIO, CONSULTA, PROCEDIMENTO, EXAME, INTERNACAO, CIRURGIA, ALTA. Agrupar em 5 áreas fica pra fase posterior |
| Definição de transição | Para cada paciente, ordenar eventos por tempo e ligar **evento → próximo evento** |
| Auto-laços | **Contam** (CONSULTA→CONSULTA vira auto-laço) — são "retorno dentro da mesma etapa" |
| Semântica do filtro | **Coorte de pacientes**: o filtro seleciona *quais* pacientes; mostra-se a jornada **completa** deles |
| Métrica da aresta | **Volume** (primário) **+ tempo médio** da transição (secundário, no tooltip/detalhe) |
| Visualização | **A + C**: grafo de transições SVG (estrela) **e** matriz origem×destino (rede de segurança), mesmo endpoint |

---

## 3. Arquitetura & fluxo de dados

```
FilterBar (coorte) ─┐
                    ▼
GET /api/v1/ciclicidade/transicoes?<filtros>[&paciente_id=...]
                    │  (.sql → Provider → Controller → Router → Schema)
                    ▼
CiclicidadeResponse { nos[], transicoes[] }
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 TransitionGraph.vue     TransitionMatrix.vue
 (SVG, 7 nós fixos)      (grade origem×destino)
```

Um **único endpoint** serve os dois escopos:
- **Agregado:** sem `paciente_id` → coorte = todos os pacientes que batem nos filtros.
- **Individual:** com `paciente_id` → coorte = aquele único paciente (alimenta o mini-grafo da Jornada).

O backend entrega **nós e arestas já agregados**; o front apenas desenha.

---

## 4. Backend

Segue o fluxo obrigatório `.sql → Provider → Controller → Router → Schema` + testes (guardrails SPEC §3-4).

### 4.1 SQL — `backend/src/pija/sql/ciclicidade/transicoes.sql`

Uma passada, com window function (SQLite ≥ 3.25 — disponível no runtime atual):

1. **CTE `coorte`** — `SELECT DISTINCT paciente_id` da `fato_eventos_jornada` aplicando `sql_filtros.build_filtros`
   (Grupo/Unidade/Especialidade/período). Se `paciente_id` foi passado, a coorte é só ele. `deleted_at IS NULL`.
2. **CTE `ordenados`** — eventos dos pacientes da coorte com:
   - `LAG(tipo_entidade) OVER (PARTITION BY paciente_id ORDER BY timestamp_principal, evento_id)` = `origem`
   - `LAG(timestamp_principal) OVER (mesma janela)` = `ts_origem`
   - `tipo_entidade` = `destino`, `timestamp_principal` = `ts_destino`
   - Desempate por `evento_id` no `ORDER BY` garante ordem **determinística** em timestamps iguais.
3. **Agregação** — `WHERE origem IS NOT NULL GROUP BY origem, destino`:
   - `volume = COUNT(*)`
   - `tempo_medio_s = AVG((julianday(ts_destino) - julianday(ts_origem)) * 86400)` (segundos; `NULL` se algum ts inválido)
   - `n = COUNT(*)` (tamanho da amostra do tempo)

**Nós:** derivados no provider a partir das transições (soma de volumes de entrada/saída por tipo) — evita 2ª query.

**Índice:** coberto por `(paciente_id, timestamp_principal)` (migration 002). Sem novo índice no MVP; reavaliar se lento.

### 4.2 Provider — `CiclicidadeProvider`

`backend/src/pija/providers/ciclicidade_provider.py`. Recebe `session`, `Filtros` e `paciente_id: str | None`.
Roda a query, monta `list[TransicaoItem]`, deriva `list[NoItem]`, devolve `CiclicidadeResponse`.

### 4.3 Schema — `backend/src/pija/schemas/ciclicidade_schema.py` (Pydantic v2)

```python
class TransicaoItem(BaseModel):
    origem: str            # tipo_entidade de origem
    destino: str           # tipo_entidade de destino (== origem em auto-laço)
    volume: int            # nº de transições origem→destino na coorte
    tempo_medio_s: float | None  # gap médio em segundos (None se indeterminável)
    n: int                 # amostra usada no tempo_medio_s

class NoItem(BaseModel):
    tipo: str              # um dos 7 tipo_entidade
    total_entradas: int
    total_saidas: int

class CiclicidadeResponse(BaseModel):
    nos: list[NoItem]
    transicoes: list[TransicaoItem]
```

### 4.4 Controller + Router

- `ciclicidade_controller.py` — orquestra `Depends()` (session + Filtros), chama o provider.
- `routers/ciclicidade_router.py` — `GET /api/v1/ciclicidade/transicoes`, params: filtros comuns (reusa o parsing
  de Eventos/Gargalos) + `paciente_id: str | None`. Registrar em `main.py`.

---

## 5. Frontend

Vue 3 + TS; toda HTTP via `src/services/api.ts`. Viz construída seguindo a skill **`dataviz`** (paleta, contraste,
dark/light, acessibilidade).

### 5.1 Componentes
- **`TransitionGraph.vue`** — SVG puro, 7 nós em layout **fixo** (heptágono/arco). Props: `nos`, `transicoes`, `escopo`.
  Arestas curvas com espessura ∝ volume; **auto-laços** como arco no próprio nó; tooltip com volume + tempo médio.
  Reaproveitado nos escopos agregado e individual.
- **`TransitionMatrix.vue`** — grade origem×destino, cor da célula ∝ volume, tooltip com tempo. Mesmo `CiclicidadeResponse`.
- **`useCiclicidadeStore`** (Pinia) + método `getCiclicidade(filtros, pacienteId?)` em `api.ts`.

### 5.2 View & navegação
- **`CiclicidadeView.vue`** — `FilterBar` existente (coorte ao vivo) + `SegmentedControl` **Grafo ⇄ Matriz** (já existe)
  + a viz. Estados `loading`/`error`/`empty` no padrão das outras telas.
- Entrada no `AppSidebar` + `BottomNav` + rota no router.

### 5.3 Jornada individual
- `JornadaView.vue` ganha o `TransitionGraph` em `escopo="paciente"`, alimentado pelo endpoint com `paciente_id`.
  A timeline atual permanece intacta; o mini-grafo entra como card.
- **Guarda:** se o paciente tem < 2 transições, esconde o mini-grafo (evita grafo vazio/poluído) e mostra só a timeline.

---

## 6. Testes (TDD — guardrail do projeto)

**Backend** (`test_ciclicidade_provider.py`, `test_ciclicidade.py`):
- Transição simples A→B conta 1.
- Auto-laço A→A (evento repetido) conta como transição origem=destino.
- Ordenação determinística com timestamps iguais (desempate por `evento_id`).
- Coorte por filtro: paciente fora do filtro não entra; paciente na coorte contribui com **todas** as transições dele.
- `paciente_id` único → só as transições daquele paciente.
- `tempo_medio_s` correto (gap conhecido em segundos) e `None` quando indeterminável.
- `deleted_at` respeitado (soft delete não conta).

**Frontend:** render de `TransitionGraph` e `TransitionMatrix` com fixture pequeno; store resolve/erro.

---

## 7. Faseamento (de-riscado para 07/08)

1. **Backend completo** (SQL + provider + controller + router + schema + testes) — fundação garantida.
2. **`TransitionMatrix` + `CiclicidadeView` + navegação** — entregável mínimo funcional no ar.
3. **`TransitionGraph`** (a estrela) por cima, reusando tudo.
4. **Mini-grafo** na Jornada individual.
5. *(Se sobrar)* agrupamento dos 7 tipos em 5 áreas; realce extra de retornos na timeline.

---

## 8. Fora de escopo (YAGNI agora)

- Agrupamento dos 7 tipos em 5 áreas (Entrada/Exames/Consultas/Internação/Cirurgias) — fase posterior (§4.2 do handoff).
- Animações, exportar imagem, comparação de coortes lado a lado.
- Novos índices no banco (só se a query se mostrar lenta no DB real).

---

## 9. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Grafo SVG atrasar | Matriz (C) já entrega o valor no passo 2; grafo é incremento |
| Query lenta na coorte grande | Índice `(paciente_id, timestamp_principal)` já existe; medir; considerar índice só se preciso |
| `julianday` sobre ts inválido | `tempo_medio_s = None` degrada suave; volume não depende do tempo |
| Grafo poluído com 7 nós + auto-laços | Layout fixo + espessura por volume; matriz como leitura alternativa |
