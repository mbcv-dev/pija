-- Valores distintos para popular os filtros do frontend (grupo, unidade, especialidade).
-- Exclui unidades inativas (sufixo "INATIVO") do AGHU. Ordenado por tipo e valor.
SELECT 'grupo' AS tipo, grupo AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND grupo IS NOT NULL AND grupo != ''
GROUP BY grupo
UNION ALL
SELECT 'unidade' AS tipo, unidade AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND unidade IS NOT NULL AND unidade != ''
  AND unidade NOT LIKE '%INATIVO%'
GROUP BY unidade
UNION ALL
SELECT 'especialidade' AS tipo, especialidade AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND especialidade IS NOT NULL AND especialidade != ''
GROUP BY especialidade
ORDER BY tipo, valor
