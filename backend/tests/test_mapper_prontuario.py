import csv
from pathlib import Path

import pytest

from pija.etl.mappers.prontuario import map_pacientes_row


def _read_rows(path: Path) -> list[dict[str, str]]:
    with open(path, encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return list(reader)


@pytest.fixture
def sample_rows(fixtures_dir: str) -> list[dict[str, str]]:
    return _read_rows(Path(fixtures_dir) / "vw_pacientes_sample.csv")


def test_maps_prontuario_basic_fields(sample_rows: list[dict[str, str]]):
    out = map_pacientes_row(sample_rows[0])
    assert out is not None
    assert out["evento_id"] == "P-17774"
    assert out["paciente_id"] == "17774"
    assert out["tipo_entidade"] == "PRONTUARIO"
    assert out["entidade_id"] == "17774"
    assert out["timestamp_principal"] == "2015-08-25"
    assert out["situacao"] == "Ativo"


def test_does_not_carry_pii(sample_rows: list[dict[str, str]]):
    out = map_pacientes_row(sample_rows[0])
    assert out is not None
    forbidden = {
        "nome_iniciais", "nome_mae_iniciais", "nome_pai_iniciais",
        "idade", "sexo", "estado_civil", "cor", "etnia",
        "grau_instrucao", "profissao", "naturalidade",
        "logradouro", "bairro", "cidade", "uf",
    }
    assert forbidden.isdisjoint(out.keys())


def test_rejects_row_with_missing_prontuario():
    out = map_pacientes_row({
        "prontuario": "",
        "data_cadastro": "25/8/2015",
        "situacao_prontuario": "Ativo",
    })
    assert out is None


def test_rejects_row_with_invalid_date():
    out = map_pacientes_row({
        "prontuario": "12345",
        "data_cadastro": "invalid",
        "situacao_prontuario": "Ativo",
    })
    assert out is None