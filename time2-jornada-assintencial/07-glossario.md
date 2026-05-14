# 07 – Glossário e Bibliografia

**Projeto:** PIJA – Plataforma Integrada da Jornada Assistencial  
**Referência:** Perspectiva Assistencial | HC-UFPE · CIn-UFPE | IESI 2026.1

---

## 1. Glossário de Termos

| Termo | Definição |
|---|---|
| **AGHU** | Sistema de Gestão Hospitalar Universitário. Sistema transacional utilizado pelo HC-UFPE para registro de prontuários, consultas, internações, cirurgias, exames e altas. |
| **Alta administrativa** | Alta registrada pela enfermagem, que efetivamente libera o leito no sistema. Difere da alta médica. |
| **Alta médica** | Alta documentada no sumário de alta pelo médico. O leito ainda é contabilizado como ocupado até a alta administrativa. |
| **Batch** | Modo de processamento em lote, executado periodicamente (ex: diariamente), em contraposição ao tempo real. |
| **CID** | Classificação Internacional de Doenças. Código padrão utilizado para registrar diagnósticos em internações. |
| **Condicao_atendimento** | Campo da vw_consultas que classifica o tipo de atendimento: Regulada, Retorno, Teletriagem, Interconsulta. |
| **ETL** | Extract, Transform, Load. Processo de extração de dados de fontes originais, transformação para um formato padronizado e carga em um repositório analítico. |
| **Glosa** | Recusa total ou parcial de pagamento por parte de um convênio ou plano de saúde em relação a um procedimento cobrado pelo hospital. Processo de auditoria financeira fora do escopo da PIJA. |
| **Gargalo** | Etapa da jornada assistencial com tempo de espera sistematicamente elevado, que compromete a progressão do fluxo. |
| **Grade** | Campo que classifica a fila ou modalidade de atendimento/exame dentro do AGHU. |
| **HC-UFPE** | Hospital das Clínicas da Universidade Federal de Pernambuco. |
| **Interconsulta** | Consulta solicitada por uma especialidade a outra, no contexto de um paciente já em atendimento. |
| **Internação clínica** | Internação para tratamento clínico (não cirúrgico). |
| **Internação pré-operatória** | Internação que antecede uma cirurgia. |
| **Internação pós-operatória** | Internação para recuperação após cirurgia (inclui UTI pós-op). |
| **Jornada assistencial** | Percurso completo do paciente pelo sistema de saúde, desde o acesso (criação de prontuário) até o desfecho (alta, transferência ou óbito). |
| **KPI** | Key Performance Indicator. Indicador-chave de desempenho utilizado para medir e monitorar resultados. |
| **LEC** | Lista de Espera Cirúrgica. Fila gerenciada pelo HC-UFPE para agendamento de cirurgias eletivas. |
| **LGPD** | Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Lei brasileira que regula o tratamento de dados pessoais. |
| **MVP** | Minimum Viable Product. Produto com o conjunto mínimo de funcionalidades para validar a solução com usuários reais. |
| **Near real-time** | Processamento de dados com latência mínima (segundos a minutos), em contraposição ao batch diário. |
| **paciente_id** | Identificador do paciente utilizado no AGHU, correspondente ao número do prontuário. Não inclui dados pessoais diretos. |
| **Perspectiva assistencial** | Visão orientada às unidades e áreas prestadoras de serviço, com foco em produção, desempenho e eficiência dos fluxos. |
| **PIJA** | Plataforma Integrada da Jornada Assistencial. Nome dado ao sistema desenvolvido neste projeto. |
| **Prontuário inerte** | Prontuário criado no sistema sem nenhum evento assistencial subsequente registrado. |
| **Pseudoanonimização** | Técnica de proteção de dados que substitui identificadores diretos (nome, CPF) por um identificador não diretamente associável à pessoa sem chave adicional. |
| **RBAC** | Role-Based Access Control. Controle de acesso baseado em perfis de usuário. |
| **Regulação interna** | Processo pelo qual pacientes são encaminhados e regulados dentro do HC-UFPE para consultas, exames ou internações. |
| **Repositório analítico** | Banco de dados separado do AGHU, otimizado para consultas analíticas e cálculo de KPIs. |
| **Soft delete** | Técnica de exclusão lógica: o registro é marcado como inativo/cancelado, mas não é removido fisicamente do banco. |
| **Star schema** | Modelo de dados analítico composto por uma tabela fato central e tabelas dimensão ao redor. |
| **Swim lane** | Raia em um diagrama de processo (ex: BPMN) que agrupa atividades por responsável ou área. |
| **Timestamp** | Registro de data e hora de um evento, com precisão de segundos. |
| **View (SQL)** | Consulta armazenada no banco de dados que apresenta dados de uma ou mais tabelas em formato pré-definido. |

---

## 2. Acrônimos

| Acrônimo | Significado |
|---|---|
| AGHU | Sistema de Gestão Hospitalar Universitário |
| BPMN | Business Process Model and Notation |
| CID | Classificação Internacional de Doenças |
| ETL | Extract, Transform, Load |
| HC | Hospital das Clínicas |
| IESI | Integração e Evolução de Sistemas de Informação |
| KPI | Key Performance Indicator |
| LDAP | Lightweight Directory Access Protocol |
| LEC | Lista de Espera Cirúrgica |
| LGPD | Lei Geral de Proteção de Dados |
| MVP | Minimum Viable Product |
| PIJA | Plataforma Integrada da Jornada Assistencial |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SDD | Spec-Driven Development |
| TLS | Transport Layer Security |

---

## 3. Referências Bibliográficas

- KIMBALL, R.; ROSS, M. **The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling.** 3. ed. Wiley, 2013.
- PRESSMAN, R. S.; MAXIM, B. R. **Engenharia de Software: Uma Abordagem Profissional.** 8. ed. McGraw-Hill, 2016.
- SOMMERVILLE, I. **Engenharia de Software.** 10. ed. Pearson, 2019.
- BRASIL. **Lei nº 13.709, de 14 de agosto de 2018 – Lei Geral de Proteção de Dados Pessoais (LGPD).** Brasília, 2018.
- OBJECT MANAGEMENT GROUP. **Business Process Model and Notation (BPMN) 2.0.** OMG, 2011. Disponível em: https://www.omg.org/bpmn
- EBRAHIM, Z.; IRANI, Z. **E-government adoption: architecture and barriers.** Business Process Management Journal, 2005.
- MINISTÉRIO DA SAÚDE. **Sistema de Gestão Hospitalar Universitário (AGHU)** – Documentação técnica. Disponível em: https://www.gov.br/saude
