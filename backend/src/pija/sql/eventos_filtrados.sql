SELECT
    evento_id,
    paciente_id,
    tipo_entidade,
    timestamp_principal,
    grupo,
    especialidade,
    situacao
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND (:grupo         IS NULL OR grupo         = :grupo)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
ORDER BY timestamp_principal DESC
LIMIT :limit OFFSET :offset
