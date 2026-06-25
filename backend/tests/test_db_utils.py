import pytest
from pija.db import load_sql


def test_load_sql_arquivo_inexistente_levanta_erro():
    with pytest.raises(FileNotFoundError):
        load_sql("nao_existe.sql")
