WITH prontuarios AS (
    SELECT paciente_id, MIN(timestamp_principal) AS dt_prontuario
    FROM fato_eventos_jornada
    WHERE tipo_entidade = 'PRONTUARIO' AND deleted_at IS NULL
    GROUP BY paciente_id
),
primeiro AS (
    SELECT paciente_id, MIN(timestamp_principal) AS dt_primeiro
    FROM fato_eventos_jornada
    WHERE tipo_entidade != 'PRONTUARIO' AND deleted_at IS NULL
    GROUP BY paciente_id
),
primeiro_dim AS (
    SELECT f.paciente_id, MIN(f.evento_id) AS evento_id, f.unidade, f.especialidade, f.grupo
    FROM fato_eventos_jornada f
    INNER JOIN primeiro pe
        ON f.paciente_id = pe.paciente_id
       AND f.timestamp_principal = pe.dt_primeiro
    WHERE f.deleted_at IS NULL AND f.tipo_entidade != 'PRONTUARIO'
    GROUP BY f.paciente_id
)
SELECT pd.{group_col} AS dimensao,
       JULIANDAY(pe.dt_primeiro) - JULIANDAY(p.dt_prontuario) AS valor
FROM prontuarios p
INNER JOIN primeiro pe ON p.paciente_id = pe.paciente_id
INNER JOIN primeiro_dim pd ON pd.paciente_id = p.paciente_id
WHERE JULIANDAY(pe.dt_primeiro) >= JULIANDAY(p.dt_prontuario)
  AND (:unidade       IS NULL OR pd.unidade       = :unidade)
  AND pd.unidade NOT LIKE '%INATIVO%'
  AND (:especialidade IS NULL OR pd.especialidade = :especialidade)
  AND (:grupo IS NULL OR pd.grupo = :grupo)
  {grupo_scope}
  AND (:data_inicio   IS NULL OR pe.dt_primeiro >= :data_inicio)
  AND (:data_fim      IS NULL OR pe.dt_primeiro <= :data_fim)
