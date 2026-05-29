# Documentação do Projeto – PIJA
## Plataforma Integrada da Jornada Assistencial

**Parceria:** HC-UFPE · Centro de Informática UFPE  
**Disciplina:** Integração e Evolução de Sistemas de Informação (IESI 2026.1)  
**Time:** 2 – Perspectiva 1: Assistencial

---

## Sobre o Sistema

A PIJA é uma plataforma de **integração, visualização e análise da jornada assistencial** do HC-UFPE. A solução consolida dados fragmentados do AGHU em uma visão integrada e analítica do percurso dos pacientes, permitindo identificar gargalos, calcular KPIs e apoiar a tomada de decisão operacional e gerencial.

**Entidades no escopo:** Prontuários · Consultas · Exames · Internações · Cirurgias · Procedimentos · Altas

---

## Desenvolvimento Orientado a Especificações (SDD)

Este projeto utiliza o padrão **Spec-Driven Development**: a documentação técnica funciona como contrato executável que guia o desenvolvimento, reduz ambiguidades e habilita o uso de IA generativa de forma consistente e rastreável.

### Como começar

1. **Leia [SPEC.md](SPEC.md):** ponto de entrada central — task breakdown ativo e guardrails de desenvolvimento
2. **Consulte [06-arquitetura.md](06-arquitetura.md):** guardrails de IA e definições técnicas inegociáveis
3. **Siga o Modelo de Dados em [04-modelo-dados.md](04-modelo-dados.md):** qualquer implementação deve ser consistente com as views e a tabela `fato_eventos_jornada`

---

## Estrutura de Documentos

| Documento | Conteúdo |
|---|---|
| [01-visao.md](01-visao.md) | Problema, objetivos, escopo, critérios de sucesso |
| [02-requisitos.md](02-requisitos.md) | RF001–RF006 e RNF001–RNF006 com padrão CARE |
| [03-casos-uso.md](03-casos-uso.md) | UC001–UC006 com Mermaid e CARE |
| [04-modelo-dados.md](04-modelo-dados.md) | Views do AGHU, tabela fato, dimensões, regras de integridade |
| [05-interfaces.md](05-interfaces.md) | Interface com AGHU, API analítica, especificação de telas, LGPD |
| [06-arquitetura.md](06-arquitetura.md) | Stack, fluxo obrigatório, guardrails, monorepo |
| [07-glossario.md](07-glossario.md) | Glossário de termos, acrônimos e referências bibliográficas |

---

## Proposta de Solução

A proposta de solução completa (template preenchido) está disponível em:

> 📄 `Proposta Solução - Time 2 - PIJA.docx` – Visão executiva e estratégica: problema, TO-BE, arquitetura macro, KPIs, MVP, viabilidade e próximos passos

---

## Principais Decisões Técnicas

| Componente | Decisão MVP | Evolução |
|---|---|---|
| Fonte de dados | AGHU – 7 views SQL (read-only) | Novos sistemas satélites |
| Pipeline ETL | Batch (matutino/noturno) | Near real-time |
| Banco local | SQLite | — |
| Frontend | Vue 3 + TypeScript + Vite + Tailwind | — |
| Backend | FastAPI (Python 3.10+) | — |
| Autenticação | Double Token via AD/LDAP (já implementado no framework) | — |
| IA | Fora do MVP | Detecção de padrões e anomalias |

---

## Pendências Críticas (Validar com HC-UFPE)

- [ ] Disponibilidade e estrutura das 7 views no AGHU
- [ ] Campos opcionais: `situacao`, `data_hora_agendamento`, `data_hora_solicitacao`
- [ ] Consistência do `paciente_id` entre módulos
- [ ] Ambiente de deploy e acesso read-only ao AGHU
- [ ] Política de retenção de dados e regras LGPD aplicáveis

---

*Hospital das Clínicas da UFPE – Centro de Informática UFPE | IESI 2026.1*
