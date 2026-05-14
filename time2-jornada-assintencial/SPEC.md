# SPEC.md – Contrato de Desenvolvimento (SDD)
## PIJA – Plataforma Integrada da Jornada Assistencial

**Projeto:** HC-UFPE · CIn-UFPE | IESI 2026.1 | Time 2 – Perspectiva Assistencial

---

## 1. Visão Geral e Resultados Esperados

Este documento é a **ÚNICA fonte de verdade** para a orquestração do desenvolvimento da PIJA. O objetivo é construir uma plataforma analítica segura, em conformidade com a LGPD, que integre e visualize a jornada assistencial do paciente no HC-UFPE a partir dos dados existentes no AGHU.

### Objetivos de Alto Nível

- [ ] Implementar pipeline ETL batch com extração das 7 views do AGHU
- [ ] Construir repositório analítico com modelo `fato_eventos_jornada`
- [ ] Implementar motor de cálculo dos 10 KPIs prioritários (RF004)
- [ ] Disponibilizar API analítica REST com RBAC e autenticação LDAP/AD
- [ ] Entregar dashboards funcionais: linha do tempo, KPIs, gargalos, fluxos, prontuários inertes
- [ ] Garantir trilhas de auditoria imutáveis para todas as consultas de usuários

---

## 2. Contexto do Projeto (Documentação Imutável)

As definições detalhadas estão nos seguintes documentos. **Nunca contradizer ou ignorar estas referências:**

| Documento | Conteúdo |
|---|---|
| [01-visao.md](01-visao.md) | Problema, objetivos, escopo, critérios de sucesso |
| [02-requisitos.md](02-requisitos.md) | RF001–RF008 e RNF001–RNF006 |
| [03-casos-uso.md](03-casos-uso.md) | UC001–UC007 |
| [04-modelo-dados.md](04-modelo-dados.md) | Views AGHU, `fato_eventos_jornada`, dimensões |
| [05-interfaces.md](05-interfaces.md) | Interface AGHU, API REST, telas, LGPD |
| [06-arquitetura.md](06-arquitetura.md) | Arquitetura macro, componentes, guardrails |
| [07-glossario.md](07-glossario.md) | Glossário, acrônimos, referências |

---

## 3. Limites de Escopo e Guardrails

### ✅ A IA e o Desenvolvimento DEVEM

- Seguir rigorosamente o modelo de dados definido em `04-modelo-dados.md`
- Extrair dados do AGHU **somente pelas views definidas** (nunca por tabelas brutas)
- Implementar soft delete: registros cancelados recebem flag, nunca são excluídos fisicamente
- Registrar trilha de auditoria imutável para todas as consultas de usuários (quem, o quê, quando)
- Utilizar RBAC para controle de acesso por perfil (assistencial, gestão, administrador)
- Documentar e versionar todas as regras de cálculo de KPIs
- Usar `paciente_id` como único identificador; nunca armazenar dados pessoais diretos
- Implementar testes unitários para cada KPI calculado

### ❌ A IA e o Desenvolvimento NÃO DEVEM

- Criar conexões diretas com tabelas brutas do AGHU (apenas via views)
- Implementar exclusão física de registros
- Burlar o sistema de RBAC
- Expor a API analítica fora da rede interna do HC-UFPE
- Criar dependências externas não documentadas em `06-arquitetura.md`
- Armazenar nome, CPF, data de nascimento ou qualquer dado pessoal direto do paciente
- Modificar dados no AGHU (acesso estritamente read-only)

---

## 4. Task Breakdown (Plano de Implementação)

### Fase 1 – Integração e Dados

- [ ] **TASK-001** Validar disponibilidade das 7 views com o DBA do HC-UFPE
- [ ] **TASK-002** Mapear campos opcionais disponíveis por view (situacao, timestamps)
- [ ] **TASK-003** Implementar pipeline ETL batch para as 7 views (RF008)
- [ ] **TASK-004** Criar schema do repositório analítico (`fato_eventos_jornada`, dimensões)
- [ ] **TASK-005** Configurar log de auditoria de execuções ETL e consultas de usuários

### Fase 2 – Motor Analítico

- [ ] **TASK-006** Implementar reconstrução cronológica da jornada por `paciente_id` (RF001)
- [ ] **TASK-007** Implementar cálculo dos 10 KPIs prioritários (RF004)
- [ ] **TASK-008** Implementar identificação de gargalos e ranking por tempo de espera (RF005)
- [ ] **TASK-009** Implementar agrupamento de fluxos predominantes (RF006)
- [ ] **TASK-010** Implementar identificação de prontuários inertes (RF007)

### Fase 3 – API e Autenticação

- [ ] **TASK-011** Implementar API analítica REST com endpoints definidos em `05-interfaces.md`
- [ ] **TASK-012** Implementar autenticação JWT / LDAP-AD e RBAC por perfil

### Fase 4 – Dashboards (MVP)

- [ ] **TASK-013** Desenvolver Tela 1: Dashboard inicial com KPIs e alertas
- [ ] **TASK-014** Desenvolver Tela 2: Linha do tempo do paciente (RF002)
- [ ] **TASK-015** Desenvolver Tela 3: Painel de KPIs com filtros (RF003, RF004)
- [ ] **TASK-016** Desenvolver Tela 4: Análise de gargalos (RF005)
- [ ] **TASK-017** Desenvolver Tela 5: Fluxos predominantes (RF006)
- [ ] **TASK-018** Desenvolver Tela 6: Prontuários inertes (RF007)

---

## 5. Critérios de Verificação Global

- [ ] Todos os KPIs calculados validados contra consultas manuais no AGHU (DBA)
- [ ] Zero dados pessoais diretos armazenados fora do campo `paciente_id`
- [ ] Log de auditoria operacional para todas as consultas de usuário
- [ ] RBAC validado: perfil assistencial não acessa dados de outras unidades
- [ ] Pipeline ETL concluída em até 4 horas na janela noturna
- [ ] Dashboards retornam filtros simples em até 5 segundos
- [ ] Cobertura de testes unitários nos módulos de KPI e ETL
