# Spec — Endurecimento: execução do backlog acumulado

> **Data:** 2026-08-05 · **Status:** aprovada pelo usuário (brainstorm nesta data)
> **Origem:** [2026-08-03-backlog-duplicacao-filtros.md](../plans/2026-08-03-backlog-duplicacao-filtros.md)
> — seis itens registrados durante as reviews das entregas de julho/agosto, nenhum deles
> bloqueante na época, todos ainda abertos.

Esta é a **Frente 1** de três aprovadas em 2026-08-05. As outras:
[simplificação de breakdown e cores](2026-08-05-simplificacao-breakdown-e-cores-design.md) e
[KPI de Cirurgia](2026-08-05-kpi-cirurgia-design.md).

---

## 1. Por que agora, e por que primeiro

Nenhum item é urgente isoladamente. O que os torna oportunos agora é a **Frente 3**: adicionar
KPI-10/10B faz crescer o conjunto de códigos de KPI, e dois itens deste backlog são exatamente
sobre o que quebra quando esse conjunto cresce (itens 5 e 6). Fazer o endurecimento depois de
adicionar o KPI seria consertar com o defeito já em produção.

Os itens são independentes entre si e podem ser executados em qualquer ordem interna, **exceto**
que o item 6 precisa estar pronto antes da Frente 3 entrar.

## 2. Os seis itens e as decisões de como resolver

### 2.1 `Filtros` duplicado em 5 controllers → dependência injetada

**Estado:** `kpis_controller.get_kpis`, `kpis_controller.get_distribuicoes`, `ciclicidade_controller`,
`eventos_controller` e `gargalos_controller` repetem ~15 linhas idênticas: as declarações `Query()`
de `unidade`/`especialidade`/`grupo`/`data_inicio`/`data_fim` e a montagem do `Filtros`.

**Decisão:** criar uma classe `FiltrosQuery` consumida via `Depends()`, que o FastAPI ainda expõe
no OpenAPI como parâmetros de query individuais (é isso que uma função compartilhada ingênua não
consegue). Aplicar **nos 5 controllers de uma vez** — corrigir só um deixaria os outros
inconsistentes, o que é pior que a duplicação uniforme de hoje.

**Cuidado:** os controllers não têm exatamente o mesmo conjunto de params (`get_kpis` tem
`group_by`, `get_distribuicoes` não; `gargalos` tem os seus). A dependência cobre apenas o
**conjunto comum de filtros**; params específicos continuam declarados no próprio controller.

**Rede de segurança:** a suíte existente. Nenhum teste novo é necessário — se a refatoração mudar
a interface HTTP, os testes de API existentes quebram. Verificar também que o OpenAPI gerado
continua listando os params (uma dependência mal construída os esconderia sem quebrar teste algum).

### 2.2 Fixture `client` duplicada em 5 arquivos de teste

**Estado:** `test_kpis_distribuicoes.py`, `test_kpis_multiselect.py`, `test_gargalos_multiselect.py`,
`test_ciclicidade.py` e `test_integration_f2.py` carregam cópias quase idênticas da fixture do
client HTTP async.

**Decisão:** subir para `backend/tests/conftest.py` e remover as 5 cópias. A única parte que é
genuinamente por-arquivo — receber `fixture_db_session` para forçar a população do banco antes do
uso — continua sendo responsabilidade de cada teste, não da fixture compartilhada.

### 2.3 Requisições obsoletas não são canceladas

**Estado:** `useKpiStore.fetchDistribuicoes` protege contra resposta atrasada com um guarda de
sequência: a resposta de um filtro antigo é **descartada**. Correto para a UI, mas a requisição
em si continua rodando — duas mudanças de filtro seguidas custam duas varreduras completas no
backend e só uma é usada. Vale para a família de stores inteira.

**Decisão:** `AbortController` nos fetches que reagem a filtro. O guarda de sequência **permanece**:
`abort()` não é garantia (a requisição pode já ter sido respondida quando o abort chega), então o
guarda continua sendo a proteção de correção e o abort vira otimização de custo.

**Escopo:** `useKpiStore` (KPIs e distribuições), `useGargaloStore`, `useCiclicidadeStore`,
`useDimensoesStore` — os que reagem a `activeFilters`.

**Testes:** que uma mudança de filtro aborta a requisição anterior; que uma resposta abortada não
seta `error` (um `AbortError` não é falha de verdade e não pode virar ErrorState).

### 2.4 ~~Submétrica sem dado é reportada como "acima da meta"~~ — resolvido por remoção

**Item retirado desta frente em 2026-08-05**, na mesma conversa que aprovou as specs.

O defeito era real: `subMeetsTarget` em `KpiCard.vue` devolve `false` quando `media_global` é
`null`, então ausência de dado virava meta perdida ("sem dados" ao lado de "meta: 4h · acima da
meta" em laranja). A correção planejada era um terceiro estado.

**O usuário decidiu remover a barra de meta de 4h inteira** (ver
[Frente 2](2026-08-05-simplificacao-breakdown-e-cores-design.md) §4). Sem barra, não há
`subMeetsTarget`, não há estado a distinguir e não há defeito a consertar. Um item resolvido por
deleção não precisa de código — precisa apenas não ser reintroduzido.

Fica registrado aqui, riscado em vez de apagado, para que a próxima leitura do backlog não
reabra o item achando que foi esquecido.

### 2.5 Invariantes estruturais da distribuição só valem no mock

**Estado:** `frontend/src/mocks/distribuicoes.mock.test.ts` garante que
`teto === buckets[último].de` e que existe exatamente uma cauda aberta, sempre por último. O
componente `HistogramaTempos.vue` **depende** da segunda. Mas o `DistribuicoesResponseSchema` (zod)
não valida nenhuma das duas — o caminho da resposta **real** não tem a garantia que o mock tem.

**Decisão:** `.superRefine` no `KpiDistribuicaoSchema` estendendo as duas invariantes ao dado de
produção. Só faz sentido quando `n_total > 0` e `buckets` não está vazio — os casos degenerados
legítimos (sem dado, tudo zero) devem continuar passando.

**Teste:** payload válido passa; payload com dois baldes de cauda falha; payload com
`teto ≠ buckets[último].de` falha; os dois degenerados passam.

### 2.6 O parse da distribuição é tudo-ou-nada

**Estado:** um `codigo` ou `unidade_tempo` desconhecido vindo do backend faz o
`DistribuicoesResponseSchema.parse` falhar e **derruba os seis histogramas de uma vez**. Hoje os
enums batem exatamente com o backend, então é latente.

**Por que deixa de ser latente:** a Frente 3 adiciona KPI-10/10B. Enquanto o backend estiver
deployado com os códigos novos e o frontend não (ou vice-versa — e o deploy do backend é manual,
então essa janela é real, não hipotética), o parse estrito apaga o dashboard inteiro de gráficos.

**Decisão:** degradar **por KPI** em vez de por resposta. Validar cada entrada de `distribuicoes`
individualmente (`safeParse`); entradas inválidas são descartadas com um `console.warn` nomeando o
código e o motivo; as válidas seguem. Coerente com a filosofia já estabelecida: o histograma é
enhancement, e enhancement degrada em partes, não em bloco.

**Decisão relacionada:** o envelope da resposta (`{ distribuicoes: [...] }`) continua estrito — se
a forma externa estiver errada, não há o que salvar.

**Teste:** resposta com 6 entradas, uma delas com `codigo` desconhecido → 5 distribuições e um
warn; resposta com envelope malformado → falha como hoje.

## 3. O que não muda

- Nenhuma mudança de contrato HTTP: os endpoints continuam recebendo e devolvendo o mesmo.
- Nenhuma mudança nos `.sql`.
- O guarda de sequência do store permanece (ver §2.3).

## 4. Verificação

Suítes atuais: backend **186**, frontend **189**, `vue-tsc` limpo. Nenhum item deste escopo pode
reduzir esses números; os itens 2.3, 2.5 e 2.6 os aumentam. (O 2.4 saiu — ver acima.)

Como a Frente 1 mexe em backend, ela termina com **deploy manual do Railway**
(`railway up --no-gitignore` a partir de `backend/`) — o auto-deploy do GitHub não alcança o
backend, porque a imagem embute o banco, que não está no Git.

## 5. Fora de escopo

Qualquer refatoração não listada acima. Especificamente: não mexer na arquitetura de stores, não
extrair componentes, não tocar nos `.sql`, não alterar a lógica de mediana ou de bucketização.
