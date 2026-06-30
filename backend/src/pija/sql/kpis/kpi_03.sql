SELECT {group_col} AS dimensao,
       SUM(JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_agendamento)) AS soma_dias,
       COUNT(*) AS n
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CONSULTA'
  AND timestamp_realizacao IS NOT NULL
  AND timestamp_agendamento IS NOT NULL
  AND JULIANDAY(timestamp_realizacao) >= JULIANDAY(timestamp_agendamento)
  AND (:unidade       IS NULL OR unidade       = :unidade)
  AND unidade NOT LIKE '%INATIVO%'
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  AND (:grupo IS NULL OR grupo = :grupo)
  {grupo_scope}
GROUP BY {group_col}
