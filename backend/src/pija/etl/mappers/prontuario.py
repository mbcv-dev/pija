"""Mapper para vw_pacientes_anonimizado.csv → tipo_entidade=PRONTUARIO.

Conforme DADOS-ESTADO.md §4.1. **NÃO carrega PII** (nome, idade, sexo,
endereço — guardrail "No Personal Data" do SPEC.md).
"""

from pija.etl.mappers.base import FatoRow, empty_to_none, first_nonempty
from pija.etl.parsers import parse_br_date, parse_br_id


def map_pacientes_row(row: dict[str, str]) -> FatoRow | None:
    """Mapeia uma linha de vw_pacientes para um FatoRow PRONTUARIO.

    Retorna None se a linha for inválida (prontuario vazio ou data
    inválida) — soft-fail registrado em etl_log.rows_rejected.
    """
    prontuario_raw = first_nonempty(row, "prontuario", "Prontuario", "Prontuário")
    paciente_id = parse_br_id(prontuario_raw)
    if not paciente_id:
        return None

    timestamp_principal = parse_br_date(row.get("data_cadastro"))
    if not timestamp_principal:
        return None

    return {
        "evento_id": f"P-{paciente_id}",
        "paciente_id": paciente_id,
        "tipo_entidade": "PRONTUARIO",
        "entidade_id": paciente_id,
        "timestamp_principal": timestamp_principal,
        "situacao": empty_to_none(row.get("situacao_prontuario")),
    }