WITH prontuarios AS (
    SELECT paciente_id, timestamp_principal AS dt_prontuario
    FROM fato_eventos_jornada
    WHERE tipo_entidade = 'PRONTUARIO' AND deleted_at IS NULL
),
primeiro_evento AS (
    SELECT paciente_id, MIN(timestamp_principal) AS dt_primeiro
    FROM fato_eventos_jornada
    WHERE tipo_entidade != 'PRONTUARIO'
      AND deleted_at IS NULL
      AND (:grupo        IS NULL OR grupo        = :grupo)
      AND (:especialidade IS NULL OR especialidade = :especialidade)
      AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
      AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
    GROUP BY paciente_id
)
SELECT
    AVG(JULIANDAY(pe.dt_primeiro) - JULIANDAY(p.dt_prontuario)) AS media_dias,
    COUNT(*) AS n
FROM prontuarios p
INNER JOIN primeiro_evento pe ON p.paciente_id = pe.paciente_id
WHERE JULIANDAY(pe.dt_primeiro) > JULIANDAY(p.dt_prontuario)
