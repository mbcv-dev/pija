import pytest

from pija.providers.gargalos_provider import GargalosProvider
from pija.schemas.common import GroupBy


async def _gargalos(session, **over):
    provider = GargalosProvider(session)
    params = dict(
        kpi_codes=None, group_by=GroupBy.unidade,
        unidade=None, especialidade=None, data_inicio=None, data_fim=None, limit=10,
    )
    params.update(over)
    return await provider.get_gargalos(**params)


class TestGargalosProvider:
    async def test_top1_kpi06_cardiologia(self, fixture_db_session):
        result = await _gargalos(fixture_db_session)
        assert len(result.items) > 0
        top = result.items[0]
        assert top.transicao == "KPI-06"
        assert top.dimensao == "CARDIOLOGIA"
        assert top.dimensao_tipo == "unidade"
        assert top.media == pytest.approx(13.5, abs=1e-9)

    async def test_ordenado_desc(self, fixture_db_session):
        result = await _gargalos(fixture_db_session)
        medias = [i.media for i in result.items]
        assert medias == sorted(medias, reverse=True)

    async def test_ranking_completo_determinista(self, fixture_db_session):
        result = await _gargalos(fixture_db_session)
        got = [(i.transicao, i.dimensao, round(i.media, 2)) for i in result.items]
        assert got == [
            ("KPI-06", "CARDIOLOGIA", 13.5),
            ("KPI-03", "CARDIOLOGIA", 10.0),
            ("KPI-03", "ORTOPEDIA", 8.0),
            ("KPI-05", "ORTOPEDIA", 7.0),
            ("KPI-07", "ORTOPEDIA", 7.0),
            ("KPI-06", "ORTOPEDIA", 6.0),
            ("KPI-05", "CARDIOLOGIA", 4.0),
            ("KPI-07", "CARDIOLOGIA", 4.0),
        ]

    async def test_limit_topn(self, fixture_db_session):
        result = await _gargalos(fixture_db_session, limit=3)
        assert len(result.items) == 3
