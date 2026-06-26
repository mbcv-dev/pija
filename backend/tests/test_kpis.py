import pytest

from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy

_NO_FILTER = dict(unidade=None, especialidade=None, data_inicio=None, data_fim=None)


def _bd(kpi):
    return {b.dimensao: (b.media, b.n) for b in kpi.breakdown}


async def _kpis(session, **over):
    provider = KpisProvider(session)
    params = dict(kpi_codes=None, group_by=GroupBy.unidade, **_NO_FILTER)
    params.update(over)
    result = await provider.get_kpis(**params)
    return {k.codigo: k for k in result.kpis}


class TestKpisProvider:
    async def test_retorna_5_kpis(self, fixture_db_session):
        kpis = await _kpis(fixture_db_session)
        assert set(kpis) == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07"}
        for k in kpis.values():
            assert k.unidade_tempo == "dias"

    async def test_kpi_01(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-01"]
        assert k.media_global == pytest.approx(12.0, abs=1e-9)
        assert k.n_global == 5
        assert _bd(k)["CARDIOLOGIA"] == (pytest.approx(11.0), 3)
        assert _bd(k)["ORTOPEDIA"] == (pytest.approx(13.5), 2)

    async def test_kpi_03(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-03"]
        assert k.media_global == pytest.approx(9.2, abs=1e-9)
        assert k.n_global == 5
        assert _bd(k)["CARDIOLOGIA"] == (pytest.approx(10.0), 3)
        assert _bd(k)["ORTOPEDIA"] == (pytest.approx(8.0), 2)

    async def test_kpi_05_calculado(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-05"]
        assert k.media_global == pytest.approx(5.5, abs=1e-9)  # (4+7)/2
        assert k.n_global == 2

    async def test_kpi_06(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-06"]
        assert k.media_global == pytest.approx(11.0, abs=1e-9)
        assert k.n_global == 3

    async def test_kpi_07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-07"]
        assert k.media_global == pytest.approx(5.0, abs=1e-9)
        assert k.n_global == 3

    async def test_filtro_especialidade_kpi07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, especialidade="CARDIOLOGIA"))["KPI-07"]
        assert k.media_global == pytest.approx(4.0, abs=1e-9)  # (5+3)/2
        assert k.n_global == 2

    async def test_group_by_especialidade(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, group_by=GroupBy.especialidade))["KPI-03"]
        assert _bd(k)["CARDIOLOGIA"] == (pytest.approx(10.0), 3)

    async def test_subconjunto_kpi_codes(self, fixture_db_session):
        kpis = await _kpis(fixture_db_session, kpi_codes=["KPI-03"])
        assert list(kpis) == ["KPI-03"]
