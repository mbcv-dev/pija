SELECT
    AVG(JULIANDAY(timestamp_alta_administrativa) - JULIANDAY(timestamp_principal)) AS media_dias,
    COUNT(*) AS n
FROM fato_eventos_jornada
WHERE tipo_entidade = 'INTERNACAO'
  AND deleted_at IS NULL
  AND timestamp_alta_administrativa IS NOT NULL
  AND (:grupo        IS NULL OR grupo        = :grupo)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
