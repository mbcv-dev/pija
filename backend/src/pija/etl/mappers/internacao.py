"""Mapper vw_internacoes → tipo_entidade=INTERNACAO (e ALTA derivada).

Conforme DADOS-ESTADO.md §4.4 e §4.5. Cada linha gera 1 evento
INTERNACAO; se `dthr_fim` estiver preenchido, gera adicionalmente
1 evento ALTA.
"""

from pija.etl.mappers.base import FatoRow, empty_to_none
from pija.etl.parsers import parse_br_id, parse_datetime
from pija.unidades import get_grupo, normalizar_unidade


def map_internacao_row(row: dict[str, str]) -> list[FatoRow] | None:
    paciente_id = parse_br_id(row.get("prontuario"))
    entidade_id = parse_br_id(row.get("id_internacao"))
    if not paciente_id or not entidade_id:
        return None

    inicio = parse_datetime(row.get("dthr_inicio"))
    if not inicio:
        return None

    # saída física (alta administrativa) — fallback ao dthr_fim quando dt_saida_paciente ausente
    saida = parse_datetime(row.get("dt_saida_paciente")) or parse_datetime(row.get("dthr_fim"))
    alta_medica = parse_datetime(row.get("dthr_alta_medica"))
    unidade = normalizar_unidade(row.get("unf_descricao"))
    especialidade = empty_to_none(row.get("esp_nome_especialidade"))
    tipo_alta = empty_to_none(row.get("descricao_tipo_alta_medica"))
    origem = empty_to_none(row.get("descricao_origem_evento"))

    internacao: FatoRow = {
        "evento_id": f"I-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "INTERNACAO",
        "entidade_id": entidade_id,
        "timestamp_principal": inicio,
        "timestamp_alta_administrativa": saida,
        "timestamp_alta_medica": alta_medica,
        "unidade": unidade,
        "grupo": get_grupo(unidade),
        "especialidade": especialidade,
        "tipo_evento": origem,
        "situacao": tipo_alta,
    }

    events: list[FatoRow] = [internacao]

    if saida:
        alta: FatoRow = {
            "evento_id": f"A-{entidade_id}",
            "paciente_id": paciente_id,
            "tipo_entidade": "ALTA",
            "entidade_id": entidade_id,
            "timestamp_principal": saida,
            "timestamp_alta_administrativa": saida,
            "unidade": unidade,
            "grupo": get_grupo(unidade),
            "especialidade": especialidade,
            "tipo_evento": tipo_alta,
            "situacao": tipo_alta,
        }
        events.append(alta)

    return events