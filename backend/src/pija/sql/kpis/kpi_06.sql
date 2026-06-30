WITH internacoes AS (
    SELECT paciente_id, timestamp_principal AS dt_internacao, unidade, especialidade
    FROM fato_eventos_jornada
    WHERE tipo_entidade = 'INTERNACAO'
      AND deleted_at IS NULL
      AND (:unidade       IS NULL OR unidade       = :unidade)
      AND unidade NOT LIKE '%INATIVO%'
      AND (:especialidade IS NULL OR especialidade = :especialidade)
      AND (:grupo IS NULL OR grupo = :grupo)
      {grupo_scope}
      AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
      AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
),
ultima_consulta AS (
    SELECT i.dt_internacao, i.unidade, i.especialidade,
           MAX(c.timestamp_realizacao) AS dt_ultima_consulta
    FROM internacoes i
    INNER JOIN fato_eventos_jornada c
        ON c.paciente_id = i.paciente_id
       AND c.tipo_entidade = 'CONSULTA'
       AND c.deleted_at IS NULL
       AND c.timestamp_realizacao IS NOT NULL
       AND c.timestamp_realizacao < i.dt_internacao
    GROUP BY i.paciente_id, i.dt_internacao, i.unidade, i.especialidade
)
SELECT {group_col} AS dimensao,
       SUM(JULIANDAY(dt_internacao) - JULIANDAY(dt_ultima_consulta)) AS soma_dias,
       COUNT(*) AS n
FROM ultima_consulta
GROUP BY {group_col}
