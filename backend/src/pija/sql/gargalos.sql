SELECT
    tipo_entidade,
    grupo,
    especialidade,
    AVG(
        CASE
            WHEN tipo_entidade IN ('CONSULTA', 'PROCEDIMENTO', 'CIRURGIA')
                THEN JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_agendamento)
            WHEN tipo_entidade = 'EXAME'
                THEN JULIANDAY(timestamp_realizacao) - JULIANDAY(timestamp_solicitacao)
            WHEN tipo_entidade = 'INTERNACAO'
                THEN JULIANDAY(timestamp_alta_administrativa) - JULIANDAY(timestamp_principal)
        END
    ) AS media_espera_dias,
    COUNT(*) AS n
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND grupo IS NOT NULL
  AND especialidade IS NOT NULL
  AND (
      (tipo_entidade IN ('CONSULTA', 'PROCEDIMENTO', 'CIRURGIA')
        AND timestamp_realizacao IS NOT NULL AND timestamp_agendamento IS NOT NULL)
      OR (tipo_entidade = 'EXAME'
        AND timestamp_realizacao IS NOT NULL AND timestamp_solicitacao IS NOT NULL)
      OR (tipo_entidade = 'INTERNACAO'
        AND timestamp_alta_administrativa IS NOT NULL)
  )
  AND (:grupo        IS NULL OR grupo        = :grupo)
  AND (:especialidade IS NULL OR especialidade = :especialidade)
  AND (:tipo_entidade IS NULL OR tipo_entidade = :tipo_entidade)
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
GROUP BY tipo_entidade, grupo, especialidade
ORDER BY media_espera_dias DESC
