# PIJA — Plataforma Integrada da Jornada Assistencial

**Parceria:** HC-UFPE · Centro de Informática UFPE
**Disciplina:** Integração e Evolução de Sistemas de Informação (IESI 2026.1)
**Time:** 2 — Perspectiva 1: Assistencial

> Este repositório é um **fork do template oficial fornecido pelo HC-UFPE**. Os arquivos originais do template foram arquivados em [`docs/_archive-hc-template/`](docs/_archive-hc-template/) e **não devem ser modificados**. Todo o trabalho da equipe acontece nos arquivos ativos da raiz.

---

## Sobre o Sistema

A PIJA é uma plataforma de **integração, visualização e análise da jornada assistencial** do HC-UFPE. A solução consolida dados fragmentados do AGHU em uma visão integrada e analítica do percurso dos pacientes, permitindo identificar gargalos, calcular KPIs e apoiar a tomada de decisão operacional e gerencial.

**Entidades no escopo:** Prontuários · Consultas · Exames · Internações · Cirurgias · Procedimentos · Altas

### Escopo do MVP (versão enxuta)

O MVP entrega **3 funcionalidades** que respondem a um subconjunto-chave das perguntas direcionadoras da disciplina:

1. **Filtragem** por unidade, especialidade, tipo de evento e período (RF001)
2. **KPIs de tempo médio entre eventos** da jornada (RF002 subset — 5 KPIs)
3. **Ranking de gargalos** por tempo médio de espera (RF003)

### Fora do MVP (Pós-MVP / Backlog)

Linha do tempo cronológica por paciente · Integração LEC · Fluxos predominantes · Painel de prontuários inertes · Taxas de não realização · Proporções de encaminhamento.

---

## Desenvolvimento Orientado a Especificações (SDD)

Este projeto utiliza o padrão **Spec-Driven Development**: a documentação técnica funciona como contrato executável que guia o desenvolvimento, reduz ambiguidades e habilita o uso de IA generativa de forma consistente e rastreável.

### Como começar

1. **Leia [SPEC.md](SPEC.md):** ponto de entrada central — task breakdown ativo e guardrails de desenvolvimento
2. **Leia [docs/PLANO.md](docs/PLANO.md):** plano de implementação por fase com skills Claude Code recomendadas
3. **Consulte [06-arquitetura.md](06-arquitetura.md):** stack, fluxo obrigatório, adapter `Resource` (CSV ↔ AGHU)
4. **Siga o Modelo de Dados em [04-modelo-dados.md](04-modelo-dados.md):** qualquer implementação deve ser consistente com `fato_eventos_jornada`

---

## Estrutura de Documentos

| Documento | Conteúdo |
|---|---|
| [SPEC.md](SPEC.md) | **Contrato SDD** — visão geral, guardrails, task breakdown MVP |
| [docs/PLANO.md](docs/PLANO.md) | Plano de implementação por fase + skills Claude Code |
| [01-visao.md](01-visao.md) | Problema, objetivos, escopo, critérios de sucesso |
| [02-requisitos.md](02-requisitos.md) | RF (com marcação MVP/Pós-MVP) e RNF com padrão CARE |
| [03-casos-uso.md](03-casos-uso.md) | Casos de uso com Mermaid e CARE |
| [04-modelo-dados.md](04-modelo-dados.md) | Views do AGHU, `fato_eventos_jornada`, JSON Schemas |
| [05-interfaces.md](05-interfaces.md) | Adapter `Resource`, API FastAPI, telas Vue 3, LGPD |
| [06-arquitetura.md](06-arquitetura.md) | Stack, fluxo obrigatório, guardrails, monorepo |
| [07-glossario.md](07-glossario.md) | Glossário, acrônimos, referências |

---

## Proposta de Solução

A proposta de solução completa (template preenchido) está disponível em:

> 📄 `Proposta Solução - Time 2 - PIJA.docx` — Visão executiva e estratégica: problema, TO-BE, arquitetura macro, KPIs, MVP, viabilidade e próximos passos

---

## Principais Decisões Técnicas

| Componente | MVP | Cutover (Fase 5) |
|---|---|---|
| Fonte de dados | **CSVs exportados das 7 views** (HC entrega) | AGHU Oracle via VPN (`python-oracledb`) |
| Adapter de origem | `CsvResource` (pandas chunked) | `AghuResource` (pool de conexão) |
| Pipeline ETL | Streaming batched, idempotente, modo `--sample N` | Mesmo runner, troca `RESOURCE_MODE=aghu` |
| Banco local | SQLite + SQLAlchemy 2.0 Async + Alembic | SQLite |
| Backend | FastAPI (Python 3.10+) + Pydantic v2 | — |
| Frontend | Vue 3 + TS + Vite + Pinia + Tailwind + Zod + Vee-Validate | — |
| Autenticação | **Interim:** `users.yml` + PyJWT (mesmo contrato Double Token) | `python-ldap` contra AD HC |
| IA | Fora do MVP | Detecção de padrões e anomalias |

---

## Pendências Críticas (Validar com HC-UFPE)

- [ ] Recebimento dos CSVs exportados das 7 views (formato, volume, frequência)
- [ ] Disponibilidade e estrutura das 7 views no AGHU (para a Fase 5)
- [ ] Campos opcionais: `situacao`, `data_hora_agendamento`, `data_hora_solicitacao`
- [ ] Consistência do `paciente_id` entre módulos
- [ ] Liberação de VPN e acesso read-only ao AGHU (gate da Fase 5)
- [ ] Política de retenção de dados e regras LGPD aplicáveis
- [ ] Confirmação do driver Oracle e DSN do AGHU

---

*Hospital das Clínicas da UFPE — Centro de Informática UFPE | IESI 2026.1*