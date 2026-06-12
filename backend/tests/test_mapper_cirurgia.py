import csv
from pathlib import Path

import pytest

from pija.etl.mappers.cirurgia import map_cirurgia_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_cirurgias_sample.csv")


def test_maps_cirurgia_realizada(sample_rows):
    out = map_cirurgia_row(sample_rows[0])
    assert out is not None
    assert out["tipo_entidade"] == "CIRURGIA"
    assert out["evento_id"] == "X-62246"
    assert out["paciente_id"] == "15463292"
    assert out["entidade_id"] == "62246"
    assert out["timestamp_principal"] == "2025-02-26T13:25:00"
    assert out["timestamp_agendamento"] == "2025-02-26T13:00:00"
    assert out["timestamp_realizacao"] == "2025-02-26T13:30:00"
    assert out["unidade"] == "BLOCO CIRURGICO"
    assert out["especialidade"] == "CIRURGIA VASCULAR"
    # tipo_evento combina Tipo do Procedimento + Natureza
    assert out["tipo_evento"] == "CIRURGIA/URGÊNCIA"
    assert out["situacao"] == "RZDA"


def test_pdt_stays_as_cirurgia_with_subtipo_in_tipo_evento(sample_rows):
    """Daniel/HC (29-05): PDT em cirurgias NÃO é equivalente a procedimento
    ambulatorial. Toda linha vira CIRURGIA; subtipo vai em tipo_evento."""
    out = map_cirurgia_row(sample_rows[1])
    assert out is not None
    assert out["tipo_entidade"] == "CIRURGIA"
    assert out["tipo_evento"] == "PDT/ELETIVA"


def test_rejects_row_without_prontuario(sample_rows):
    out = map_cirurgia_row(sample_rows[2])
    assert out is None