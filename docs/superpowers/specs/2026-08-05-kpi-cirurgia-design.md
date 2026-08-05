# Spec — KPIs de Cirurgia (KPI-10 e KPI-10B)

> **Data:** 2026-08-05 · **Status:** aprovada pelo usuário (brainstorm nesta data)
> **Origem:** feedback direto do usuário em 2026-08-05, item 2: *"vamos implementar KPIs de
> Cirurgia (e outras KPIs mencionadas a ser implementadas em outros planos)"*.
> A área **Cirurgias** existe no dashboard desde
> [2026-07-30-dashboard-areas-jornada-design.md](2026-07-30-dashboard-areas-jornada-design.md)
> com `kpis: []` e um estado vazio honesto — sempre foi um placeholder esperando esta frente.

Esta é a **Frente 3** de três aprovadas em 2026-08-05. As outras:
[endurecimento do backlog](2026-08-05-endurecimento-backlog-design.md) e
[simplificação de breakdown e cores](2026-08-05-simplificacao-breakdown-e-cores-design.md).

**Dependência de ordem:** o item 6 da Frente 1 (parse da distribuição por KPI em vez de
tudo-ou-nada) precisa estar em produção **antes** desta frente. Motivo em §7.

---

## 1. Escopo: Fase A agora, Fase B registrada

O usuário pediu "KPIs de Cirurgia e outras KPIs mencionadas em outros planos". Isso foi
decomposto em duas fases, e **só a Fase A entra nesta spec**:

| Fase | Conteúdo | Por quê separado |
|---|---|---|
| **A (esta spec)** | KPI-10 (tempo de cirurgia) + KPI-10B (espera em sala) | São KPIs **de tempo** — reusam o modelo inteiro que já existe: `.sql` produtor de linhas, mediana, breakdown, histograma, card, submétrica. Custo marginal baixo, valor imediato: preenchem a área vazia. |
| **B (frente futura)** | KPI-02 e KPI-04 (taxas), KPI-09 (proporção), KPI-08 (volume) | São **taxas e contagens**, não tempos. Não têm mediana, não têm distribuição de tempo, não cabem no `KpiCard` atual. Exigem tipo de card novo e decisão de design própria. Acoplá-las aqui atrasaria o resultado visível e misturaria dois problemas. |

Os quatro da Fase B já estão catalogados em [02-requisitos.md](../../../02-requisitos.md) §KPIs como
"⏸ Pós-MVP". Esta spec **não** os implementa e **não** os re-especifica.

## 2. O dado já está lá

O ETL de `vw_cirurgias` (ver [DADOS-ESTADO.md §4.6](../../DADOS-ESTADO.md)) já popula, para
`tipo_entidade = 'CIRURGIA'`:

| Coluna do fato | Origem no CSV | Significado |
|---|---|---|
| `timestamp_agendamento` | `Entrada na Sala` | paciente entra na sala cirúrgica |
| `timestamp_principal` | `data_inicio_cirurgia` | cirurgia começa |
| `timestamp_realizacao` | `data_fim_cirurgia` | cirurgia termina |
| `situacao` | `situacao` | `RZDA` \| `CANC` \| `AGND` … |
| `tipo_evento` | `{Tipo}/{Natureza}` | ex. `CIRURGIA/ELETIVA`, `PDT/URGÊNCIA` |
| `unidade`, `especialidade` | — | dimensões de breakdown e filtro |

**Nenhuma mudança de ETL é necessária.** Os dois KPIs saem de diferenças entre colunas que já
existem — mesma natureza dos `.sql` atuais.

## 3. Investigação bloqueante: a duplicação de ~32%

[DADOS-ESTADO.md §8](../../DADOS-ESTADO.md) registra, como pendência explícita a resolver **antes
de KPIs cirúrgicos**:

> 40.934 linhas carregadas → 27.745 distintos. Hipótese: múltiplos registros por cirurgia
> (entrada/saída sala, anestesia). Decidir antes de KPI cirúrgicos: manter última linha (atual) ou
> agregar.

O upsert atual usa `evento_id = "X-{cirurgia_id}"`, então **a última linha lida vence** e as
anteriores são sobrescritas. Se as múltiplas linhas de uma cirurgia carregam recortes diferentes do
mesmo evento (uma com entrada na sala, outra com início, outra com fim), manter a última pode
significar guardar um registro com timestamps incompletos ou inconsistentes — e os dois KPIs desta
spec dependem justamente desses três timestamps.

**Esta investigação é a primeira tarefa do plano, e é bloqueante.** O que ela precisa responder:

1. As linhas duplicadas de um mesmo `cirurgia_id` diferem em quê? (comparar os campos de timestamp
   e `situacao` entre elas)
2. A linha que sobrevive ao upsert tem os três timestamps preenchidos e coerentes
   (`Entrada na Sala ≤ início ≤ fim`)?
3. Qual a taxa de cirurgias com `situacao = RZDA` em que algum dos três timestamps é nulo ou está
   fora de ordem? Isso dimensiona o `n` real dos KPIs antes de qualquer código de KPI.

**Saída:** o achado vira MD (atualização de `DADOS-ESTADO.md`) **antes** de escrever o `.sql`,
conforme a convenção do repo. Se a conclusão for que "manter a última linha" perde informação, a
correção do ETL entra no escopo desta frente — e o plano precisa prever esse ramo.

## 4. Definição dos indicadores

### KPI-10 — Tempo de cirurgia

- **Medida:** `data_fim_cirurgia − data_inicio_cirurgia`, ou seja
  `timestamp_realizacao − timestamp_principal`.
- **Unidade:** **horas** (como o KPI-07B; cirurgias em dias seriam ilegíveis).
- **Recorte:** `tipo_entidade = 'CIRURGIA'` e `situacao = 'RZDA'` (realizada). Cirurgia cancelada ou
  agendada não tem duração.
- **Guardas** (espelhando os `.sql` existentes): ambos os timestamps não-nulos; fim ≥ início;
  `unidade NOT LIKE '%INATIVO%'`.
- **O que responde:** quanto tempo o centro cirúrgico ocupa por procedimento, e como isso varia
  entre unidades e especialidades.

### KPI-10B — Espera em sala (submétrica do KPI-10)

- **Medida:** `data_inicio_cirurgia − Entrada na Sala`, ou seja
  `timestamp_principal − timestamp_agendamento`.
- **Unidade:** **horas**.
- **Recorte e guardas:** idênticos ao KPI-10.
- **O que responde:** o tempo entre o paciente já estar na sala e a cirurgia efetivamente começar —
  tempo de sala ocupada sem procedimento em curso. É onde ineficiência operacional aparece, e é
  acionável de um jeito que a duração da cirurgia em si não é (a duração depende do procedimento;
  a espera depende da organização).
- **Renderização:** bloco de submétrica dentro do card do KPI-10, exatamente como KPI-07B mora
  dentro do KPI-07. **Sem barra de meta** — não há meta pactuada com o HC para espera em sala, e
  inventar uma seria afirmar mais do que sabemos (ver a
  [Frente 2](2026-08-05-simplificacao-breakdown-e-cores-design.md) §3, mesma disciplina).

### Por que estes dois, e não outros

Considerados e descartados nesta fase:
- **Agendamento → realização (cirurgia)**: o campo `timestamp_agendamento` do fato carrega *Entrada
  na Sala*, não a data em que a cirurgia foi agendada. A data de agendamento não está mapeada — seria
  mudança de ETL e de exploração de CSV, escopo maior.
- **Taxa de cancelamento**: é uma taxa, não um tempo → Fase B.

## 5. Backend

Cadeia obrigatória preservada: `.sql → Provider → Controller → Router → Schema` + teste.

- **Novos arquivos:** `backend/src/pija/sql/kpis/kpi_10.sql` e `kpi_10b.sql`, no molde do
  `kpi_07b.sql` (produtores de linhas `(dimensao, valor)`, com `{group_col}`, `{filtros}`,
  `{grupo_scope}` e as guardas de data).
- **Registro no provider** (`kpis_provider.py`): `KPI_META`, `KPI_UNIDADE_TEMPO` (`horas` para
  ambos), `ALL_KPIS` (deriva de `KPI_META`), e `KPI_DIM_PREFIX` se necessário.
- **`KPI_GRUPO_SCOPE`:** **decisão adiada para a implementação, com critério definido aqui.** Não
  existe hoje um `GRUPO_` cirúrgico em `unidades.py` (há `GRUPO_PROCEDIMENTAL`, cuja correspondência
  com centro cirúrgico não está verificada). O filtro `tipo_entidade = 'CIRURGIA'` já restringe o
  conjunto; o escopo de grupo existe para excluir unidades-ruído. **Critério:** rodar a query sem
  `grupo_scope` contra o banco real, olhar as unidades que aparecem no breakdown, e só então decidir
  entre (a) sem escopo, (b) reusar `GRUPO_PROCEDIMENTAL`, (c) constante nova. A decisão e a evidência
  vão para MD.
- **Endpoints:** nenhum novo. `/kpis/tempos-medios` e `/kpis/distribuicoes` são batch sobre
  `ALL_KPIS` — os dois KPIs entram automaticamente, **com histograma de graça**.

## 6. Frontend

- `KpiCode` ganha `'KPI-10' | 'KPI-10B'` (em `api.types.ts` **e** no `KpiCodeSchema` do
  `api.schemas.ts` — são duas listas que precisam andar juntas).
- `KPI_META` (frontend) ganha as entradas: `label`, `icon`, `ancora`, `unidadeTempo: 'horas'`,
  `regras`. O texto de `regras` deve dizer que só cirurgias realizadas (`RZDA`) entram, e — se a
  investigação do §3 revelar perda — o que a duplicação implica.
- `lib/areas.ts`: a área `cirurgias` passa a ter `kpis: ['KPI-10']` e sua `descricao` deixa de dizer
  "indicadores em desenvolvimento". **Não** definir `gargalosKpi` sem antes decidir se KPI-10 entra
  em `METRIC_OPTIONS` do ranking de gargalos (ver §8).
- `KpiGrid.vue`: passa `sub-dist`/`submetric` do KPI-10B no card do KPI-10 — hoje essa relação está
  **hardcoded para KPI-07/07B em três pontos do arquivo**. Com um segundo par, extrair um mapa
  `SUBMETRICA_DE: Partial<Record<KpiCode, KpiCode>>` (a review da entrega anterior já apontou esse
  ponto como "o momento natural de extrair, quando houver um segundo").
- Mocks: `kpis.mock.ts` e `distribuicoes.mock.ts` ganham os dois códigos, mantendo as invariantes
  que o teste de mock já cobre.
- O teste de `areas.ts` que hoje afirma `cirurgias.kpis === []` **muda de asserção** — é remoção de
  comportamento obsoleto, não perda de cobertura.

## 6.1 Registro nos documentos canônicos

[02-requisitos.md](../../../02-requisitos.md) hoje cataloga KPI-01 a KPI-09; os códigos 10 e 10B não
existem em lugar nenhum da documentação. A tabela de KPIs precisa ganhar as duas linhas com fórmula,
entidade e status (✅ implementado), na mesma forma das existentes — senão o repo passa a ter
indicador em produção que o contrato não menciona.

Conferir também se [SPEC.md](../../../SPEC.md) e [CLAUDE.md](../../../CLAUDE.md) listam o conjunto de
KPIs do MVP (o CLAUDE.md lista "5 KPIs de tempo médio"); se listarem, atualizar o número e a
enumeração junto, no mesmo commit.

## 7. Por que a Frente 1 precisa vir antes

Adicionar códigos de KPI cria uma janela em que backend e frontend discordam sobre o conjunto de
códigos válidos. Essa janela é **real, não hipotética**: o frontend na Vercel faz deploy automático
no merge, e o backend no Railway exige `railway up` manual (a imagem embute o banco, que não está no
Git). Já aconteceu nesta base — ver
[registro dos indicadores gráficos](../plans/2026-08-03-indicadores-graficos.md).

Com o parse estrito de hoje, um `codigo` desconhecido na resposta **derruba os seis histogramas de
uma vez**. Com o item 6 da Frente 1 aplicado, degrada só a entrada desconhecida. Por isso a ordem
1 → 3 não é preferência de arrumação: é o que evita um apagão de gráficos na janela de deploy.

## 8. Decisões deixadas explicitamente em aberto

Registradas como perguntas com dono, não como lacunas:

1. **KPI-10 entra no ranking de Gargalos (`METRIC_OPTIONS`)?** Tende a sim para *espera em sala*
   (KPI-10B) e a não para *duração da cirurgia* (KPI-10) — duração longa é característica do
   procedimento, exatamente o caso que a Frente 2 diz para não pintar de vermelho. Decidir com o
   dado real na mão, e registrar.
2. **`KPI_GRUPO_SCOPE`** — critério em §5, decisão na implementação.
3. **Se a investigação do §3 mostrar perda de dado**, a correção do ETL entra nesta frente e o plano
   ganha tarefas; o escopo de KPI não muda.

## 9. Verificação

- Suítes atuais: backend **186**, frontend **189**, `vue-tsc` limpo. Nenhuma regressão.
- Testes de provider para os dois KPIs no molde de `test_kpis.py` e `test_kpis_distribuicoes.py`:
  recorte por `situacao`, guardas de nulo e de ordem, filtros restringindo, KPI sem dado no recorte.
- **Browser contra o backend real**, nos dois temas e a 390px: a área Cirurgias deixa de mostrar
  estado vazio, o card do KPI-10 traz o histograma, e o KPI-10B aparece no bloco de submétrica.
  Conferir que o `n` bate com o que a investigação do §3 previu — se divergir muito, a investigação
  estava errada e é isso que precisa ser corrigido, não o teste.
- Frente de backend → termina com `railway up --no-gitignore` a partir de `backend/`.

## 10. Fora de escopo

Fase B inteira (KPI-02, KPI-04, KPI-08, KPI-09) · taxa de cancelamento cirúrgico · agendamento →
realização de cirurgia (exige mapeamento de ETL novo) · qualquer mudança nos `.sql` existentes ·
mudanças no `HistogramaTempos.vue` · tendência temporal.
