from pija.providers.kpis_provider import KPI_GRUPO_SCOPE, KPI_META


def test_kpi01_renomeado():
    assert KPI_META["KPI-01"][1] == "Prontuário → 1º evento assistencial"


def test_escopo_por_grupo_definido():
    assert KPI_GRUPO_SCOPE["KPI-01"] == ["Ambulatorial"]
    assert KPI_GRUPO_SCOPE["KPI-03"] == ["Ambulatorial"]
    assert set(KPI_GRUPO_SCOPE["KPI-05"]) == {
        "Análises Clínicas", "Diagnóstico por Imagem", "Anatomia Patológica"
    }
    assert KPI_GRUPO_SCOPE["KPI-06"] == ["Internação"]
    assert KPI_GRUPO_SCOPE["KPI-07"] == ["Internação"]
