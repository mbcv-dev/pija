import csv
from pathlib import Path

import pytest

from pija.etl.mappers.exame import map_exame_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_exames_sample.csv")


def test_maps_exame_pendente(sample_rows):
    out = map_exame_row(sample_rows[0])
    assert out is not None
    assert out["tipo_entidade"] == "EXAME"
    assert out["paciente_id"] == "21532437"
    assert out["entidade_id"] == "LDL"  # exame_id é o código do tipo
    assert out["evento_id"].startswith("E-LDL-2450336-")
    assert out["timestamp_principal"] == "2026-05-19T10:50:00"
    assert out["timestamp_solicitacao"] == "2026-05-19T10:50:00"
    assert out["timestamp_agendamento"] is None
    assert out["timestamp_realizacao"] == "2026-05-19T10:49:00"
    assert out["timestamp_liberacao"] is None
    assert out["situacao"] == "PENDENTE"
    assert out["tipo_evento"] == "Laboratorial (SANGUE)"


def test_maps_exame_liberado(sample_rows):
    out = map_exame_row(sample_rows[1])
    assert out is not None
    assert out["timestamp_liberacao"] == "2026-05-19T11:30:00"
    assert out["situacao"] == "LIBERADO"


def test_maps_exame_imagem_with_agendamento(sample_rows):
    out = map_exame_row(sample_rows[2])
    assert out is not None
    assert out["timestamp_agendamento"] == "2026-05-21T09:00:00"
    assert out["tipo_evento"] == "Imagem"
    assert out["unidade"] == "UAC: RADIOLOGIA"


def test_row_index_differentiates_evento_id(sample_rows):
    """Lock the contract that row_index produces unique evento_ids for repeated codes
    (Task 15 runner threads a counter to prevent collisions in real data)."""
    a = map_exame_row(sample_rows[0], row_index=1)
    b = map_exame_row(sample_rows[0], row_index=2)
    assert a is not None and b is not None
    assert a["evento_id"] == "E-LDL-2450336-1"
    assert b["evento_id"] == "E-LDL-2450336-2"
    assert a["evento_id"] != b["evento_id"]