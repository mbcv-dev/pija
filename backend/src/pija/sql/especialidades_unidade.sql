-- Especialidades distintas de UMA OU MAIS unidades executoras (filtro em cascata).
-- O placeholder de filtros e preenchido pelo provider com uma clausula AND unidade IN (lista).
-- Atencao -- nao usar exemplos de bind param prefixados por dois-pontos nestes comentarios,
-- pois o scanner de bind params do SQLAlchemy os conta mesmo dentro de comentarios SQL.
SELECT especialidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND especialidade IS NOT NULL AND especialidade != ''
  {filtros}
GROUP BY especialidade
ORDER BY especialidade
