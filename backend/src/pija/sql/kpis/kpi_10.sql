-- KPI-10: duração da cirurgia (início → fim), em HORAS.
-- Só cirurgias realizadas: uma cirurgia cancelada ou apenas agendada não tem duração.
-- `timestamp_principal` = data_inicio_cirurgia e `timestamp_realizacao` = data_fim_cirurgia
-- (ver DADOS-ESTADO §4.6) — o nome das colunas do fato é genérico, o significado é este.
SELECT {group_col} AS dimensao,
       (JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_principal)) * 24 AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CIRURGIA'
  AND situacao = 'RZDA'
  AND timestamp_realizacao IS NOT NULL
  AND timestamp_principal IS NOT NULL
  AND JULIANDAY(timestamp_realizacao) >= JULIANDAY(timestamp_principal)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
