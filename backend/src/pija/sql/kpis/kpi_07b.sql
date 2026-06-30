SELECT {group_col} AS dimensao,
       SUM((JULIANDAY(timestamp_alta_administrativa) - JULIANDAY(timestamp_alta_medica)) * 24) AS soma_dias,
       COUNT(*) AS n
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'INTERNACAO'
  AND timestamp_alta_administrativa IS NOT NULL
  AND timestamp_alta_medica IS NOT NULL
  AND JULIANDAY(timestamp_alta_administrativa) >= JULIANDAY(timestamp_alta_medica)
  AND unidade NOT LIKE '%INATIVO%'
  AND (:unidade       IS NULL OR unidade       = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:grupo         IS NULL OR grupo         = :grupo)
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
GROUP BY {group_col}
