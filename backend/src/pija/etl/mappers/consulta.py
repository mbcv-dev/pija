"""Mapper vw_consultas → CONSULTA ou PROCEDIMENTO (DADOS-ESTADO.md §4.2).

Split por coluna `tipo`:
- `tipo = "CONSULTA"`     → tipo_entidade = "CONSULTA",      evento_id prefix "C-"
- `tipo = "PROCEDIMENTO"` → tipo_entidade = "PROCEDIMENTO",  evento_id prefix "PA-"

Daniel/HC (29-05): "procedimentos estão pulverizados dentro das tabelas de
Consultas. Não há uma view isolada para isso. O time deve extrair essa
informação diretamente do histórico de consultas contido no CSV."
"""

from pija.etl.mappers.base import FatoRow, empty_to_none, first_nonempty
from pija.etl.parsers import parse_br_datetime, parse_br_id

REALIZACAO_STATUSES = {"PACIENTE ATENDIDO"}

# tipo do CSV → (tipo_entidade, prefixo evento_id)
TIPO_MAP: dict[str, tuple[str, str]] = {
    "CONSULTA": ("CONSULTA", "C"),
    "PROCEDIMENTO": ("PROCEDIMENTO", "PA"),  # PA = Procedimento Ambulatorial
}


def map_consulta_row(row: dict[str, str]) -> FatoRow | None:
    paciente_id = parse_br_id(
        first_nonempty(row, "Prontuario", "prontuario", "Prontuário")
    )
    if not paciente_id:
        return None

    entidade_raw = first_nonempty(row, "num_consulta", "id")
    entidade_id = parse_br_id(entidade_raw)
    if not entidade_id:
        return None

    agendamento = parse_br_datetime(row.get("Data/Hora da Consulta"))
    inicio = parse_br_datetime(row.get("Data/Hora de Início"))

    if not agendamento:
        return None

    retorno = empty_to_none(row.get("Retorno"))
    realizacao = inicio if retorno in REALIZACAO_STATUSES else None

    # `tipo` vazio → trata como CONSULTA (padrão). Qualquer outro valor
    # desconhecido → rejeita a linha (evita corromper KPIs com classificação errada).
    tipo_csv = (row.get("tipo") or "").strip().upper() or "CONSULTA"
    mapped = TIPO_MAP.get(tipo_csv)
    if mapped is None:
        return None
    tipo_entidade, prefix = mapped

    return {
        "evento_id": f"{prefix}-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": tipo_entidade,
        "entidade_id": entidade_id,
        "timestamp_principal": agendamento,
        "timestamp_agendamento": agendamento,
        "timestamp_realizacao": realizacao,
        "unidade": empty_to_none(row.get("Unidade Funcional")),
        "especialidade": empty_to_none(row.get("especialidade")),
        "tipo_evento": empty_to_none(row.get("Condição do Atendimento")),
        "situacao": retorno,
    }