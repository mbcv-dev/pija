"""Mapper vw_internacoes → tipo_entidade=INTERNACAO (e ALTA derivada).

Conforme DADOS-ESTADO.md §4.4 e §4.5. Cada linha gera 1 evento
INTERNACAO; se `dthr_fim` estiver preenchido, gera adicionalmente
1 evento ALTA.
"""

from pija.etl.mappers.base import FatoRow, empty_to_none
from pija.etl.parsers import parse_br_datetime, parse_br_id
from pija.unidades import get_grupo


def map_internacao_row(row: dict[str, str]) -> list[FatoRow] | None:
    paciente_id = parse_br_id(row.get("prontuario"))
    entidade_id = parse_br_id(row.get("id_internacao"))
    if not paciente_id or not entidade_id:
        return None

    inicio = parse_br_datetime(row.get("dthr_inicio"))
    if not inicio:
        return None

    fim = parse_br_datetime(row.get("dthr_fim"))
    unidade = empty_to_none(row.get("unf_descricao"))
    especialidade = empty_to_none(row.get("esp_nome_especialidade"))
    tipo_alta = empty_to_none(row.get("descricao_tipo_alta_medica"))
    origem = empty_to_none(row.get("descricao_origem_evento"))

    internacao: FatoRow = {
        "evento_id": f"I-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "INTERNACAO",
        "entidade_id": entidade_id,
        "timestamp_principal": inicio,
        "timestamp_alta_administrativa": fim,
        "timestamp_alta_medica": fim,  # proxy — não há campo separado
        "unidade": unidade,
        "grupo": get_grupo(unidade),
        "especialidade": especialidade,
        "tipo_evento": origem,
        "situacao": tipo_alta,
    }

    events: list[FatoRow] = [internacao]

    if fim:
        alta: FatoRow = {
            "evento_id": f"A-{entidade_id}",
            "paciente_id": paciente_id,
            "tipo_entidade": "ALTA",
            "entidade_id": entidade_id,
            "timestamp_principal": fim,
            "timestamp_alta_administrativa": fim,
            "unidade": unidade,
            "grupo": get_grupo(unidade),
            "especialidade": especialidade,
            "tipo_evento": tipo_alta,
            "situacao": tipo_alta,
        }
        events.append(alta)

    return events