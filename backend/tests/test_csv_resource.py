from pathlib import Path

import pytest

from pija.resources.csv_resource import CsvResource


@pytest.fixture
def csv_dir(tmp_path: Path) -> Path:
    """Cria um CSV de teste minimal."""
    p = tmp_path / "vw_test.csv"
    p.write_text(
        "col_a,col_b,col_c\n"
        "1,foo,2025-01-01\n"
        "2,bar,2025-01-02\n"
        "3,baz,2025-01-03\n"
        "4,qux,2025-01-04\n"
        "5,quux,2025-01-05\n",
        encoding="utf-8",
    )
    return tmp_path


def test_csv_resource_iterates_all_rows(csv_dir: Path):
    res = CsvResource(csv_dir=str(csv_dir), chunksize=2)
    rows = list(res.iter_rows("vw_test"))
    assert len(rows) == 5
    assert rows[0] == {"col_a": "1", "col_b": "foo", "col_c": "2025-01-01"}
    assert rows[4] == {"col_a": "5", "col_b": "quux", "col_c": "2025-01-05"}


def test_csv_resource_respects_sample(csv_dir: Path):
    res = CsvResource(csv_dir=str(csv_dir), chunksize=2)
    rows = list(res.iter_rows("vw_test", sample=3))
    assert len(rows) == 3
    assert rows[0]["col_a"] == "1"
    assert rows[2]["col_a"] == "3"


def test_csv_resource_count(csv_dir: Path):
    res = CsvResource(csv_dir=str(csv_dir))
    assert res.count("vw_test") == 5


def test_csv_resource_raises_when_missing(tmp_path: Path):
    res = CsvResource(csv_dir=str(tmp_path))
    with pytest.raises(FileNotFoundError):
        list(res.iter_rows("vw_nonexistent"))