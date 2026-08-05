-- KPI-05: solicitação → liberação do resultado do exame.
-- Mede LIBERAÇÃO, não realização: em vw_exames, `data_hora_realizacao` é anterior à
-- solicitação em 61,2% das linhas (DADOS-ESTADO §12), o que fazia a guarda de ordem
-- descartar ~600 mil eventos em silêncio e a mediana do resto dar zero.
-- `timestamp_liberacao` é preenchido em correspondência 1:1 com situacao='LIBERADO',
-- então a guarda de nulo abaixo já restringe aos exames com resultado liberado —
-- não é preciso (nem desejável) filtrar por `situacao` também.
SELECT {group_col} AS dimensao,
       JULIANDAY(timestamp_liberacao) - JULIANDAY(timestamp_solicitacao) AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'EXAME'
  AND timestamp_liberacao IS NOT NULL
  AND timestamp_solicitacao IS NOT NULL
  AND JULIANDAY(timestamp_liberacao) >= JULIANDAY(timestamp_solicitacao)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
