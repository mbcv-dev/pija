import pytest
from pija.providers.kpis_provider import KpisProvider


class TestKpisProvider:
    async def test_retorna_5_kpis(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade=None, data_inicio=None, data_fim=None)
        assert len(result.kpis) == 5
        codigos = {k.codigo for k in result.kpis}
        assert codigos == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07"}

    async def test_kpi_01(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade=None, data_inicio=None, data_fim=None)
        k = next(x for x in result.kpis if x.codigo == "KPI-01")
        assert k.media_dias == pytest.approx(12.0, abs=0.001)
        assert k.n == 5

    async def test_kpi_03(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade=None, data_inicio=None, data_fim=None)
        k = next(x for x in result.kpis if x.codigo == "KPI-03")
        assert k.media_dias == pytest.approx(9.2, abs=0.001)
        assert k.n == 5

    async def test_kpi_05_bloqueado(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade=None, data_inicio=None, data_fim=None)
        k = next(x for x in result.kpis if x.codigo == "KPI-05")
        assert k.media_dias is None
        assert k.n is None
        assert k.aviso is not None

    async def test_kpi_06(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade=None, data_inicio=None, data_fim=None)
        k = next(x for x in result.kpis if x.codigo == "KPI-06")
        assert k.media_dias == pytest.approx(11.0, abs=0.001)
        assert k.n == 3

    async def test_kpi_07(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade=None, data_inicio=None, data_fim=None)
        k = next(x for x in result.kpis if x.codigo == "KPI-07")
        assert k.media_dias == pytest.approx(5.0, abs=0.001)
        assert k.n == 3

    async def test_filtro_especialidade_kpi07(self, fixture_db_session):
        provider = KpisProvider(fixture_db_session)
        result = await provider.get_kpis(grupo=None, especialidade="CARDIOLOGIA", data_inicio=None, data_fim=None)
        k = next(x for x in result.kpis if x.codigo == "KPI-07")
        assert k.media_dias == pytest.approx(4.0, abs=0.001)  # (5+3)/2
        assert k.n == 2
