-- Especialidades distintas de UMA unidade executora (filtro em cascata).
SELECT especialidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND especialidade IS NOT NULL AND especialidade != ''
  AND unidade = :unidade
GROUP BY especialidade
ORDER BY especialidade
