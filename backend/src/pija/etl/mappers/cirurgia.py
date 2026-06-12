"""Mapper vw_cirurgias → tipo_entidade=CIRURGIA (DADOS-ESTADO.md §4.6).

**Toda** linha de vw_cirurgias vira CIRURGIA. O subtipo (CIRURGIA vs PDT)
e a natureza (ELETIVA, URGÊNCIA, EMERGÊNCIA) são combinados em
`tipo_evento` no formato "{tipo}/{natureza}".

Daniel/HC (29-05): procedimentos ambulatoriais estão em vw_consultas
(coluna tipo=PROCEDIMENTO), NÃO aqui. PDT em cirurgias é "Procedimento
Diagnóstico-Terapêutico" feito no ambiente cirúrgico — outro conceito.
"""

from pija.etl.mappers.base import FatoRow, empty_to_none, first_nonempty
from pija.etl.parsers import parse_br_datetime, parse_br_id


def map_cirurgia_row(row: dict[str, str]) -> FatoRow | None:
    paciente_id = parse_br_id(
        first_nonempty(row, "Prontuário", "Prontuario", "prontuario")
    )
    entidade_id = parse_br_id(row.get("cirurgia_id"))
    if not paciente_id or not entidade_id:
        return None

    inicio = parse_br_datetime(row.get("data_inicio_cirurgia"))
    if not inicio:
        return None

    tipo_proc = empty_to_none(row.get("Tipo do Procedimento")) or "CIRURGIA"
    natureza = empty_to_none(row.get("Natureza do Agendamento"))
    tipo_evento = f"{tipo_proc}/{natureza}" if natureza else tipo_proc

    return {
        "evento_id": f"X-{entidade_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "CIRURGIA",
        "entidade_id": entidade_id,
        "timestamp_principal": inicio,
        "timestamp_agendamento": parse_br_datetime(row.get("Entrada na Sala")),
        "timestamp_realizacao": parse_br_datetime(row.get("data_fim_cirurgia")),
        "unidade": empty_to_none(row.get("Unidade Funcional")),
        "especialidade": empty_to_none(row.get("Especialidade")),
        "tipo_evento": tipo_evento,
        "situacao": empty_to_none(row.get("situacao")),
    }