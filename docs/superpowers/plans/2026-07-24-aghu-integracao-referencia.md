# AGHU — referência de integração (padrão do HC) + correção de premissa

> **Data:** 2026-07-24. Fonte: o próprio HC-UFPE (eles já têm essa integração pronta e nos passaram o padrão).
> Este doc é a **referência canônica** para conectar o PIJA ao AGHU na Fase 5. Substitui as premissas antigas
> que assumiam Oracle.

---

## 0. Correção de premissa: AGHU é PostgreSQL (não Oracle)

- **O banco do AGHU é PostgreSQL.** Toda a documentação antiga que dizia "Oracle / `python-oracledb`" está
  **errada** e deve ser lida como PostgreSQL.
- **Driver:** `psycopg` (v3) ou `asyncpg` com SQLAlchemy 2.0 async — **não** `python-oracledb`.
- **Tabelas do AGHU** vivem no schema **`agh`** (ex.: `agh.mbc_cirurgias`, `agh.aip_pacientes`). As queries
  referenciam esse schema.
- **Docs a atualizar quando implementar:** [05-interfaces.md](../../../05-interfaces.md) (§Tipo/Driver dizem
  Oracle), [06-arquitetura.md](../../../06-arquitetura.md), e a menção no `CLAUDE.md` (já corrigida para
  psycopg/asyncpg).

---

## 1. Padrão de integração que o HC usa (5 camadas + engine)

> Bate quase 1:1 com a nossa arquitetura (`.sql → Provider → Controller → Router → Frontend`). Reaproveitar.

**Passo 1 — Script SQL (query pura)** · `src/providers/sql/`
- Todas as consultas ao AGHU ficam em arquivos `.sql` (não misturar SQL complexo com Python).
- Ex.: `obter_cirurgia_aghu.sql` — query bruta com joins nas tabelas do AGHU (`agh.mbc_cirurgias`,
  `agh.aip_pacientes`, etc.), esperando um parâmetro nomeado (ex.: `:prontuario`).

**Passo 2 — Provider (provedor de dados)** · `src/providers/implementations/`
- Ex.: `aghu_cirurgia_provider.py`. Tem um helper `get_sql_query` que **lê o arquivo `.sql` do disco**.
- Usa a **sessão assíncrona do SQLAlchemy conectada ao banco do AGHU** (`self.session`).
- Executa a query passando o parâmetro (ex.: prontuário) e **retorna um dicionário com os campos mapeados**
  (Nome, Data da Cirurgia, Especialidade, etc.).

**Passo 3 — Controller** · `src/controllers/`
- Ex.: `solicitacao_leito_controller.py` — o "cérebro". Chama o provider p/ os dados brutos e faz o
  **pós-processamento**: calcula idade a partir da data de nascimento; define turno (Manhã/Tarde/Noite) pelo
  horário; valida regras (ex.: data no passado). Formata no shape final que o front espera.

**Passo 4 — Router** · `src/routers/`
- Ex.: `solicitacoes_leito.py` expõe os endpoints HTTP. Ex.: `@router.get("/consultar-aghu/{prontuario}")`
  recebe a requisição, injeta o controller (que usa o provider com a conexão certa) e responde JSON tratado.

**Passo 5 — Frontend** · `frontend/src/views/`
- Ex.: `Solicitacoes.vue` — ao digitar o prontuário, `buscarPacienteAghu()` chama
  `api.get('/api/solicitacoes/consultar-aghu/' + prontuario)` e preenche os campos (Nome, Turno,
  Especialidade, Data da Cirurgia) automaticamente.

**Conexão / credenciais** · `src/dependencies.py`
- As credenciais do AGHU (**IP, porta, usuário, senha**) ficam no **`.env`** do servidor (nunca no código).
- `dependencies.py` lê essas variáveis e cria o motor com **`create_async_engine`** apontando para o **Postgres
  do AGHU**. Esse engine gera a **sessão assíncrona** injetada automaticamente nos providers (via `Depends`).

---

## 2. ⚠️ PONTO CRÍTICO: o PERÍODO (recorte temporal) é obrigatório

> Aviso explícito do HC — "extremamente relevante para o sistema de vocês".

- **Se a consulta ficar em aberto** (sem recorte de data), o sistema tenta ler **milhões de linhas** do AGHU →
  **trava o nosso sistema e sobrecarrega o banco deles**.
- **Consequência de design (obrigatória):** toda leitura do AGHU (seja ETL de extração, seja query direta)
  **deve ser limitada por período**. Nunca varrer a base inteira.
- Implica em:
  - **ETL / extração:** extrair sempre com filtro de data (janela configurável), em chunks — nunca "puxar tudo".
  - **Filtros do usuário:** considerar tornar o **período um filtro efetivo (e talvez obrigatório/com default
    limitado)** nas consultas que tocam o AGHU, para não disparar varreduras enormes.
  - **Índices:** garantir que as colunas de data das views estejam indexadas do lado do AGHU (ou pedir ao HC).

---

## 3. Dois estilos de integração — qual usamos?

- **Exemplo do HC (acima):** query **direta e transacional** ao AGHU por requisição (ex.: buscar 1 cirurgia por
  prontuário). Ótimo para lookups pontuais.
- **PIJA (analítico):** nossos KPIs agregam **milhões de eventos**. Rodar isso **direto** no AGHU a cada request
  seria pesado — daí o alerta do período. Nosso modelo é **ETL batch (bounded por período) → SQLite local**
  dentro da VM, e as análises rodam sobre o SQLite (leve, não sobrecarrega o AGHU).
- **Conclusão:** reusar o **padrão de conexão/camadas** do HC (§1) e o `create_async_engine` para Postgres, mas
  aplicá-lo no **ETL do `AghuResource`** (extração periódica bounded), não em queries analíticas ao vivo. O
  período obrigatório (§2) vale para os dois estilos.

---

## 4. Contexto de deploy (da reunião 2026-07-24)

- O HC provisiona uma **VM dentro da rede do HC** → ela **alcança o AGHU** (resolve o acesso em produção; sem
  MFA interativo, sem site-to-site). Cada projeto CIn×HC roda com um **SQLite pequeno dentro da própria VM**.
- Eles fazem o **deploy da nossa versão** (a partir do nosso GitHub) e commitam **containerização/config**, sem
  mexer no nosso código. Ver [2026-07-24-handoff-pos-reuniao-hc.md](2026-07-24-handoff-pos-reuniao-hc.md).

---

## 5. Checklist para a implementação do `AghuResource` (Fase 5)

- [ ] Trocar driver planejado: `python-oracledb` → **`psycopg`/`asyncpg`**.
- [ ] `.env` com IP/porta/usuário/senha do Postgres do AGHU (fornecidos pelo HC); `create_async_engine` em
      `dependencies.py` (ou equivalente no nosso layout).
- [ ] Mapear as views/tabelas reais (schema `agh.*`) × `fato_eventos_jornada` — validar contra
      [DADOS-ESTADO.md](../../DADOS-ESTADO.md).
- [ ] **ETL bounded por período** (janela configurável, em chunks) — nunca varrer tudo (§2).
- [ ] Atualizar `05-interfaces.md` / `06-arquitetura.md` (Oracle → PostgreSQL).
- [ ] Testar a extração contra o Postgres real via VPN/VM.
