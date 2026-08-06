-- KPI-10B: espera em sala (entrada na sala → início da cirurgia), em HORAS.
-- É o tempo com a sala ocupada sem procedimento em curso — onde ineficiência
-- operacional aparece, e acionável de um jeito que a duração da cirurgia não é
-- (a duração depende do procedimento; a espera depende da organização).
-- `timestamp_agendamento` = Entrada na Sala (ver DADOS-ESTADO §4.6): o nome da
-- coluna do fato diz "agendamento", mas para CIRURGIA o ETL grava a entrada na sala.
SELECT {group_col} AS dimensao,
       (JULIANDAY(timestamp_principal) - JULIANDAY(timestamp_agendamento)) * 24 AS valor
FROM fato_eventos_jornada
WHERE deleted_at IS NULL
  AND tipo_entidade = 'CIRURGIA'
  AND situacao = 'RZDA'
  AND timestamp_principal IS NOT NULL
  AND timestamp_agendamento IS NOT NULL
  AND JULIANDAY(timestamp_principal) >= JULIANDAY(timestamp_agendamento)
  AND unidade NOT LIKE '%INATIVO%'
  {filtros}
  AND (:data_inicio   IS NULL OR timestamp_principal >= :data_inicio)
  AND (:data_fim      IS NULL OR timestamp_principal <= :data_fim)
  {grupo_scope}
