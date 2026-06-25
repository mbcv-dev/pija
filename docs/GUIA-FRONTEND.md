# Guia do Front-end — PIJA

> Para o dev que vai construir as telas. Linguagem direta, sem firula técnica.
> O **contrato dos endpoints abaixo está fechado e aprovado** — pode começar a desenhar as telas com base nele, mesmo antes do backend estar 100% no ar.

---

## 1. O que é o PIJA, em uma frase

Uma plataforma que lê dados do hospital (HC-UFPE) e responde perguntas sobre a **jornada do paciente**: quanto tempo as coisas demoram (consultas, exames, internações) e onde estão os **gargalos**. Não é um sistema operacional do hospital — é um painel analítico, só de leitura.

A interface do MVP gira em torno de **3 telas/seções**, uma por endpoint (detalhe na seção 5).

---

## 2. Como conversar com o backend

- O backend é uma **API REST** que devolve **JSON**.
- Toda chamada começa com o prefixo **`/api/v1`**.
- Em desenvolvimento, o backend roda local em **`http://127.0.0.1:8000`**.
  - Ex.: `http://127.0.0.1:8000/api/v1/eventos`
- **Documentação interativa automática:** com o backend rodando, abra **`http://127.0.0.1:8000/docs`** no navegador. Lá dá pra ver todos os endpoints, os parâmetros e **testar as chamadas clicando** (Swagger UI). É a fonte da verdade sempre atualizada.

### Sobre login / autenticação
No MVP (Fase 2) **não tem login ainda** — as chamadas são abertas. O login (usuário/senha + token) entra na Fase 3. Quando entrar, o time avisa e você só precisará adicionar um cabeçalho de autorização nas requisições; **o formato das respostas não muda**. Pode construir as telas agora sem se preocupar com isso.

### Regra de comunicação HTTP (combinada no projeto)
Toda chamada HTTP deve passar por um único arquivo central de serviço (ex.: `src/services/api.ts` com Axios). Nada de `fetch` espalhado pelos componentes. Isso facilita plugar o token de login depois num lugar só.

---

## 3. Os 3 endpoints

### 3.1 `GET /api/v1/eventos` — lista de eventos da jornada

Lista crua de eventos (consultas, exames, internações etc.), com filtros e paginação. Bom para uma tela de "explorar / tabela".

**Filtros (todos opcionais, vão na URL como `?chave=valor`):**

| Parâmetro | O que faz | Exemplo |
|---|---|---|
| `tipo_entidade` | filtra por tipo de evento | `CONSULTA`, `EXAME`, `INTERNACAO`, `PRONTUARIO`, `CIRURGIA`, `PROCEDIMENTO`, `ALTA` |
| `unidade` | filtra por unidade do hospital | `unidade=AMBULATORIO X` |
| `especialidade` | filtra por especialidade | `especialidade=CARDIOLOGIA` |
| `data_inicio` | só eventos a partir dessa data | `data_inicio=2026-03-01` |
| `data_fim` | só eventos até essa data | `data_fim=2026-05-31` |
| `limit` | quantos por página (1 a 500, padrão 50) | `limit=20` |
| `offset` | quantos pular (paginação, padrão 0) | `offset=40` |

**Exemplo de resposta:**
```json
{
  "items": [
    {
      "evento_id": "C-12345",
      "paciente_id": "987654",
      "tipo_entidade": "CONSULTA",
      "entidade_id": "12345",
      "timestamp_principal": "2026-03-01T10:00:00",
      "unidade": "AMBULATORIO X",
      "especialidade": "CARDIOLOGIA",
      "tipo_evento": "Consulta de retorno",
      "situacao": "PACIENTE ATENDIDO"
    }
  ],
  "total": 167578,
  "limit": 50,
  "offset": 0
}
```
- `total` = total de eventos que batem com os filtros (use para mostrar "página X de Y").
- `items` = a página atual.
- Paginação: para a próxima página, some `limit` ao `offset`.

---

### 3.2 `GET /api/v1/kpis/tempos-medios` — os indicadores de tempo

Devolve os **5 KPIs de tempo médio** do MVP. Cada KPI vem com um **número geral** (`media_global`) e uma **quebra por dimensão** (`breakdown`) — ótimo para um card com um número grande + um mini-gráfico de barras embaixo.

**Os 5 KPIs:**

| Código | O que mede |
|---|---|
| `KPI-01` | tempo do cadastro do prontuário até o 1º atendimento |
| `KPI-03` | tempo do agendamento até a realização da **consulta** |
| `KPI-05` | tempo da solicitação até a realização do **exame** |
| `KPI-06` | tempo da última consulta até a internação seguinte |
| `KPI-07` | tempo de permanência na internação |

**Parâmetros (opcionais):**

| Parâmetro | O que faz |
|---|---|
| `group_by` | dimensão do breakdown: `unidade` (padrão) ou `especialidade` |
| `kpi_codes` | escolher só alguns KPIs (repita o parâmetro). Ex.: `?kpi_codes=KPI-03&kpi_codes=KPI-05` |
| `unidade`, `especialidade`, `data_inicio`, `data_fim` | mesmos filtros do `/eventos` |

**Exemplo de resposta:**
```json
{
  "kpis": [
    {
      "codigo": "KPI-03",
      "descricao": "Tempo médio agendamento → realização (consulta)",
      "unidade_tempo": "dias",
      "media_global": 12.4,
      "n_global": 130000,
      "breakdown": [
        { "dimensao": "AMBULATORIO X", "media": 15.1, "n": 4200 },
        { "dimensao": "AMBULATORIO Y", "media": 9.8,  "n": 3100 }
      ]
    }
  ]
}
```
- `media_global` está em **dias** (`unidade_tempo` confirma). Pode ser número quebrado (ex.: `12.4` dias).
- `n_global` e `n` = quantos casos entraram na conta (útil para mostrar "baseado em N atendimentos" e dar confiança ao número).
- `breakdown` já vem **ordenado do maior tempo para o menor**.
- Se um KPI não tiver dados no recorte, vem `media_global: null` e `n_global: 0` — **trate o `null`** mostrando algo como "sem dados".

---

### 3.3 `GET /api/v1/gargalos` — ranking dos piores tempos

Um **ranking** que cruza dimensão × tipo de transição e mostra os **piores tempos médios** no topo. É a tela de "onde está o gargalo".

**Parâmetros (opcionais):**

| Parâmetro | O que faz |
|---|---|
| `group_by` | `unidade` (padrão) ou `especialidade` |
| `limit` | quantos itens no ranking (padrão 10) |
| `kpi_codes` | quais transições considerar (padrão: KPI-03, 05, 06, 07) |
| `unidade`, `especialidade`, `data_inicio`, `data_fim` | mesmos filtros |

**Exemplo de resposta:**
```json
{
  "items": [
    { "dimensao_tipo": "unidade", "dimensao": "AMBULATORIO X", "transicao": "KPI-05", "media": 30.2, "n": 1200 },
    { "dimensao_tipo": "unidade", "dimensao": "AMBULATORIO Z", "transicao": "KPI-03", "media": 22.7, "n": 800 }
  ]
}
```
- Já vem **ordenado do pior (maior tempo) para o melhor**. É só renderizar em ordem.
- `transicao` diz qual etapa é o gargalo (mesmos códigos dos KPIs).
- `media` em dias.

---

## 4. Coisas importantes pra não tropeçar

1. **Sem dados pessoais.** A API **não** devolve nome, CPF, idade, sexo nem endereço — só `paciente_id` (que é o número do prontuário). Não desenhe telas que mostrem nome de paciente; não existe.

2. **Tempos são em dias** (número, pode ser quebrado). Se quiser mostrar "12 dias e meio", a conversão é no front.

3. **Exames só cobrem jan–mai/2026 (KPI-05).** Os dados de exame que o hospital entregou são só de ~5 meses de 2026. O KPI-05 funciona, mas a janela é curta. **Coloque um aviso/tooltip** no card do KPI-05 tipo *"dados de exames limitados a jan–mai/2026"*.

4. **Internação: o tempo é "permanência no leito" (KPI-07)**, não "tempo até alta médica" — há uma sutileza clínica (relevante em obstetrícia). Vale uma nota de rodapé discreta no card.

5. **Consultas futuras existem nos dados** (agendamentos ainda não realizados). Os KPIs já ignoram isso automaticamente, mas se você listar `/eventos` sem filtro de data, vai ver eventos com datas em 2027 — é esperado.

6. **Sempre trate `null` e listas vazias.** KPI sem dados → `media_global: null`. Lista sem resultados → `items: []`. Não quebre a tela nesses casos.

---

## 5. Sugestão de telas (ponto de partida, não obrigatório)

| Tela | Endpoint que alimenta | Ideia visual |
|---|---|---|
| **Visão geral / Dashboard** | `/kpis/tempos-medios` | 5 cards, um por KPI: número grande (`media_global`) + mini-barras do `breakdown` |
| **Gargalos** | `/gargalos` | lista/ranking horizontal, pior no topo, cor por intensidade |
| **Explorar eventos** | `/eventos` | tabela com filtros (tipo, unidade, especialidade, datas) + paginação |
| Filtros globais | (todos) | uma barra de filtros (unidade, especialidade, período) que vale para as 3 telas — todos os endpoints aceitam os mesmos filtros |

> O `group_by` (unidade ou especialidade) é um ótimo candidato a um **toggle** no topo do dashboard, que re-busca os KPIs e os gargalos com a outra dimensão.

---

## 6. Quando o backend estiver no ar

1. Peça pro time avisar quando os endpoints forem commitados/subidos (estão em construção — o contrato acima é o combinado).
2. Suba o backend local e abra **`http://127.0.0.1:8000/docs`** — teste cada endpoint clicando, veja as respostas reais.
3. Comece pelo `/kpis/tempos-medios` (dashboard) — é o coração do MVP.

Dúvidas de contrato (campos, formatos): o documento oficial é
[docs/superpowers/specs/2026-06-12-fase-2-endpoints-design.md](superpowers/specs/2026-06-12-fase-2-endpoints-design.md).
