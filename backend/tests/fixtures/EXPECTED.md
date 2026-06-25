# Valores Esperados — Fixture F2

Fixture: 7 prontuários, 5 consultas, 3 internações = 15 eventos totais.

## KPIs

| KPI | media_dias | n | Cálculo |
|-----|-----------|---|---------|
| KPI-01 | 12.0 | 5 | (9+14+20+7+10)/5 — p006/p007 excluídos (sem eventos) |
| KPI-03 | 9.2 | 5 | (10+10+9+7+10)/5 |
| KPI-05 | null | null | Bloqueado — aguardando confirmação HC |
| KPI-06 | 11.0 | 3 | (16+11+6)/3 — só p001/p002/p003 têm consulta+internação |
| KPI-07 | 5.0 | 3 | (5+3+7)/3 |

## Gargalos

| Posição | tipo_entidade | unidade | especialidade | media_espera_dias | n |
|---------|--------------|---------|---------------|------------------|---|
| 1 | CONSULTA | CARDIOLOGIA | CARDIOLOGIA | 10.0 | 3 |
| 2 | CONSULTA | ORTOPEDIA | ORTOPEDIA | 8.0 | 2 |
| 3 | INTERNACAO | ORTOPEDIA | ORTOPEDIA | 7.0 | 1 |
| 4 | INTERNACAO | CARDIOLOGIA | CARDIOLOGIA | 4.0 | 2 |

## /eventos sem filtros

total=15 (7 PRONTUARIO + 5 CONSULTA + 3 INTERNACAO)

## /eventos filtrado por unidade=CARDIOLOGIA

total=5 (3 CONSULTA + 2 INTERNACAO)
