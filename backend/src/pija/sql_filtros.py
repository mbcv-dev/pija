"""Construção dos fragmentos SQL de filtro multivalor (IN) com parâmetros nomeados.

Fonte única usada por KPIs, Gargalos e Eventos. Os valores do usuário NUNCA são
interpolados no SQL — viram parâmetros nomeados (:campo_0, :campo_1, ...).
Lista vazia/None = filtro ausente (nenhuma cláusula gerada).
"""
from dataclasses import dataclass

# Campos multivalor suportados (mapeiam 1:1 para colunas do fato).
CAMPOS_MULTIVALOR = ("unidade", "especialidade", "grupo")


@dataclass(frozen=True)
class Filtros:
    """Filtros globais. Listas = multiseleção (OR interno); datas = intervalo."""

    unidade: list[str] | None = None
    especialidade: list[str] | None = None
    grupo: list[str] | None = None
    data_inicio: str | None = None
    data_fim: str | None = None


def build_filtros(filtros: Filtros, prefix: str = "") -> tuple[str, dict[str, str]]:
    """Devolve (fragmento_sql, params) para os campos multivalor preenchidos.

    `prefix` permite qualificar a coluna com o alias da query (ex.: "pd.").
    """
    fragmentos: list[str] = []
    params: dict[str, str] = {}
    for campo in CAMPOS_MULTIVALOR:
        valores = getattr(filtros, campo)
        if not valores:
            continue
        nomes: list[str] = []
        for i, valor in enumerate(valores):
            nome = f"{campo}_{i}"
            params[nome] = valor
            nomes.append(f":{nome}")
        fragmentos.append(f"AND {prefix}{campo} IN ({', '.join(nomes)})")
    return ("\n  ".join(fragmentos), params)
