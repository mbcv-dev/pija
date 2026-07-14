# Feedback da apresentação (Demo Day 01/07) — backlog de melhorias

> **Registrado:** 2026-07-06. Origem: observações da banca/stakeholders na apresentação do Demo Day.
> **Status:** backlog priorizado — ainda não implementado. Convém refletir no `PIJA-Roadmap.xlsx` e no `SPEC.md`.

---

## 1. Ciclicidade da jornada (indas e vindas) — **alta prioridade / diferencial**

- **O quê:** a jornada do paciente **não é linear** — tem retornos, reinternações, idas e vindas entre
  etapas. Essa **ciclicidade** é informação muito relevante e hoje não é representada.
- **Por quê:** captura o comportamento real do paciente no HC (ex.: consulta → exame → volta pra consulta
  → internação → alta → retorno ambulatorial). É um dos maiores valores analíticos da plataforma.
- **Como (ideal):** mostrar da forma **mais visual possível** — a jornada com os ciclos/loops explícitos.
  Candidatos: grafo de fluxo entre etapas (Sankey / diagrama de estados com contagem de transições),
  ou timeline por paciente que evidencie os retornos. Evoluir a tela **Jornada** atual.
- **Onde:** view `Jornada` (frontend) + provavelmente um novo agregado no backend (contagem de transições
  etapa→etapa). Relaciona com o ranking de **Gargalos** (transições).

## 2. Explicar melhor o cálculo das KPIs — **média prioridade**

- **O quê:** deixar claro **o que** cada KPI mede e **como** é calculado (âncora de→até, unidade de tempo,
  mediana p50, regras de inclusão/exclusão).
- **Estado atual:** já existe a página **/metodologia**, mas precisa ser **aprofundada/mais didática**
  (fórmula, exemplo numérico, o porquê da mediana, exclusões: negativos, INATIVO, etc.).
- **Onde:** página `/metodologia` + tooltips nos cards.

## 3. Indicadores mais gráficos (conforme o indicador) — **média prioridade**

- **O quê:** exibir **alguns** indicadores de forma mais gráfica, **dependendo do tipo** do indicador
  (nem tudo precisa de gráfico; escolher a forma certa por indicador).
- **Como:** distribuição/histograma para tempos (mostra a cauda que a mediana esconde — casa com o achado
  do KPI-07B), gráfico de barras para rankings, tendência temporal quando fizer sentido.
- **Nota técnica:** usar a skill `dataviz` ao construir qualquer gráfico (paleta consistente, acessível,
  claro/escuro).

## 4. Navegação por áreas da jornada — **média prioridade**

- **O quê:** interface mais amigável, **separando pelas áreas da jornada do paciente**:
  **Entrada · Exames · Consultas · Internação · Cirurgias**.
- **Por quê:** organiza a ferramenta pela ótica do usuário assistencial (fluxo do paciente) em vez de por
  KPI solto.
- **Onde:** navegação/estrutura do frontend (sidebar + agrupamento de KPIs por área).

## 5. Integrar com o AGHU — **alta prioridade / caminho crítico**

- Ver [2026-07-06-acesso-aghu-vpn.md](2026-07-06-acesso-aghu-vpn.md). VPN e credencial já resolvidas para
  **dev**; falta host/porta/service-name e a **decisão de runtime em produção** com o HC.

---

## 6. Requisito de dados: classificação de EXAMES nos filtros — **obrigatório**

> Fonte canônica: `docs/classificacao-exames/Exames - classificação.docx`.
> **Isso tem que estar no sistema, nos filtros, bem separado** (por Grupo → Executores).

Mapeamento **Grupo → Executores** (unidades executoras de exame):

| Grupo | Executores |
|---|---|
| **Análises Clínicas** | UAC: BIOQUÍMICA · UAC: SOROLOGIA · UAC: HEMATOLOGIA · UAC: BACTERIOLOGIA · UAC: HEMOSTASIA · UAC: UROANÁLISE · UAC: GASOMETRIA · UAC: EXAMES EXTERNOS · UAC: EXAMES DA REDE |
| **Diagnóstico por Imagem** | UDI: ULTRASSONOGRAFIA · UDI: RADIOLOGIA CONVENCIONAL · UDI: TOMOGRAFIA COMPUTADORIZADA · UDI: DENSITOMETRIA ÓSSEA · UDI: RESSONÂNCIA MAGNÉTICA · UDI: MEDICINA NUCLEAR · UDI: MAMOGRAFIA · UNIDADE DE DIAGNÓSTICO POR IMAGEM |
| **Anatomia Patológica** | UAP: HISTOPATOLÓGICO · UAP: CITOLOGIA CÉRVICO-VAGINAL · UAP: CITOLOGIA GERAL · UAP: IMUNOHISTOQUÍMICA · UAP: CONGELAÇÃO |
| **Procedimental** | AGÊNCIA TRANSFUSIONAL · ENDOSCOPIA · HEMODINÂMICA-PDT · BLOCO DERMATO · NEFROLOGIA - PROCEDIMENTOS · CENTRO OBSTÉTRICO |
| **Ambulatorial** | OBSTETRÍCIA (AMBULATÓRIO) · CARDIOLOGIA (AMBULATÓRIO) · PNEUMOLOGIA (AMBULATÓRIO) · GINECOLOGIA (AMBULATÓRIO) · GASTROENTEROLOGIA (AMBULATÓRIO) · NEUROLOGIA (AMBULATÓRIO) · UROLOGIA (AMBULATÓRIO) · INFECTOLOGIA (AMBULATÓRIO) · HEMATOLOGIA (AMBULATÓRIO) · OFTALMO GERAL · OFTALMO ESPECIALIZADOS · FONOAUDIOLOGIA |
| **Internação** | 8º SUL |

**Pendências/observações sobre a tabela:**
- ⚠️ **Internação** aparece com apenas **"8º SUL"** no docx — parece **incompleto** (há várias enfermarias
  de internação na base: 7º NORTE, 9º NORTE, 10º NORTE, 11º SUL, UTI ADULTO, UCI CANGURU, etc.). **Confirmar
  a lista completa com o HC** antes de codar o filtro.
- No docx havia um erro de digitação `GASOMETRIAUAC: EXAMES EXTERNOS` — são **dois** executores separados
  (`UAC: GASOMETRIA` e `UAC: EXAMES EXTERNOS`); já corrigido acima.
- Esses grupos batem com o dropdown **Grupo** atual do dashboard — usar esta tabela como **fonte de verdade**
  para classificar os executores de exame nos filtros (e no KPI-05).

**Ação técnica:** materializar esse mapeamento como fonte única (ex.: tabela/seed ou arquivo de referência
consumido pelo endpoint `/dimensoes` e pelo filtro de exames), garantindo que o filtro de exames apareça
**agrupado por Grupo**, não como lista crua de executores.

---

## 7. Sugestão de priorização

1. **Integração AGHU** (§5) — caminho crítico, já destravado para dev.
2. **Classificação de exames nos filtros** (§6) — obrigatório, fonte pronta, esforço baixo-médio.
3. **Ciclicidade da jornada** (§1) — maior diferencial de produto; exige design + agregado novo.
4. **Navegação por áreas** (§4) e **KPIs mais gráficos** (§3) — melhoram usabilidade/leitura.
5. **Aprofundar /metodologia** (§2) — rápido, alto retorno de clareza.
