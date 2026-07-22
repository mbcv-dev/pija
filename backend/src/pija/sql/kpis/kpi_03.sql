SELECT {group_col} AS dimensao,
       JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_agendamento) AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CONSULTA'
  AND timestamp_realizacao IS NOT NULL
  AND timestamp_agendamento IS NOT NULL
  AND JULIANDAY(timestamp_realizacao) >= JULIANDAY(timestamp_agendamento)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
