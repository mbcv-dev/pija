-- Escopo em cascata por GRUPO: unidades daquele(s) grupo(s) e suas especialidades.
-- O placeholder de filtros e preenchido pelo provider com uma clausula AND grupo IN (lista).
-- Atencao -- nao usar exemplos de bind param prefixados por dois-pontos nestes comentarios,
-- pois o scanner de bind params do SQLAlchemy os conta mesmo dentro de comentarios SQL.
SELECT 'unidade' AS tipo, unidade AS valor, grupo AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND unidade IS NOT NULL AND unidade != ''
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
GROUP BY unidade
UNION ALL
SELECT 'especialidade' AS tipo, especialidade AS valor, NULL AS grupo_da_unidade
FROM fato_eventos_jornada
WHERE deleted_at IS NULL AND especialidade IS NOT NULL AND especialidade != ''
  {filtros}
GROUP BY especialidade
ORDER BY tipo, valor
