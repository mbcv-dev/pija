"""Mappers CSV → fato_eventos_jornada por entidade.

Conforme DADOS-ESTADO.md §4. Cada mapper recebe uma row dict (chaves =
nomes de coluna originais do CSV) e retorna um dict com as colunas do
fato_eventos_jornada — ou None se a linha for inválida (soft-fail).
"""