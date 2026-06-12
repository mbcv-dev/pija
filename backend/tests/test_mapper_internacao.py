import csv
from pathlib import Path

import pytest

from pija.etl.mappers.internacao import map_internacao_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_internacoes_sample.csv")


def test_maps_internacao_with_alta(sample_rows):
    """Quando dthr_fim está preenchido, retorna 2 linhas: INTERNACAO + ALTA."""
    out = map_internacao_row(sample_rows[0])
    assert out is not None
    assert len(out) == 2

    internacao = next(e for e in out if e["tipo_entidade"] == "INTERNACAO")
    alta = next(e for e in out if e["tipo_entidade"] == "ALTA")

    assert internacao["evento_id"] == "I-2408"
    assert internacao["paciente_id"] == "19249655"
    assert internacao["timestamp_principal"] == "2015-01-01T00:51:00"
    assert internacao["timestamp_alta_administrativa"] == "2015-01-02T12:23:00"
    assert internacao["unidade"] == "9º NORTE"
    assert internacao["especialidade"] == "GINECOLOGIA E OBSTETRÍCIA"
    assert internacao["tipo_evento"] == "EMERGENCIA OBSTETRICA"
    assert internacao["situacao"] == "ALTA MÉDICA"

    assert alta["evento_id"] == "A-2408"
    assert alta["timestamp_principal"] == "2015-01-02T12:23:00"
    assert alta["tipo_evento"] == "ALTA MÉDICA"


def test_maps_internacao_em_curso_sem_alta(sample_rows):
    """Quando dthr_fim vazio, retorna apenas INTERNACAO (sem ALTA)."""
    out = map_internacao_row(sample_rows[1])
    assert out is not None
    assert len(out) == 1
    assert out[0]["tipo_entidade"] == "INTERNACAO"
    assert out[0]["timestamp_alta_administrativa"] is None