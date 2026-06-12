"""Mapper vw_exames → tipo_entidade=EXAME (DADOS-ESTADO.md §4.3).

`exame_id` é o CÓDIGO do tipo de exame (LDL, GLI, RX_TORAX) — não é
único por linha. Chave composta para evento_id: exame_id + atendimento_id
+ índice global da linha no chunk (passado em `row_index`).
"""

from pija.etl.mappers.base import FatoRow, empty_to_none
from pija.etl.parsers import parse_br_datetime, parse_br_id


def map_exame_row(row: dict[str, str], *, row_index: int = 0) -> FatoRow | None:
    paciente_id = parse_br_id(row.get("paciente_prontuario"))
    if not paciente_id:
        return None

    exame_code = empty_to_none(row.get("exame_id"))
    atendimento_id = parse_br_id(row.get("atendimento_id"))
    if not exame_code or not atendimento_id:
        return None

    solicitacao = parse_br_datetime(row.get("data_hora_solicitacao"))
    if not solicitacao:
        return None

    return {
        "evento_id": f"E-{exame_code}-{atendimento_id}-{row_index}",
        "paciente_id": paciente_id,
        "tipo_entidade": "EXAME",
        "entidade_id": exame_code,
        "timestamp_principal": solicitacao,
        "timestamp_solicitacao": solicitacao,
        "timestamp_agendamento": parse_br_datetime(row.get("data_hora_agendamento")),
        "timestamp_realizacao": parse_br_datetime(row.get("data_hora_realizacao")),
        "timestamp_liberacao": parse_br_datetime(row.get("data_hora_liberacao")),
        "unidade": empty_to_none(row.get("unidade_executora_nome")),
        "especialidade": empty_to_none(row.get("especialidade_solicitante_nome")),
        "tipo_evento": empty_to_none(row.get("tipo_exame")),
        "situacao": empty_to_none(row.get("situacao")),
    }