WITH internacoes AS (
    SELECT paciente_id, timestamp_principal AS dt_internacao
    FROM fato_eventos_jornada
    WHERE tipo_entidade = 'INTERNACAO'
      AND deleted_at IS NULL
      AND (:grupo        IS NULL OR grupo        = :grupo)
      AND (:especialidade IS NULL OR especialidade = :especialidade)
      AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
      AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
),
ultima_consulta AS (
    SELECT i.paciente_id, i.dt_internacao,
           MAX(c.timestamp_realizacao) AS dt_ultima_consulta
    FROM internacoes i
    INNER JOIN fato_eventos_jornada c
        ON c.paciente_id = i.paciente_id
       AND c.tipo_entidade = 'CONSULTA'
       AND c.deleted_at IS NULL
       AND c.timestamp_realizacao IS NOT NULL
       AND c.timestamp_realizacao < i.dt_internacao
    GROUP BY i.paciente_id, i.dt_internacao
)
SELECT
    AVG(JULIANDAY(dt_internacao) - JULIANDAY(dt_ultima_consulta)) AS media_dias,
    COUNT(*) AS n
FROM ultima_consulta
