"""Dependência única dos filtros comuns a todos os endpoints analíticos.

Existe porque cinco controllers repetiam as mesmas cinco declarações `Query()`
e a mesma montagem de `Filtros`. Uma função compartilhada comum NÃO resolveria:
o FastAPI só documenta no OpenAPI os parâmetros declarados na assinatura do
endpoint ou de uma dependência — por isso isto é uma dependência, e não um helper.
"""
from datetime import date

from fastapi import Query

from pija.sql_filtros import Filtros


def filtros_comuns(
    unidade: list[str] | None = Query(None, description="Restringe a uma ou mais unidades (repita o parâmetro)."),
    especialidade: list[str] | None = Query(None, description="Restringe a uma ou mais especialidades (repita o parâmetro)."),
    grupo: list[str] | None = Query(None, description="Restringe a um ou mais grupos assistenciais (repita o parâmetro)."),
    data_inicio: date | None = Query(None, description="Considera apenas eventos a partir desta data. Formato: `YYYY-MM-DD`"),
    data_fim: date | None = Query(None, description="Considera apenas eventos até esta data. Formato: `YYYY-MM-DD`"),
) -> Filtros:
    """Monta o `Filtros` a partir dos parâmetros de query comuns.

    As datas chegam como `date` (o FastAPI valida o formato) e saem como string
    ISO porque `Filtros` alimenta SQL nativo, onde a comparação é textual.
    """
    return Filtros(
        unidade=unidade,
        especialidade=especialidade,
        grupo=grupo,
        data_inicio=data_inicio.isoformat() if data_inicio else None,
        data_fim=data_fim.isoformat() if data_fim else None,
    )
