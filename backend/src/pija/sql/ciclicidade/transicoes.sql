-- Transições evento -> próximo evento, por paciente, na coorte filtrada.
-- Semântica de coorte: o filtro define QUAIS pacientes entram; contam-se TODAS
-- as transições desses pacientes (mesmo eventos fora do filtro).
-- {filtros} é injetado por sql_filtros.build_filtros (começa com "AND").
WITH coorte AS (
    SELECT DISTINCT paciente_id
    FROM fato_eventos_jornada
    WHERE deleted_at IS NULL
      AND (:paciente_id IS NULL OR paciente_id = :paciente_id)
      {filtros}
      AND (:data_inicio IS NULL OR timestamp_principal >= :data_inicio)
      AND (:data_fim    IS NULL OR timestamp_principal <= :data_fim)
),
ordenados AS (
    SELECT
        LAG(f.tipo_entidade) OVER (
            PARTITION BY f.paciente_id
            ORDER BY f.timestamp_principal, f.evento_id
        ) AS origem,
        f.tipo_entidade AS destino,
        (
            julianday(f.timestamp_principal)
            - julianday(LAG(f.timestamp_principal) OVER (
                PARTITION BY f.paciente_id
                ORDER BY f.timestamp_principal, f.evento_id
            ))
        ) * 86400.0 AS gap_s
    FROM fato_eventos_jornada f
    JOIN coorte c ON c.paciente_id = f.paciente_id
    WHERE f.deleted_at IS NULL
)
SELECT
    origem,
    destino,
    COUNT(*)      AS volume,
    AVG(gap_s)    AS tempo_medio_s,
    COUNT(gap_s)  AS n
FROM ordenados
WHERE origem IS NOT NULL
GROUP BY origem, destino
ORDER BY origem, destino;
