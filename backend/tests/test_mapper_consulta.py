import csv
from pathlib import Path

import pytest

from pija.etl.mappers.consulta import map_consulta_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_consultas_sample.csv")


def test_maps_consulta_atendida(sample_rows):
    """Linha com tipo=PROCEDIMENTO vira tipo_entidade=PROCEDIMENTO (Daniel/HC 29-05)."""
    out = map_consulta_row(sample_rows[0])
    assert out is not None
    # Fixture row 0: tipo=PROCEDIMENTO → tipo_entidade=PROCEDIMENTO, prefix PA
    assert out["evento_id"] == "PA-3972104"
    assert out["paciente_id"] == "19918085"
    assert out["tipo_entidade"] == "PROCEDIMENTO"
    assert out["entidade_id"] == "3972104"
    assert out["timestamp_principal"] == "2025-01-13T07:00:00"
    assert out["timestamp_agendamento"] == "2025-01-13T07:00:00"
    assert out["timestamp_realizacao"] == "2025-01-13T09:45:00"  # paciente atendido
    assert out["unidade"] == "UROLOGIA (AMBULATÓRIO)"
    assert out["especialidade"] == "UROLOGIA HORMONIOTERAPIA"
    assert out["tipo_evento"] == "RETORNO"
    assert out["situacao"] == "PACIENTE ATENDIDO"


def test_consulta_falta_does_not_set_realizacao(sample_rows):
    """Linha com tipo=CONSULTA + Retorno=PACIENTE FALTOU."""
    out = map_consulta_row(sample_rows[1])
    assert out is not None
    # Fixture row 1: tipo=CONSULTA → tipo_entidade=CONSULTA, prefix C
    assert out["evento_id"] == "C-3972105"
    assert out["tipo_entidade"] == "CONSULTA"
    assert out["situacao"] == "PACIENTE FALTOU"
    assert out["timestamp_realizacao"] is None
    assert out["tipo_evento"] == "CONSULTA REGULADA"


def test_rejects_consulta_without_prontuario(sample_rows):
    out = map_consulta_row(sample_rows[2])
    assert out is None