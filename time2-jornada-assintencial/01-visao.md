# 01 – Visão do Produto

**Projeto:** Plataforma Integrada da Jornada Assistencial (PIJA)  
**Parceria:** HC-UFPE · CIn-UFPE | Disciplina IESI 2026.1  
**Time:** 2 – Perspectiva 1: Assistencial  

---

## 1. Declaração do Problema

Os dados da jornada assistencial do Hospital das Clínicas da UFPE (HC-UFPE) existem no sistema AGHU, porém estão distribuídos em módulos independentes (ambulatório, diagnóstico, internação, centro cirúrgico e regulação interna). Falta uma camada de integração mais efetiva que permita correlacioná-los temporalmente e por paciente.

Como consequência, equipes assistenciais e gestores hospitalares não dispõem de uma visão cronológica e integrada da jornada dos pacientes, o que dificulta:

- a identificação de gargalos operacionais e assistenciais;
- o cálculo padronizado de KPIs de desempenho por unidade e especialidade;
- a tomada de decisão baseada em evidências sobre produção, eficiência e fluxos assistenciais.

---

## 2. Objetivo da Solução

Desenvolver uma plataforma de **integração, visualização e análise da jornada assistencial** do HC-UFPE, que:
1. Permita navegação por paciente, unidade, especialidade, tipo de evento e período;
2. Calcule KPIs assistenciais e operacionais padronizados para cada etapa e relação entre etapas da jornada;
3. Apoie a tomada de decisão clínica, operacional e gerencial com base no percurso real dos pacientes.

A PIJA **não** substitui sistemas transacionais. Ela opera como **camada analítica e observacional** sobre o AGHU.

---

## 3. Escopo

### 3.1 Entidades no escopo (MVP)

| Entidade | View correspondente |
|---|---|
| Prontuários criados | `vw_prontuarios_criados` |
| Consultas (ambulatorial / telemedicina) | `vw_consultas` |
| Exames (lab, imagem, etc.) | `vw_exames` |
| Internações | `vw_internacoes` |
| Cirurgias | `vw_cirurgias` |
| Procedimentos | `vw_procedimentos` |
| Altas | `vw_altas` |

### 3.2 Fora do escopo (MVP)

- Prontuário clínico (evolução, prescrição, anamnese)
- Farmácia e dispensação de medicamentos
- Faturamento e glosas
- Módulo de análise preditiva com IA (pós-MVP)

---

## 4. Perspectiva Adotada

Este sistema adota a **Perspectiva Assistencial**, voltada às unidades e áreas prestadoras de serviço, com foco em indicadores de produção, desempenho, tempos de espera, gargalos e eficiência dos fluxos assistenciais.

> A perspectiva do paciente individual (histórico clínico pessoal) está fora do escopo desta entrega.

---

## 5. Benefícios Esperados

| Beneficiário | Benefício |
|---|---|
| Gestores hospitalares | Visão de desempenho por unidade/especialidade sem consulta direta ao banco |
| Coordenadores de unidade | Identificação sistemática de gargalos e falhas de fluxo |
| Equipes assistenciais | Contexto cronológico da jornada para apoio à decisão clínica |
| Área de TI / informática | Camada padronizada de extração e consulta analítica sobre o AGHU |

---

## 6. Restrições e Premissas

- O AGHU é a única fonte de dados primária no MVP.
- O acesso ao AGHU será **read-only**, via views SQL pré-definidas.
- Os dados de paciente serão tratados com **pseudoanonimização** (uso de `paciente_id` / nº do prontuário), sem exposição de dados pessoais diretos.
- A frequência de atualização dos dados no MVP é **batch diária** (extração noturna).
- A disponibilidade dos campos opcionais (ex: `situacao/status`, timestamps de agendamento) está sujeita à validação com o DBA do HC-UFPE.

---

## 7. Critérios de Sucesso (MVP)

- Reconstrução cronológica da jornada para pelo menos as 7 entidades mapeadas
- Dashboards funcionais com filtros por unidade, especialidade, tipo de evento e período
- Pelo menos 5 KPIs calculados e validados com o HC-UFPE
- Identificação automatizada de pelo menos 2 gargalos recorrentes no fluxo
