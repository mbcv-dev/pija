SELECT COUNT(*) AS total
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND (:paciente_id   IS NULL OR paciente_id   = :paciente_id)
  AND (:unidade       IS NULL OR unidade       = :unidade)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
