# Roadmap pós-2ª reunião HC (2026-06-26)

> Registro das decisões da reunião com o HC + plano faseado de execução.
> Fonte: feedback do HC sobre os KPIs e lista de novos indicadores.
> Convenção do projeto: decisões registradas em MD antes de codar.

---

## A. Refinamentos dos 5 KPIs (decisão HC)

| KPI | Definição confirmada | Escopo (tipo de unidade) | Mudança vs hoje |
|---|---|---|---|
| **KPI-01** | Prontuário → **1º Evento Assistencial** (renomear de "1º Atendimento") | Só **ambulatórios** (unidades que realizam o 1º evento assistencial) | Renomear + escopar por grupo Ambulatorial |
| **KPI-03** | Agendamento → realização da consulta | Só **ambulatórios** (que realizam consultas) | Escopar por grupo Ambulatorial |
| **KPI-05** | Solicitação → realização do exame | Só **grupos executores de exame** (Análises Clínicas, Diagnóstico por Imagem, Anatomia Patológica); permitir **filtro por unidade executora** | Escopar por grupos executores + filtro de unidade executora |
| **KPI-06** | Última consulta → internação | Só **unidades de internação** | Escopar por grupo Internação |
| **KPI-07** | **Principal:** entrada → saída efetiva do paciente. **Sub-métrica:** alta médica → saída efetiva (gap, **meta HC: 4h**) | Internação | Adicionar sub-métrica alta→saída; requer capturar a data de alta médica real |

**Observações:**
- O escopo por tipo de unidade usa o `grupo` (mapa em `backend/src/pija/unidades.py`): Ambulatorial, Internação, e os 3 grupos executores de exame.
- **KPI-05 same-day:** na 1ª parte da reunião foi dito que exame regulado sai no mesmo dia (KPI deu ~0). Mantemos a definição que o HC reconfirmou (solicitação→realização), escopada por executor; e avaliamos "tempo até o laudo" (`data_hora_liberacao`) como indicador complementar de diagnóstico (ver seção B.3).

## B. Novos indicadores operacionais (decisão HC)

Estes são majoritariamente **contagens/percentuais** (não médias de tempo). Cada um traz a dependência de dado a verificar.

1. **Regulação Interna**
   - Prontuários criados por dia/período (contagem temporal). → dado: PRONTUARIO.timestamp_principal ✅
2. **Ambulatório**
   - Tempo médio entre consultas (Consulta → Consulta), por paciente. → ✅ (gap entre consultas consecutivas)
   - % de consultas **reguladas / retorno / interconsulta** sobre o total. → ⚠️ depende de campo de **tipo de consulta** (verificar `Condição do Atendimento` / `Retorno` em `vw_consultas`)
3. **Diagnóstico/Exames**
   - Quantidade/% de exames realizados, por **grupo** e por **unidade executora**. → ✅ (depende do `grupo` populado)
   - *(complementar)* Tempo até o laudo: `data_hora_liberacao − solicitação`. → ⚠️ verificar preenchimento de `data_hora_liberacao`
4. **Internação**
   - Nº de internações por **especialidade**. → ✅
   - Nº de internações em **UTI**, por especialidade. → ⚠️ depende de identificar unidades de UTI (via unidade/grupo)
5. **Procedimentos**
   - Nº de cirurgias realizadas, por especialidade. → ✅ (CIRURGIA)
   - Nº de **partos** realizados. → ⚠️ depende de identificar parto (tipo de cirurgia/procedimento ou especialidade obstétrica)

## C. Mudanças de produto (UX / front)

- **KPIs sem número:** mostrar só a **descrição** do que cada KPI mede (esconder o valor por enquanto).
- **Gargalos:** adicionar **filtro por métrica** (escolher qual KPI/transição) e deixar explícito o que está sendo medido.
- **Filtros globais:** `grupo` **e** `unidade executora` (além de especialidade/tipo/período).
- **Tela de Eventos → Jornada:** evoluir de tabela plana para **timeline por paciente** (busca por prontuário → linha do tempo cronológica com os intervalos entre etapas).

## D. Arquitetura de dados (banco intermediário)

Confirmado: o PIJA mantém **seu próprio banco analítico** alimentado em lote do AGHU — nunca consulta o AGHU ao vivo por request.

- **Sync incremental em lote:** job agendado que puxa do AGHU só o delta (marca d'água por timestamp/id).
- **KPIs/gargalos materializados:** o job de carga **pré-calcula** os indicadores em tabelas-resumo; o front lê resumos pequenos → resposta instantânea (resolve os ~12s atuais).
- **Banco de produção:** migrar de SQLite-arquivo para **Postgres gerenciado** (Neon/Supabase) ou **Turso** (libSQL, migração suave), encaixando no adapter `Resource` já existente.

---

## Estado dos dados (achados que gatilham o plano)

- ✅ `unidades.py` já mapeia unidade → grupo (Ambulatorial, Internação, 3 grupos executores de exame, Procedimental). Reutilizável para escopar KPIs.
- ⚠️ **`grupo` está NULL no DB real** (ETL da F1 rodou antes da coluna existir). **Pré-requisito:** popular `grupo` (UPDATE one-time via `UNIDADE_PARA_GRUPO`, ou re-ETL).
- ⚠️ **Alta médica:** o HC confirmou que existem **duas datas** (alta médica e saída efetiva); hoje o ETL usa `dthr_fim` como proxy das duas. Achar a coluna real da alta médica em `vw_internacoes` e ajustar o mapper.
- ⚠️ Verificar campos para: tipo de consulta (regulada/retorno/interconsulta), UTI, parto, preenchimento de `data_hora_liberacao`.

---

## Plano faseado de execução

### Fase 0 — Registro + spike de dados (rápido, desbloqueia o resto)
- [x] Registrar decisões em MD (este documento) + atualizar `DADOS-ESTADO.md`.
- [ ] **Spike de dados** contra os CSVs/DB reais: confirmar existência e preenchimento de — coluna de alta médica (`vw_internacoes`), tipo de consulta (`vw_consultas`), flag/identificação de UTI e parto, `data_hora_liberacao` (exames). Documentar achados em `DADOS-ESTADO.md`.

### Fase 1 — Fundação de dados (ETL / modelo)
- [ ] **Popular `grupo`** no fato (UPDATE via `UNIDADE_PARA_GRUPO`; validar cobertura).
- [ ] **Capturar alta médica real** no mapper de internação (separar de saída efetiva) + re-ETL das internações.
- [ ] Categorização de unidades por tipo (ambulatório / executor de exame / internação / UTI) consolidada a partir do `grupo`.
- [ ] (se os campos existirem) Mapear tipo de consulta e identificação de parto no fato.

### Fase 2 — KPIs refinados + filtros (backend + front)
- [ ] KPI-01 renomear ("1º Evento Assistencial") + escopo ambulatório.
- [ ] KPI-03 escopo ambulatório.
- [ ] KPI-05 escopo executores de exame + filtro por unidade executora.
- [ ] KPI-06 escopo internação.
- [ ] KPI-07 = total (entrada→saída) **+ sub-métrica alta→saída** (meta 4h).
- [ ] Filtros globais `grupo` + `unidade executora` (back + front).
- [ ] Front: KPIs **sem número** (só descrição) + **filtro por métrica** no gargalos.

### Fase 3 — Performance / banco intermediário
- [ ] Materializar KPIs/gargalos em tabelas-resumo no job de carga.
- [ ] Definir banco de produção (Postgres/Turso) + sync incremental (marca d'água).

### Fase 4 — Conectar back ↔ front
- [ ] Hospedar backend (recomendado: Railway — disco persistente).
- [ ] Habilitar CORS no FastAPI para `pija-alpha.vercel.app`.
- [ ] Vercel: `VITE_USE_MOCK=false` + `VITE_API_BASE_URL` → redeploy.

### Fase 5 — Novos indicadores operacionais
- [ ] Implementar os indicadores da seção B (contagens/percentuais) que o spike confirmar viáveis.

### Fase 6 — Tela de Jornada (timeline)
- [ ] Evoluir Eventos para timeline por paciente.

### Fase 7 — Repaginação completa do frontend (skill `frontend-design`)
- [ ] Redesenhar todo o frontend do PIJA com a skill `frontend-design` (+ `baseline-ui`): identidade visual consistente, telas de Dashboard/Gargalos/Jornada polidas e de alto padrão, responsivo, acessível.
- [ ] Absorver os itens de UX desta rodada: KPIs sem número (só descrição), gargalos com filtro de métrica, filtros grupo/unidade executora, timeline de jornada.
- [ ] É **front-only** — pode rodar em **paralelo** à fundação de dados (Fases 1–2 backend), consumindo mocks até a conexão real (Fase 4).
- [ ] Brainstorming de design antes (telas, fluxo, identidade) → implementação.

### Dependências
- Fase 1 (grupo + alta médica) **gateia** Fase 2 (escopo dos KPIs e KPI-07 sub-métrica) e parte da Fase 5.
- Fase 3 (materialização) **gateia** Fase 4 (conexão com performance aceitável).
- Fase 7 (repaginação) é independente do backend — roda em paralelo; só a conexão real (Fase 4) precisa estar pronta para sair dos mocks.

## Decisão de priorização (2026-06-26)
Começar por: **Fase 0 (spike) → Fase 1 (fundação) → Fase 2 (KPIs)**, com a **Fase 7 (repaginação do frontend)** adicionada e podendo correr em paralelo.

---

## Decisão pendente — por onde começar
Após a Fase 0 (que faço já), qual frente priorizar?
- **(A) Fundação + KPIs corretos** (Fase 1→2): entregar os KPIs no escopo/definição que o HC pediu, sobre dados reais. *Recomendado* — é o núcleo de valor.
- **(B) Conexão real com performance** (Fase 3→4): front lendo o backend de verdade, rápido.
- **(C) Polir produto pro próximo show** (front: KPIs sem número, gargalos por métrica, timeline).
